// Credit report source detection - identifies which monitoring service generated the file

export type CreditReportSource = 
  | 'identityiq'
  | 'smartcredit'
  | 'privacyguard'
  | 'myscoreiq'
  | 'creditkarma'
  | 'annualcreditreport'
  | 'experian'
  | 'transunion'
  | 'equifax'
  | 'unknown';

export interface SourceDetectionResult {
  source: CreditReportSource;
  confidence: 'high' | 'medium' | 'low';
  detectedBureau?: 'transunion' | 'experian' | 'equifax' | 'combined';
  signatures: string[];
}

// Signature patterns for each monitoring service
const SOURCE_SIGNATURES: Record<CreditReportSource, RegExp[]> = {
  identityiq: [
    /identityiq/i,
    /identity\s*iq/i,
    /idiq/i,
    /class="?iq-/i,
    /id="?iq-/i,
    /data-iq-/i,
    /IdentityIQ\.com/i,
    /Your\s+IdentityIQ\s+Report/i,
  ],
  smartcredit: [
    /smartcredit/i,
    /smart\s*credit/i,
    /class="?sc-/i,
    /smartcredit\.com/i,
    /SmartCredit\s+Report/i,
    /data-smartcredit/i,
  ],
  privacyguard: [
    /privacyguard/i,
    /privacy\s*guard/i,
    /class="?pg-/i,
    /privacyguard\.com/i,
    /PrivacyGuard\s+Report/i,
  ],
  myscoreiq: [
    /myscoreiq/i,
    /my\s*score\s*iq/i,
    /class="?msiq-/i,
    /myscoreiq\.com/i,
    /MyScoreIQ\s+Report/i,
  ],
  creditkarma: [
    /creditkarma/i,
    /credit\s*karma/i,
    /creditkarma\.com/i,
    /class="?ck-/i,
  ],
  annualcreditreport: [
    /annualcreditreport/i,
    /annual\s*credit\s*report/i,
    /annualcreditreport\.com/i,
    /Free\s+Annual\s+Credit\s+Report/i,
  ],
  experian: [
    /experian\.com\/consumer/i,
    /Experian\s+Credit\s+Report/i,
    /class="?experian-/i,
    /data-experian/i,
  ],
  transunion: [
    /transunion\.com\/consumer/i,
    /TransUnion\s+Credit\s+Report/i,
    /class="?tu-/i,
    /data-transunion/i,
  ],
  equifax: [
    /equifax\.com\/personal/i,
    /Equifax\s+Credit\s+Report/i,
    /class="?efx-/i,
    /data-equifax/i,
  ],
  unknown: [],
};

// Bureau detection patterns
const BUREAU_PATTERNS = {
  transunion: [/transunion/i, /trans\s*union/i, /\bTU\b/],
  experian: [/experian/i, /\bEXP\b/, /\bEX\b/],
  equifax: [/equifax/i, /\bEFX\b/, /\bEQ\b/],
};

export function detectCreditReportSource(content: string): SourceDetectionResult {
  const matchedSignatures: string[] = [];
  let bestSource: CreditReportSource = 'unknown';
  let bestMatchCount = 0;

  // Check each source's signatures
  for (const [source, patterns] of Object.entries(SOURCE_SIGNATURES)) {
    if (source === 'unknown') continue;
    
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        matchCount++;
        matchedSignatures.push(`${source}: ${pattern.source}`);
      }
    }
    
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestSource = source as CreditReportSource;
    }
  }

  // Determine confidence based on match count
  let confidence: 'high' | 'medium' | 'low';
  if (bestMatchCount >= 3) {
    confidence = 'high';
  } else if (bestMatchCount >= 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Detect bureau
  const detectedBureau = detectBureau(content);

  return {
    source: bestSource,
    confidence,
    detectedBureau,
    signatures: matchedSignatures,
  };
}

export function detectBureau(content: string): 'transunion' | 'experian' | 'equifax' | 'combined' | undefined {
  const bureausFound: string[] = [];

  for (const [bureau, patterns] of Object.entries(BUREAU_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        bureausFound.push(bureau);
        break;
      }
    }
  }

  if (bureausFound.length === 0) {
    return undefined;
  } else if (bureausFound.length === 1) {
    return bureausFound[0] as 'transunion' | 'experian' | 'equifax';
  } else if (bureausFound.length >= 2) {
    return 'combined';
  }

  return undefined;
}

// HTML-specific detection with DOM analysis
export function detectHtmlSource(html: string): SourceDetectionResult {
  const baseResult = detectCreditReportSource(html);
  
  // Additional HTML-specific checks
  const additionalSignatures: string[] = [];

  // Check for specific meta tags
  if (/<meta[^>]*identityiq/i.test(html)) {
    additionalSignatures.push('meta:identityiq');
  }
  if (/<meta[^>]*smartcredit/i.test(html)) {
    additionalSignatures.push('meta:smartcredit');
  }

  // Check for specific stylesheets
  if (/href="[^"]*identityiq[^"]*\.css"/i.test(html)) {
    additionalSignatures.push('stylesheet:identityiq');
  }
  if (/href="[^"]*smartcredit[^"]*\.css"/i.test(html)) {
    additionalSignatures.push('stylesheet:smartcredit');
  }

  // Check for specific script sources
  if (/src="[^"]*identityiq[^"]*\.js"/i.test(html)) {
    additionalSignatures.push('script:identityiq');
  }

  return {
    ...baseResult,
    signatures: [...baseResult.signatures, ...additionalSignatures],
  };
}

// PDF-specific detection (from extracted text)
export function detectPdfSource(text: string): SourceDetectionResult {
  const baseResult = detectCreditReportSource(text);
  
  // PDFs often have specific header/footer text
  const additionalSignatures: string[] = [];

  if (/Provided\s+by\s+IdentityIQ/i.test(text)) {
    additionalSignatures.push('pdf-header:identityiq');
  }
  if (/Powered\s+by\s+SmartCredit/i.test(text)) {
    additionalSignatures.push('pdf-header:smartcredit');
  }
  if (/PrivacyGuard\s+Member\s+Report/i.test(text)) {
    additionalSignatures.push('pdf-header:privacyguard');
  }

  return {
    ...baseResult,
    signatures: [...baseResult.signatures, ...additionalSignatures],
  };
}

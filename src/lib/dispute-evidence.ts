// Dispute Evidence Requirements System
// Maps reason codes to required/recommended documentation

export interface EvidenceRequirement {
  required: boolean;
  documentTypes: DocumentType[];
  prompt: string;
  warningIfMissing?: string;
}

export type DocumentType = 
  | 'id_document'
  | 'proof_of_address'
  | 'police_report'
  | 'ftc_identity_theft_report'
  | 'bank_statement'
  | 'payment_receipt'
  | 'correspondence'
  | 'credit_report'
  | 'dispute_letter'
  | 'other';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  id_document: 'Government ID (Driver\'s License, Passport, etc.)',
  proof_of_address: 'Proof of Address (Utility Bill, Bank Statement)',
  police_report: 'Police Report',
  ftc_identity_theft_report: 'FTC Identity Theft Report',
  bank_statement: 'Bank Statement',
  payment_receipt: 'Payment Receipt or Confirmation',
  correspondence: 'Creditor/Bureau Correspondence',
  credit_report: 'Credit Report',
  dispute_letter: 'Previous Dispute Letter',
  other: 'Other Supporting Document',
};

// Evidence requirements by reason code
export const EVIDENCE_REQUIREMENTS: Record<string, EvidenceRequirement> = {
  // Identity/fraud claims - REQUIRES documentation
  identity_theft: {
    required: true,
    documentTypes: ['police_report', 'ftc_identity_theft_report', 'id_document'],
    prompt: 'Identity theft disputes require a police report or FTC Identity Theft Report (IdentityTheft.gov)',
    warningIfMissing: 'WARNING: Identity theft claims without documentation may be rejected and could have legal implications if false.',
  },
  not_mine: {
    required: false,
    documentTypes: ['id_document', 'proof_of_address'],
    prompt: 'Attach government ID to strengthen "not my account" claims',
    warningIfMissing: 'Consider attaching ID to support this claim. Without documentation, bureaus may simply verify with the furnisher.',
  },
  mixed_file: {
    required: false,
    documentTypes: ['id_document', 'proof_of_address'],
    prompt: 'Attach ID showing your full name and SSN (last 4) to prove mixed file',
    warningIfMissing: 'Mixed file disputes are stronger with identity documentation.',
  },

  // Payment/balance claims - recommended documentation
  paid_collection: {
    required: false,
    documentTypes: ['payment_receipt', 'bank_statement', 'correspondence'],
    prompt: 'Attach proof of payment (receipt, bank statement, or settlement letter)',
    warningIfMissing: 'Payment documentation significantly strengthens paid collection disputes.',
  },
  wrong_balance: {
    required: false,
    documentTypes: ['bank_statement', 'correspondence'],
    prompt: 'Attach statements or correspondence showing correct balance',
  },
  closed_by_consumer: {
    required: false,
    documentTypes: ['correspondence'],
    prompt: 'Attach closure confirmation letter if available',
  },

  // Method of verification (Round 2+)
  method_of_verification: {
    required: false,
    documentTypes: ['dispute_letter', 'correspondence'],
    prompt: 'Attach prior dispute letter and bureau response for reference',
    warningIfMissing: 'Include copies of prior dispute correspondence for escalation letters.',
  },

  // Factual disputes - usually no documentation needed
  verification_required: {
    required: false,
    documentTypes: ['id_document', 'proof_of_address'],
    prompt: 'Standard disputes typically include ID and proof of address',
  },
  inaccurate_reporting: {
    required: false,
    documentTypes: ['id_document'],
    prompt: 'ID recommended but not required for accuracy disputes',
  },
  metro2_violation: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Include copy of credit report showing the violation',
  },
  incomplete_data: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Credit report copy showing missing fields is helpful',
  },
  missing_dofd: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Credit report showing missing DOFD field',
  },
  status_inconsistency: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Credit report showing inconsistent status codes',
  },
  balance_discrepancy: {
    required: false,
    documentTypes: ['credit_report', 'bank_statement'],
    prompt: 'Documentation showing correct balance',
  },
  obsolete: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Credit report showing item age/dates',
  },
  duplicate: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Credit report showing duplicate entries',
  },
  wrong_status: {
    required: false,
    documentTypes: ['correspondence'],
    prompt: 'Any documentation showing correct status',
  },
  wrong_dates: {
    required: false,
    documentTypes: ['correspondence', 'bank_statement'],
    prompt: 'Documentation showing correct dates',
  },
  unauthorized_inquiry: {
    required: false,
    documentTypes: ['id_document'],
    prompt: 'ID to confirm you did not authorize the inquiry',
  },
  never_late: {
    required: false,
    documentTypes: ['bank_statement', 'payment_receipt'],
    prompt: 'Payment history showing on-time payments',
    warningIfMissing: 'Payment documentation strongly supports "never late" claims.',
  },

  // Bureau discrepancy (new)
  bureau_discrepancy: {
    required: false,
    documentTypes: ['credit_report'],
    prompt: 'Include credit reports from multiple bureaus showing the discrepancy',
  },
};

// Get evidence requirements for a set of reason codes
export function getEvidenceRequirements(reasonCodes: string[]): {
  required: EvidenceRequirement[];
  recommended: EvidenceRequirement[];
  allDocumentTypes: DocumentType[];
  hasRequiredEvidence: boolean;
  warnings: string[];
} {
  const required: EvidenceRequirement[] = [];
  const recommended: EvidenceRequirement[] = [];
  const allDocumentTypes = new Set<DocumentType>();
  const warnings: string[] = [];

  for (const code of reasonCodes) {
    const req = EVIDENCE_REQUIREMENTS[code];
    if (!req) continue;

    // Collect all document types
    req.documentTypes.forEach(dt => allDocumentTypes.add(dt));

    if (req.required) {
      required.push(req);
      if (req.warningIfMissing) {
        warnings.push(req.warningIfMissing);
      }
    } else {
      recommended.push(req);
    }
  }

  return {
    required,
    recommended,
    allDocumentTypes: Array.from(allDocumentTypes),
    hasRequiredEvidence: required.length > 0,
    warnings,
  };
}

// Check if selected documents satisfy requirements
export function validateEvidenceSelection(
  reasonCodes: string[],
  selectedDocumentTypes: DocumentType[]
): {
  isValid: boolean;
  missingRequired: DocumentType[];
  missingRecommended: DocumentType[];
  messages: string[];
} {
  const { required, recommended } = getEvidenceRequirements(reasonCodes);
  const selectedSet = new Set(selectedDocumentTypes);
  
  const missingRequired: DocumentType[] = [];
  const missingRecommended: DocumentType[] = [];
  const messages: string[] = [];

  // Check required documents
  for (const req of required) {
    const hasSomeRequired = req.documentTypes.some(dt => selectedSet.has(dt));
    if (!hasSomeRequired) {
      missingRequired.push(...req.documentTypes);
      messages.push(`Required: ${req.prompt}`);
    }
  }

  // Check recommended documents (not blocking, just advisory)
  for (const req of recommended) {
    const hasSomeRecommended = req.documentTypes.some(dt => selectedSet.has(dt));
    if (!hasSomeRecommended && req.documentTypes.length > 0) {
      missingRecommended.push(...req.documentTypes);
    }
  }

  return {
    isValid: missingRequired.length === 0,
    missingRequired: [...new Set(missingRequired)],
    missingRecommended: [...new Set(missingRecommended)],
    messages,
  };
}

// Generate enclosure list for letter
export function generateEnclosureList(documentTypes: DocumentType[]): string[] {
  const enclosures: string[] = [];
  
  const typeToEnclosure: Record<DocumentType, string> = {
    id_document: 'Copy of government-issued identification',
    proof_of_address: 'Proof of current address',
    police_report: 'Police report (Report #[NUMBER])',
    ftc_identity_theft_report: 'FTC Identity Theft Report',
    bank_statement: 'Bank statement(s)',
    payment_receipt: 'Payment receipt/confirmation',
    correspondence: 'Relevant correspondence',
    credit_report: 'Copy of credit report',
    dispute_letter: 'Copy of prior dispute letter',
    other: 'Supporting documentation',
  };

  for (const dt of documentTypes) {
    if (typeToEnclosure[dt]) {
      enclosures.push(typeToEnclosure[dt]);
    }
  }

  return enclosures;
}

// Standard enclosures that should always be included
export const STANDARD_ENCLOSURES: DocumentType[] = ['id_document', 'proof_of_address'];

export function getStandardEnclosureText(): string {
  return `Enclosures:
- Copy of government-issued identification
- Proof of current address`;
}

export interface AuditReportData {
  client: {
    name: string;
    email: string;
    phone?: string | null;
  };
  scores: {
    transunion: number | null;
    experian: number | null;
    equifax: number | null;
  };
  negativeItems: Array<{
    itemType: string;
    creditorName: string;
    amount: number | null;
    riskSeverity: string;
    recommendedAction: string | null;
    bureau: string | null;
    dateReported?: Date | null;
  }>;
  accounts: Array<{
    creditorName: string;
    accountType: string | null;
    balance: number | null;
    creditLimit: number | null;
    isNegative: boolean;
    remarks?: string | null;
  }>;
  summary: {
    totalAccounts: number;
    openAccounts: number;
    totalDebt: number;
    totalCreditLimit: number;
    utilizationPercent: number | null;
    derogatoryCount: number;
    collectionsCount: number;
    latePaymentCount: number;
  };
  recommendations: string[];
  generatedAt: Date;
  companyInfo?: {
    name: string;
    phone: string;
    email: string;
    website?: string;
  };
  // Phase 4: Enhanced sections
  fcraComplianceItems?: Array<{
    itemType: string;
    creditorName: string;
    fcraExpirationDate: Date | null;
    daysUntilExpiration: number | null;
    isPastLimit: boolean;
    reportingLimitYears: number | null;
    bureau: string | null;
    notes: string | null;
  }>;
  bureauDiscrepancies?: Array<{
    discrepancyType: string;
    field: string | null;
    creditorName: string | null;
    valueTransunion: string | null;
    valueExperian: string | null;
    valueEquifax: string | null;
    severity: string | null;
    disputeRecommendation: string | null;
  }>;
  round1Strategy?: Array<{
    priority: number;
    itemType: string;
    creditorName: string;
    bureau: string | null;
    reason: string;
    fcraCode: string;
    disputeType: string;
  }>;
}

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getScoreRating(score: number | null): { label: string; color: string; bgColor: string } {
  if (!score) return { label: 'N/A', color: '#6b7280', bgColor: '#f3f4f6' };
  if (score >= 750) return { label: 'Excellent', color: '#059669', bgColor: '#d1fae5' };
  if (score >= 700) return { label: 'Good', color: '#10b981', bgColor: '#d1fae5' };
  if (score >= 650) return { label: 'Fair', color: '#f59e0b', bgColor: '#fef3c7' };
  if (score >= 600) return { label: 'Poor', color: '#f97316', bgColor: '#ffedd5' };
  return { label: 'Very Poor', color: '#ef4444', bgColor: '#fee2e2' };
}

function getSeverityStyle(severity: string): { color: string; bgColor: string } {
  switch (severity) {
    case 'severe': return { color: '#dc2626', bgColor: '#fee2e2' };
    case 'high': return { color: '#ea580c', bgColor: '#ffedd5' };
    case 'medium': return { color: '#d97706', bgColor: '#fef3c7' };
    case 'low': return { color: '#65a30d', bgColor: '#ecfccb' };
    default: return { color: '#6b7280', bgColor: '#f3f4f6' };
  }
}

function formatItemType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function calculateProjectedIncrease(negativeItems: AuditReportData['negativeItems']): number {
  let increase = 0;
  for (const item of negativeItems) {
    switch (item.itemType) {
      case 'collection': increase += 30; break;
      case 'charge_off': increase += 40; break;
      case 'late_payment': increase += 15; break;
      case 'bankruptcy': increase += 50; break;
      case 'foreclosure': increase += 45; break;
      case 'repossession': increase += 35; break;
      case 'judgment': increase += 35; break;
      case 'tax_lien': increase += 40; break;
      default: increase += 20;
    }
  }
  return Math.min(increase, 150); // Cap at 150 points
}

// FCRA Citation codes for dispute reasons
const FCRA_DISPUTE_CODES: Record<string, { code: string; citation: string; description: string }> = {
  past_reporting_limit: {
    code: 'FCRA-605',
    citation: '15 U.S.C. § 1681c',
    description: 'Item exceeds maximum reporting period under FCRA Section 605',
  },
  inaccurate_information: {
    code: 'FCRA-623',
    citation: '15 U.S.C. § 1681s-2',
    description: 'Furnisher duty to provide accurate information under FCRA Section 623',
  },
  unverifiable: {
    code: 'FCRA-611',
    citation: '15 U.S.C. § 1681i',
    description: 'Bureau must reinvestigate and delete unverifiable information under FCRA Section 611',
  },
  incomplete_information: {
    code: 'FCRA-623(a)(2)',
    citation: '15 U.S.C. § 1681s-2(a)(2)',
    description: 'Duty to correct and update incomplete information',
  },
  identity_theft: {
    code: 'FCRA-605B',
    citation: '15 U.S.C. § 1681c-2',
    description: 'Block of information resulting from identity theft',
  },
  cross_bureau_discrepancy: {
    code: 'FCRA-611(a)(1)',
    citation: '15 U.S.C. § 1681i(a)(1)',
    description: 'Reinvestigation required when information differs across bureaus',
  },
  obsolete_information: {
    code: 'FCRA-605(a)',
    citation: '15 U.S.C. § 1681c(a)',
    description: 'Obsolete information must not be reported',
  },
};

function getFcraCodeForItem(item: { itemType: string; isPastLimit?: boolean; hasDiscrepancy?: boolean }): { code: string; citation: string; description: string } {
  if (item.isPastLimit) {
    return FCRA_DISPUTE_CODES.past_reporting_limit;
  }
  if (item.hasDiscrepancy) {
    return FCRA_DISPUTE_CODES.cross_bureau_discrepancy;
  }
  // Default based on item type
  return FCRA_DISPUTE_CODES.inaccurate_information;
}

function getDisputeTypeForItem(itemType: string, isPastLimit: boolean): string {
  if (isPastLimit) return 'Obsolete Information - Request Immediate Deletion';
  
  switch (itemType.toLowerCase()) {
    case 'collection':
      return 'Debt Validation + Method of Verification';
    case 'charge_off':
      return 'Balance/Status Verification';
    case 'late_payment':
      return 'Payment History Accuracy Dispute';
    case 'bankruptcy':
      return 'Status/Discharge Date Verification';
    case 'inquiry':
      return 'Unauthorized Inquiry Removal';
    default:
      return 'General Accuracy Dispute';
  }
}

// Generate prioritized Round 1 strategy
export function generateRound1Strategy(data: AuditReportData): AuditReportData['round1Strategy'] {
  const strategy: NonNullable<AuditReportData['round1Strategy']> = [];
  
  // Priority 1: FCRA violations (past reporting limit)
  if (data.fcraComplianceItems) {
    for (const item of data.fcraComplianceItems) {
      if (item.isPastLimit) {
        const fcraInfo = getFcraCodeForItem({ itemType: item.itemType, isPastLimit: true });
        strategy.push({
          priority: 1,
          itemType: item.itemType,
          creditorName: item.creditorName,
          bureau: item.bureau,
          reason: `Past ${item.reportingLimitYears}-year FCRA limit - IMMEDIATE DELETION REQUIRED`,
          fcraCode: `${fcraInfo.code} - ${fcraInfo.citation}`,
          disputeType: 'Obsolete Information Dispute',
        });
      }
    }
  }
  
  // Priority 2: Cross-bureau discrepancies (high severity)
  if (data.bureauDiscrepancies) {
    for (const disc of data.bureauDiscrepancies) {
      if (disc.severity === 'high') {
        const fcraInfo = FCRA_DISPUTE_CODES.cross_bureau_discrepancy;
        strategy.push({
          priority: 2,
          itemType: disc.discrepancyType,
          creditorName: disc.creditorName || 'Multiple Items',
          bureau: 'All Three Bureaus',
          reason: `${formatItemType(disc.discrepancyType)} differs across bureaus`,
          fcraCode: `${fcraInfo.code} - ${fcraInfo.citation}`,
          disputeType: 'Method of Verification Request',
        });
      }
    }
  }
  
  // Priority 3: Collections (high-value targets)
  const collections = data.negativeItems.filter(i => i.itemType === 'collection');
  for (const item of collections.slice(0, 5)) {
    const fcraInfo = FCRA_DISPUTE_CODES.unverifiable;
    strategy.push({
      priority: 3,
      itemType: item.itemType,
      creditorName: item.creditorName,
      bureau: item.bureau,
      reason: 'Collection account - request debt validation',
      fcraCode: `${fcraInfo.code} - ${fcraInfo.citation}`,
      disputeType: getDisputeTypeForItem(item.itemType, false),
    });
  }
  
  // Priority 4: Charge-offs
  const chargeOffs = data.negativeItems.filter(i => i.itemType === 'charge_off');
  for (const item of chargeOffs.slice(0, 3)) {
    const fcraInfo = FCRA_DISPUTE_CODES.inaccurate_information;
    strategy.push({
      priority: 4,
      itemType: item.itemType,
      creditorName: item.creditorName,
      bureau: item.bureau,
      reason: 'Charge-off - verify balance and status accuracy',
      fcraCode: `${fcraInfo.code} - ${fcraInfo.citation}`,
      disputeType: getDisputeTypeForItem(item.itemType, false),
    });
  }
  
  // Priority 5: Late payments (if room in round)
  const latePayments = data.negativeItems.filter(i => i.itemType === 'late_payment');
  const remainingSlots = Math.max(0, 15 - strategy.length); // Cap total at 15 items
  for (const item of latePayments.slice(0, remainingSlots)) {
    const fcraInfo = FCRA_DISPUTE_CODES.incomplete_information;
    strategy.push({
      priority: 5,
      itemType: item.itemType,
      creditorName: item.creditorName,
      bureau: item.bureau,
      reason: 'Late payment - verify payment history accuracy',
      fcraCode: `${fcraInfo.code} - ${fcraInfo.citation}`,
      disputeType: getDisputeTypeForItem(item.itemType, false),
    });
  }
  
  return strategy.slice(0, 15); // Max 15 items per round
}

export function generateAuditReportHTML(data: AuditReportData): string {
  const validScores = [data.scores.transunion, data.scores.experian, data.scores.equifax]
    .filter((s): s is number => s !== null && s !== undefined);
  const avgScore = validScores.length > 0 
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null;
  
  const overallRating = getScoreRating(avgScore);
  const projectedIncrease = calculateProjectedIncrease(data.negativeItems);
  const projectedScore = avgScore ? avgScore + projectedIncrease : null;

  const companyInfo = data.companyInfo || {
    name: 'Top Tier Financial Solutions',
    phone: '(555) 123-4567',
    email: 'info@toptierfinancial.com',
    website: 'www.toptierfinancial.com',
  };

  // Group negative items by type
  const itemsByType = data.negativeItems.reduce((acc, item) => {
    const type = item.itemType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, typeof data.negativeItems>);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credit Audit Report - ${data.client.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: #0F172A; /* Deep Navy */
      --secondary: #C6A87C; /* Gold */
      --secondary-light: #E5D5BC;
      --text-dark: #0F131A;
      --text-light: #64748B;
      --bg-page: #F9F8F6; /* Warm Alabaster */
      --bg-card: #FFFFFF;
      --success: #059669;
      --warning: #D97706;
      --danger: #DC2626;
    }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background: var(--bg-page);
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Playfair Display', serif;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--bg-card);
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
      min-height: 100vh;
    }
    
    /* Header */
    .header {
      background: var(--primary);
      color: white;
      padding: 48px 56px;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(198, 168, 124, 0.15) 0%, transparent 70%);
      transform: translate(30%, -30%);
    }
    .header-content {
      position: relative;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo svg {
      width: 48px;
      height: 48px;
    }
    .brand-text h1 {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .brand-text p {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--secondary);
      margin-top: 4px;
    }
    .report-meta {
      text-align: right;
    }
    .report-badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(198, 168, 124, 0.3);
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--secondary);
      margin-bottom: 8px;
    }
    .report-date {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }

    /* Client Summary Bar */
    .client-summary {
      background: white;
      padding: 32px 56px;
      border-bottom: 1px solid #F1F5F9;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .client-details h2 {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 4px;
    }
    .client-contact {
      display: flex;
      gap: 24px;
      font-size: 14px;
      color: var(--text-light);
    }
    .client-contact span {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Section Styles */
    .section {
      padding: 40px 56px;
      border-bottom: 1px solid #F1F5F9;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .section-title::before {
      content: '';
      display: block;
      width: 4px;
      height: 24px;
      background: var(--secondary);
      border-radius: 2px;
    }

    /* Scores Grid */
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-bottom: 32px;
    }
    .score-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      border: 1px solid #E2E8F0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      position: relative;
      overflow: hidden;
    }
    .score-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
    }
    .score-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-light);
      font-weight: 600;
      margin-bottom: 12px;
    }
    .score-value {
      font-size: 48px;
      font-weight: 700;
      color: var(--primary);
      line-height: 1;
      margin-bottom: 8px;
      font-family: 'Playfair Display', serif;
    }
    .score-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Insights Grid */
    .insights-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .insight-card {
      background: #F8FAFC;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #E2E8F0;
    }
    .insight-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 4px;
      font-family: 'Playfair Display', serif;
    }
    .insight-label {
      font-size: 12px;
      color: var(--text-light);
      font-weight: 500;
    }

    /* Tables */
    .table-container {
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
      background: white;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #F8FAFC;
      padding: 16px 24px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-light);
      border-bottom: 1px solid #E2E8F0;
    }
    td {
      padding: 16px 24px;
      font-size: 14px;
      border-bottom: 1px solid #F1F5F9;
      color: var(--text-dark);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .creditor-name {
      font-weight: 600;
      color: var(--primary);
      display: block;
    }
    .creditor-sub {
      font-size: 12px;
      color: var(--text-light);
    }

    /* Projection Box */
    .projection-box {
      background: linear-gradient(135deg, var(--primary) 0%, #1e293b 100%);
      border-radius: 16px;
      padding: 32px;
      color: white;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .projection-box::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(198, 168, 124, 0.2) 0%, transparent 70%);
      transform: translate(30%, -30%);
    }
    .projection-content {
      position: relative;
      z-index: 1;
    }
    .projection-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--secondary);
      margin-bottom: 8px;
      font-weight: 600;
    }
    .projection-text {
      font-size: 24px;
      font-family: 'Playfair Display', serif;
      max-width: 400px;
    }
    .projection-score {
      position: relative;
      z-index: 1;
      text-align: center;
      background: rgba(255, 255, 255, 0.1);
      padding: 16px 32px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
    }
    .proj-val {
      font-size: 42px;
      font-weight: 700;
      color: var(--secondary);
      line-height: 1;
      font-family: 'Playfair Display', serif;
    }
    .proj-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 4px;
    }

    /* Recommendations */
    .rec-list {
      display: grid;
      gap: 12px;
    }
    .rec-item {
      background: #F8FAFC;
      border-left: 4px solid var(--success);
      padding: 16px 24px;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    /* Footer */
    .footer {
      background: var(--primary);
      color: white;
      padding: 48px 56px;
      text-align: center;
    }
    .footer-content {
      max-width: 600px;
      margin: 0 auto;
    }
    .footer-title {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      margin-bottom: 16px;
      color: var(--secondary);
    }
    .footer-contact {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 32px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
    }
    .footer-contact a {
      color: white;
      text-decoration: none;
      border-bottom: 1px solid var(--secondary);
      padding-bottom: 2px;
    }
    .disclaimer {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      line-height: 1.6;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-severe { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
    .badge-high { background: #FFF7ED; color: #EA580C; border: 1px solid #FED7AA; }
    .badge-medium { background: #FEFCE8; color: #CA8A04; border: 1px solid #FEF08A; }
    .badge-low { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }

    @media print {
      body { background: white; }
      .container { box-shadow: none; max-width: 100%; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .projection-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <div class="brand">
          <div class="brand-logo">
            <!-- Inline SVG Logo -->
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" style="fill: rgba(198, 168, 124, 0.1); stroke: #C6A87C;" stroke-width="2" stroke-linejoin="round"/>
              <path d="M24 11V37M13 17L24 11L35 17M13 25L24 31L35 25" style="stroke: #C6A87C;" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="24" cy="11" r="2" style="fill: #C6A87C;" />
              <circle cx="13" cy="17" r="2" style="fill: #C6A87C;" />
              <circle cx="35" cy="17" r="2" style="fill: #C6A87C;" />
            </svg>
          </div>
          <div class="brand-text">
            <h1>${companyInfo.name}</h1>
            <p>Premium Credit Consulting</p>
          </div>
        </div>
        <div class="report-meta">
          <div class="report-badge">Credit Audit Report</div>
          <div class="report-date">Generated on ${formatDate(data.generatedAt)}</div>
        </div>
      </div>
    </header>

    <!-- Client Summary -->
    <div class="client-summary">
      <div class="client-details">
        <h2>${data.client.name}</h2>
        <div class="client-contact">
          <span>📧 ${data.client.email}</span>
          ${data.client.phone ? `<span>📱 ${data.client.phone}</span>` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Overall Status</div>
        <div style="font-size: 18px; font-weight: 700; color: ${overallRating.color}; font-family: 'Playfair Display', serif;">
          ${overallRating.label} Credit
        </div>
      </div>
    </div>

    <!-- Credit Scores -->
    <div class="section">
      <div class="section-header">
        <h3 class="section-title">Credit Score Overview</h3>
      </div>
      <div class="scores-grid">
        <div class="score-card">
          <div class="score-label">TransUnion</div>
          <div class="score-value">${data.scores.transunion || '---'}</div>
          ${data.scores.transunion ? getScoreBadge(data.scores.transunion) : ''}
        </div>
        <div class="score-card">
          <div class="score-label">Experian</div>
          <div class="score-value">${data.scores.experian || '---'}</div>
          ${data.scores.experian ? getScoreBadge(data.scores.experian) : ''}
        </div>
        <div class="score-card">
          <div class="score-label">Equifax</div>
          <div class="score-value">${data.scores.equifax || '---'}</div>
          ${data.scores.equifax ? getScoreBadge(data.scores.equifax) : ''}
        </div>
      </div>

      <div class="insights-grid">
        <div class="insight-card">
          <div class="insight-value">${data.negativeItems.length}</div>
          <div class="insight-label">Negative Items</div>
        </div>
        <div class="insight-card">
          <div class="insight-value">${data.summary.collectionsCount}</div>
          <div class="insight-label">Collections</div>
        </div>
        <div class="insight-card">
          <div class="insight-value">${data.summary.utilizationPercent || 0}%</div>
          <div class="insight-label">Utilization</div>
        </div>
        <div class="insight-card">
          <div class="insight-value">${formatCurrency(data.summary.totalDebt)}</div>
          <div class="insight-label">Total Debt</div>
        </div>
      </div>
    </div>

    <!-- Projection -->
    ${projectedScore ? `
    <div class="section" style="padding-top: 0;">
      <div class="projection-box">
        <div class="projection-content">
          <div class="projection-title">Improvement Analysis</div>
          <div class="projection-text">
            Based on our audit, your potential credit score could reach new heights.
          </div>
        </div>
        <div class="projection-score">
          <div class="proj-val">${projectedScore}+</div>
          <div class="proj-label">Projected Score</div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Negative Items -->
    <div class="section">
      <div class="section-header">
        <h3 class="section-title">Items Requiring Attention</h3>
      </div>
      ${data.negativeItems.length > 0 ? `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Creditor / Type</th>
              <th>Bureau</th>
              <th>Amount</th>
              <th>Severity</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.negativeItems.map(item => {
              const severityClass = `badge-${item.riskSeverity}`;
              return `
              <tr>
                <td>
                  <span class="creditor-name">${item.creditorName}</span>
                  <span class="creditor-sub">${formatItemType(item.itemType)}</span>
                </td>
                <td>${item.bureau || 'All Bureaus'}</td>
                <td>${item.amount ? formatCurrency(item.amount) : '---'}</td>
                <td>
                  <span class="badge ${severityClass}">
                    ${item.riskSeverity}
                  </span>
                </td>
                <td>${item.recommendedAction ? formatItemType(item.recommendedAction) : 'Review'}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
      ` : '<p style="text-align: center; color: var(--success);">No negative items found. Excellent work!</p>'}
    </div>

    <!-- Recommendations -->
    ${data.recommendations.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <h3 class="section-title">Strategic Recommendations</h3>
      </div>
      <div class="rec-list">
        ${data.recommendations.map(rec => `
          <div class="rec-item">
            <span>•</span>
            <span>${rec}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${renderFcraComplianceSection(data)}
    ${renderDiscrepanciesSection(data)}
    ${renderRound1StrategySection(data)}

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-title">Ready to transform your credit?</div>
        <div class="footer-contact">
          <a href="tel:${companyInfo.phone}">${companyInfo.phone}</a>
          <a href="mailto:${companyInfo.email}">${companyInfo.email}</a>
          ${companyInfo.website ? `<a href="https://${companyInfo.website}" target="_blank">${companyInfo.website}</a>` : ''}
        </div>
        <div class="disclaimer">
          <p>© ${new Date().getFullYear()} ${companyInfo.name}. All rights reserved.</p>
          <p>This document contains confidential financial information. It is intended solely for the use of the individual to whom it is addressed. This report does not constitute legal or financial advice.</p>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

function getScoreBadge(score: number) {
  let color = '#64748B';
  let text = 'N/A';
  let bg = '#F1F5F9';
  
  if (score >= 750) { color = '#059669'; text = 'Excellent'; bg = '#ECFDF5'; }
  else if (score >= 700) { color = '#10B981'; text = 'Good'; bg = '#D1FAE5'; }
  else if (score >= 650) { color = '#D97706'; text = 'Fair'; bg = '#FEF3C7'; }
  else if (score >= 600) { color = '#EA580C'; text = 'Poor'; bg = '#FFEDD5'; }
  else { color = '#DC2626'; text = 'Very Poor'; bg = '#FEE2E2'; }

  return `<span class="score-status" style="background: ${bg}; color: ${color};">${text}</span>`;
}

// ... (Keep existing helper functions below: calculateProjectedScoreIncrease, renderFcraComplianceSection, etc.)


export function calculateProjectedScoreIncrease(negativeItems: AuditReportData['negativeItems']): number {
  return calculateProjectedIncrease(negativeItems);
}

// ============================================
// PHASE 4: ENHANCED REPORT SECTIONS
// ============================================

function renderFcraComplianceSection(data: AuditReportData): string {
  if (!data.fcraComplianceItems || data.fcraComplianceItems.length === 0) {
    return '';
  }
  
  const pastLimitItems = data.fcraComplianceItems.filter(i => i.isPastLimit);
  const nearExpiryItems = data.fcraComplianceItems.filter(i => 
    !i.isPastLimit && i.daysUntilExpiration !== null && i.daysUntilExpiration < 365
  );
  
  if (pastLimitItems.length === 0 && nearExpiryItems.length === 0) {
    return '';
  }
  
  return `
    <div class="section" style="background: #FEF2F2; border-bottom: 1px solid #FECACA;">
      <div class="section-header">
        <h3 class="section-title" style="color: var(--danger);">
          ⚠️ FCRA Compliance Issues
        </h3>
      </div>
      
      ${pastLimitItems.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h4 style="color: var(--danger); margin-bottom: 16px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <span>🚨</span> Items Past Reporting Limit
        </h4>
        <p style="font-size: 14px; color: var(--text-light); margin-bottom: 16px; background: white; padding: 12px; border-radius: 8px; border: 1px solid #FECACA;">
          <strong>Legal Note:</strong> Under FCRA Section 605 (15 U.S.C. § 1681c), these items have exceeded the maximum reporting period and must be removed immediately.
        </p>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Creditor</th>
                <th>Type</th>
                <th>Bureau</th>
                <th>Limit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${pastLimitItems.map(item => `
                <tr>
                  <td><span class="creditor-name">${item.creditorName}</span></td>
                  <td>${formatItemType(item.itemType)}</td>
                  <td>${item.bureau || 'All'}</td>
                  <td>${item.reportingLimitYears} years</td>
                  <td><span class="badge badge-severe">VIOLATION</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
      
      ${nearExpiryItems.length > 0 ? `
      <div>
        <h4 style="color: var(--warning); margin-bottom: 16px; font-size: 16px;">⏰ Items Expiring Soon</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Creditor</th>
                <th>Type</th>
                <th>Expires In</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              ${nearExpiryItems.slice(0, 5).map(item => `
                <tr>
                  <td><span class="creditor-name">${item.creditorName}</span></td>
                  <td>${formatItemType(item.itemType)}</td>
                  <td>${item.daysUntilExpiration} days</td>
                  <td>${item.daysUntilExpiration && item.daysUntilExpiration < 180 ? 'Wait or Dispute' : 'Dispute Now'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function renderDiscrepanciesSection(data: AuditReportData): string {
  if (!data.bureauDiscrepancies || data.bureauDiscrepancies.length === 0) {
    return '';
  }
  
  const highSeverity = data.bureauDiscrepancies.filter(d => d.severity === 'high');
  const mediumSeverity = data.bureauDiscrepancies.filter(d => d.severity === 'medium');
  const piiDiscrepancies = data.bureauDiscrepancies.filter(d => 
    d.discrepancyType === 'pii_name' || d.discrepancyType === 'pii_address'
  );
  
  return `
    <div class="section">
      <div class="section-header">
        <h3 class="section-title">Cross-Bureau Discrepancies</h3>
      </div>
      <div style="margin-bottom: 24px; padding: 16px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid var(--secondary);">
        <p style="font-size: 14px; color: var(--text-light);">
          <strong>Why this matters:</strong> Under FCRA Section 611 (15 U.S.C. § 1681i), bureaus must reinvestigate disputed information. When data conflicts across bureaus, it provides strong grounds for removal.
        </p>
      </div>
      
      ${highSeverity.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h4 style="color: var(--danger); margin-bottom: 16px; font-size: 16px;">High-Priority Discrepancies</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Creditor</th>
                <th>TransUnion</th>
                <th>Experian</th>
                <th>Equifax</th>
              </tr>
            </thead>
            <tbody>
              ${highSeverity.slice(0, 5).map(disc => `
                <tr>
                  <td><strong>${formatItemType(disc.discrepancyType)}</strong></td>
                  <td>${disc.creditorName || '---'}</td>
                  <td>${disc.valueTransunion || '---'}</td>
                  <td>${disc.valueExperian || '---'}</td>
                  <td>${disc.valueEquifax || '---'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
      
      ${piiDiscrepancies.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h4 style="color: var(--warning); margin-bottom: 16px; font-size: 16px;">Personal Information Errors</h4>
        <div style="background: #FFF7ED; padding: 20px; border-radius: 12px; border: 1px solid #FED7AA;">
          <p style="font-size: 14px; margin-bottom: 12px; color: #9A3412;">
            <strong>Warning:</strong> Discrepancies in names or addresses can indicate:
          </p>
          <ul style="font-size: 14px; margin-left: 24px; color: #C2410C; list-style-type: disc;">
            <li>Data entry errors by creditors</li>
            <li>Mixed files with another consumer</li>
            <li>Potential identity theft indicators</li>
          </ul>
        </div>
      </div>
      ` : ''}
      
      ${mediumSeverity.length > 0 ? `
      <div>
        <h4 style="color: var(--text-light); margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Additional Findings</h4>
        <p style="font-size: 14px; color: var(--text-dark);">
          ${mediumSeverity.length} additional discrepancies found (balance differences, dates, etc.) that can be used as secondary dispute points.
        </p>
      </div>
      ` : ''}
    </div>
  `;
}

function renderRound1StrategySection(data: AuditReportData): string {
  const strategy = data.round1Strategy || generateRound1Strategy(data);
  
  if (!strategy || strategy.length === 0) {
    return '';
  }
  
  return `
    <div class="section" style="background: #F1F5F9;">
      <div class="section-header">
        <h3 class="section-title">
          📋 Round 1 Dispute Strategy
        </h3>
      </div>
      <p style="font-size: 14px; color: var(--text-light); margin-bottom: 24px;">
        We have prioritized the following items for your first round of disputes based on FCRA violations and impact probability.
      </p>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Creditor</th>
              <th>Type</th>
              <th>Dispute Reason</th>
              <th>FCRA Code</th>
            </tr>
          </thead>
          <tbody>
            ${strategy.map((item, idx) => `
              <tr>
                <td style="text-align: center;">
                  <span style="
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 24px; height: 24px; border-radius: 50%; 
                    background: ${item.priority === 1 ? 'var(--danger)' : 'var(--primary)'}; 
                    color: white; font-size: 12px; font-weight: 700;
                  ">${idx + 1}</span>
                </td>
                <td>
                  <span class="creditor-name">${item.creditorName}</span>
                  <span class="creditor-sub">${item.bureau || 'All Bureaus'}</span>
                </td>
                <td>${formatItemType(item.itemType)}</td>
                <td style="font-size: 13px;">${item.reason}</td>
                <td><code style="background: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: var(--primary);">${item.fcraCode}</code></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 24px; padding: 20px; background: white; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <p style="font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--primary);">💡 Strategy Note</p>
        <ul style="font-size: 14px; color: var(--text-light); margin-left: 20px; list-style-type: disc;">
          <li>Priority 1 items represent clear FCRA violations and should be removed immediately upon dispute.</li>
          <li>We cite specific FCRA codes in every letter to ensure bureaus process them as legal disputes, not generic complaints.</li>
          <li>Bureaus have 30 days to investigate from the date they receive your letter.</li>
        </ul>
      </div>
    </div>
  `;
}

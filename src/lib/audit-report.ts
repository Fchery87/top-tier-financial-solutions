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
  }>;
  accounts: Array<{
    creditorName: string;
    accountType: string | null;
    balance: number | null;
    creditLimit: number | null;
    isNegative: boolean;
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
      padding: 32px 40px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .report-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.9;
    }
    .client-info {
      display: flex;
      gap: 32px;
      font-size: 14px;
      opacity: 0.9;
    }
    .section {
      padding: 32px 40px;
      border-bottom: 1px solid #e5e7eb;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .score-card {
      text-align: center;
      padding: 20px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .score-bureau {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .score-value {
      font-size: 36px;
      font-weight: 700;
      color: #1e293b;
    }
    .overall-rating {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .rating-label {
      font-size: 24px;
      font-weight: 600;
    }
    .rating-badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }
    .issues-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .issue-stat {
      text-align: center;
      padding: 16px;
      border-radius: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }
    .issue-stat.warning { background: #fffbeb; border-color: #fde68a; }
    .issue-stat.info { background: #eff6ff; border-color: #bfdbfe; }
    .issue-count {
      font-size: 28px;
      font-weight: 700;
      color: #dc2626;
    }
    .issue-stat.warning .issue-count { color: #d97706; }
    .issue-stat.info .issue-count { color: #2563eb; }
    .issue-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-top: 4px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .items-table th {
      text-align: left;
      padding: 12px;
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .severity-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .action-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background: #dbeafe;
      color: #1d4ed8;
    }
    .projection-box {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
    }
    .projection-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
      margin-bottom: 12px;
    }
    .projection-scores {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      font-size: 32px;
      font-weight: 700;
    }
    .projection-arrow {
      font-size: 24px;
    }
    .projection-increase {
      font-size: 14px;
      margin-top: 8px;
      opacity: 0.9;
    }
    .recommendations-list {
      list-style: none;
    }
    .recommendations-list li {
      padding: 12px 16px;
      margin-bottom: 8px;
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
    }
    .cta-section {
      background: #1e293b;
      color: white;
      padding: 32px 40px;
      text-align: center;
    }
    .cta-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .cta-subtitle {
      opacity: 0.8;
      margin-bottom: 20px;
    }
    .cta-contact {
      display: flex;
      justify-content: center;
      gap: 32px;
      font-size: 14px;
    }
    .cta-contact a {
      color: #fbbf24;
      text-decoration: none;
    }
    .footer {
      padding: 16px 40px;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      background: #f9fafb;
    }
    .utilization-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .utilization-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      .cta-section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <div>
          <div class="company-name">${companyInfo.name}</div>
          <div class="report-title">Credit Audit Report</div>
        </div>
        <div style="text-align: right; font-size: 13px;">
          <div>Report Generated</div>
          <div style="font-weight: 600;">${formatDate(data.generatedAt)}</div>
        </div>
      </div>
      <div class="client-info">
        <div><strong>Client:</strong> ${data.client.name}</div>
        <div><strong>Email:</strong> ${data.client.email}</div>
        ${data.client.phone ? `<div><strong>Phone:</strong> ${data.client.phone}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Credit Score Summary</div>
      <div class="scores-grid">
        <div class="score-card">
          <div class="score-bureau">TransUnion</div>
          <div class="score-value">${data.scores.transunion || '---'}</div>
        </div>
        <div class="score-card">
          <div class="score-bureau">Experian</div>
          <div class="score-value">${data.scores.experian || '---'}</div>
        </div>
        <div class="score-card">
          <div class="score-bureau">Equifax</div>
          <div class="score-value">${data.scores.equifax || '---'}</div>
        </div>
      </div>
      <div class="overall-rating" style="background: ${overallRating.bgColor};">
        <span class="rating-label" style="color: ${overallRating.color};">Overall Rating:</span>
        <span class="rating-badge" style="background: ${overallRating.color}; color: white;">
          ${overallRating.label}
        </span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Issues Identified</div>
      <div class="issues-summary">
        <div class="issue-stat">
          <div class="issue-count">${data.negativeItems.length}</div>
          <div class="issue-label">Total Issues</div>
        </div>
        <div class="issue-stat">
          <div class="issue-count">${data.summary.collectionsCount}</div>
          <div class="issue-label">Collections</div>
        </div>
        <div class="issue-stat warning">
          <div class="issue-count">${data.summary.latePaymentCount}</div>
          <div class="issue-label">Late Payments</div>
        </div>
        <div class="issue-stat info">
          <div class="issue-count">${data.summary.derogatoryCount}</div>
          <div class="issue-label">Derogatory</div>
        </div>
      </div>

      ${data.negativeItems.length > 0 ? `
      <table class="items-table">
        <thead>
          <tr>
            <th>Creditor</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Severity</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.negativeItems.slice(0, 10).map(item => {
            const severity = getSeverityStyle(item.riskSeverity);
            return `
            <tr>
              <td><strong>${item.creditorName}</strong></td>
              <td>${formatItemType(item.itemType)}</td>
              <td>${item.amount ? formatCurrency(item.amount) : '---'}</td>
              <td>
                <span class="severity-badge" style="background: ${severity.bgColor}; color: ${severity.color};">
                  ${item.riskSeverity.toUpperCase()}
                </span>
              </td>
              <td>
                <span class="action-badge">${item.recommendedAction ? formatItemType(item.recommendedAction) : 'Review'}</span>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
      ${data.negativeItems.length > 10 ? `<p style="margin-top: 12px; color: #6b7280; font-size: 13px;">+ ${data.negativeItems.length - 10} more items</p>` : ''}
      ` : '<p style="color: #059669; text-align: center; padding: 20px;">No negative items found. Your credit report is clean!</p>'}
    </div>

    <div class="section">
      <div class="section-title">Account Overview</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${data.summary.totalAccounts}</div>
          <div style="font-size: 12px; color: #64748b;">Total Accounts</div>
        </div>
        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${formatCurrency(data.summary.totalDebt)}</div>
          <div style="font-size: 12px; color: #64748b;">Total Debt</div>
        </div>
        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: ${(data.summary.utilizationPercent || 0) > 30 ? '#dc2626' : '#059669'};">
            ${data.summary.utilizationPercent || 0}%
          </div>
          <div style="font-size: 12px; color: #64748b;">Credit Utilization</div>
        </div>
      </div>
      <div style="padding: 12px; background: #f8fafc; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>Credit Utilization</span>
          <span>${data.summary.utilizationPercent || 0}% of ${formatCurrency(data.summary.totalCreditLimit)}</span>
        </div>
        <div class="utilization-bar">
          <div class="utilization-fill" style="width: ${Math.min(data.summary.utilizationPercent || 0, 100)}%; background: ${(data.summary.utilizationPercent || 0) > 50 ? '#dc2626' : (data.summary.utilizationPercent || 0) > 30 ? '#f59e0b' : '#22c55e'};"></div>
        </div>
      </div>
    </div>

    ${projectedScore ? `
    <div class="section">
      <div class="section-title">Potential Improvement</div>
      <div class="projection-box">
        <div class="projection-title">Estimated Score After Credit Repair</div>
        <div class="projection-scores">
          <span>${avgScore}</span>
          <span class="projection-arrow">→</span>
          <span>${projectedScore}+</span>
        </div>
        <div class="projection-increase">Up to +${projectedIncrease} points possible</div>
      </div>
    </div>
    ` : ''}

    ${data.recommendations.length > 0 ? `
    <div class="section">
      <div class="section-title">Recommended Action Plan</div>
      <ul class="recommendations-list">
        ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div class="cta-section">
      <div class="cta-title">Ready to Improve Your Credit?</div>
      <div class="cta-subtitle">Our team is ready to help you dispute inaccuracies and repair your credit.</div>
      <div class="cta-contact">
        <div>📞 <a href="tel:${companyInfo.phone}">${companyInfo.phone}</a></div>
        <div>📧 <a href="mailto:${companyInfo.email}">${companyInfo.email}</a></div>
        ${companyInfo.website ? `<div>🌐 ${companyInfo.website}</div>` : ''}
      </div>
    </div>

    <div class="footer">
      <p>This report is for informational purposes only and does not constitute financial advice.</p>
      <p>© ${new Date().getFullYear()} ${companyInfo.name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export function calculateProjectedScoreIncrease(negativeItems: AuditReportData['negativeItems']): number {
  return calculateProjectedIncrease(negativeItems);
}

// Credit Analysis Report Generator
// Comprehensive report matching the PHP Twig template format
// Includes: Cover Page, Welcome Letter, Credit Basics, Scores Summary, Account Analysis, Process Overview, Client Role

import type { BureauSummary, BureauPersonalInfo, DerogatoryAccount, PublicRecord, BureauCreditUtilization, PersonalInfoDisputeItem } from './parsers/pdf-parser';

export interface CreditAnalysisReportData {
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  reportDate: string;
  bureauSummary: BureauSummary;
  bureauPersonalInfo?: BureauPersonalInfo;
  personalInfoDisputes?: PersonalInfoDisputeItem[];
  creditUtilization: BureauCreditUtilization;
  derogatoryAccounts: DerogatoryAccount[];
  publicRecords: PublicRecord[];
  inquiries: Array<{
    creditorName: string;
    inquiryDate?: Date;
    bureau?: string;
    inquiryType?: string;
  }>;
  companyInfo: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    email: string;
    phone: string;
    officePhone: string;
    fax: string;
    website: string;
    preparedBy: string;
  };
}

const DEFAULT_COMPANY_INFO = {
  name: 'Top Tier Financial Solutions',
  address: '2141 Cortelyou Road',
  city: 'Brooklyn',
  state: 'NY',
  zip: '11226',
  email: 'info@toptierfinancialsolutions.com',
  phone: '(347) 699-4664',
  officePhone: '(800) 478-7119',
  fax: '(718) 489-4145',
  website: 'https://www.toptierfinancialsolutions.com',
  preparedBy: 'Frantz Chery',
};

function formatCurrency(cents: number | null | undefined): string {
  if (!cents) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function getUtilizationImage(percent: number): string {
  if (percent >= 75) return 'very-poor';
  if (percent >= 50) return 'poor';
  if (percent >= 30) return 'fair';
  if (percent >= 10) return 'good';
  return 'excellent';
}

// Check if values differ across bureaus (for highlighting discrepancies)
function hasDiscrepancy(tu?: string, exp?: string, eq?: string): boolean {
  const values = [tu, exp, eq].filter(v => v && v !== '-' && v.trim() !== '');
  if (values.length <= 1) return false;
  const normalized = values.map(v => v?.toLowerCase().trim());
  return new Set(normalized).size > 1;
}

function renderPersonalInformationSection(data: CreditAnalysisReportData): string {
  const personalInfo = data.bureauPersonalInfo;
  
  if (!personalInfo) {
    return '';
  }

  // Check for discrepancies
  const nameDiscrepancy = hasDiscrepancy(
    personalInfo.transunion.name,
    personalInfo.experian.name,
    personalInfo.equifax.name
  );
  const dobDiscrepancy = hasDiscrepancy(
    personalInfo.transunion.dateOfBirth,
    personalInfo.experian.dateOfBirth,
    personalInfo.equifax.dateOfBirth
  );
  const addressDiscrepancy = hasDiscrepancy(
    personalInfo.transunion.currentAddress,
    personalInfo.experian.currentAddress,
    personalInfo.equifax.currentAddress
  );

  const hasAnyDiscrepancy = nameDiscrepancy || dobDiscrepancy || addressDiscrepancy;

  // Collect all previous addresses and employers
  const tuPrevAddresses = personalInfo.transunion.previousAddresses || [];
  const expPrevAddresses = personalInfo.experian.previousAddresses || [];
  const eqPrevAddresses = personalInfo.equifax.previousAddresses || [];
  const maxPrevAddresses = Math.max(tuPrevAddresses.length, expPrevAddresses.length, eqPrevAddresses.length);

  const tuEmployers = personalInfo.transunion.employers || [];
  const expEmployers = personalInfo.experian.employers || [];
  const eqEmployers = personalInfo.equifax.employers || [];
  const maxEmployers = Math.max(tuEmployers.length, expEmployers.length, eqEmployers.length);

  const tuAkas = personalInfo.transunion.alsoKnownAs || [];
  const expAkas = personalInfo.experian.alsoKnownAs || [];
  const eqAkas = personalInfo.equifax.alsoKnownAs || [];
  const maxAkas = Math.max(tuAkas.length, expAkas.length, eqAkas.length);

  return `
    <h3>Personal Information</h3>
    <p>The credit bureaus maintain personal information about you. Discrepancies across bureaus can indicate data entry errors, mixed credit files, or potential identity theft. Under Metro 2 compliance, furnishers must report accurate consumer information.</p>
    
    ${hasAnyDiscrepancy ? `
    <div class="info-box warning" style="margin-bottom: 20px;">
      <strong>⚠️ Discrepancies Detected</strong>
      <p style="margin-top: 8px;">We found differences in your personal information across bureaus. This may indicate:</p>
      <ul style="margin-left: 20px; margin-top: 8px;">
        ${nameDiscrepancy ? '<li>Name variations that could affect credit matching</li>' : ''}
        ${dobDiscrepancy ? '<li>Date of birth discrepancies that may indicate mixed files</li>' : ''}
        ${addressDiscrepancy ? '<li>Address differences that could impact identity verification</li>' : ''}
      </ul>
      <p style="margin-top: 8px;"><strong>Recommendation:</strong> These items should be reviewed and potentially disputed to ensure accurate reporting.</p>
    </div>
    ` : ''}
    
    <table class="summary-table">
      <thead>
        <tr>
          <th>Field</th>
          <th class="text-center">TransUnion</th>
          <th class="text-center">Experian</th>
          <th class="text-center">Equifax</th>
        </tr>
      </thead>
      <tbody>
        <tr style="${nameDiscrepancy ? 'background: #FEF3C7;' : ''}">
          <td><strong>Name</strong>${nameDiscrepancy ? ' ⚠️' : ''}</td>
          <td class="text-center">${personalInfo.transunion.name || '-'}</td>
          <td class="text-center">${personalInfo.experian.name || '-'}</td>
          <td class="text-center">${personalInfo.equifax.name || '-'}</td>
        </tr>
        <tr style="${dobDiscrepancy ? 'background: #FEF3C7;' : ''}">
          <td><strong>Date of Birth</strong>${dobDiscrepancy ? ' ⚠️' : ''}</td>
          <td class="text-center">${personalInfo.transunion.dateOfBirth || '-'}</td>
          <td class="text-center">${personalInfo.experian.dateOfBirth || '-'}</td>
          <td class="text-center">${personalInfo.equifax.dateOfBirth || '-'}</td>
        </tr>
        <tr style="${addressDiscrepancy ? 'background: #FEF3C7;' : ''}">
          <td><strong>Current Address</strong>${addressDiscrepancy ? ' ⚠️' : ''}</td>
          <td class="text-center" style="font-size: 9pt;">${personalInfo.transunion.currentAddress || '-'}</td>
          <td class="text-center" style="font-size: 9pt;">${personalInfo.experian.currentAddress || '-'}</td>
          <td class="text-center" style="font-size: 9pt;">${personalInfo.equifax.currentAddress || '-'}</td>
        </tr>
        ${maxPrevAddresses > 0 ? Array.from({ length: maxPrevAddresses }, (_, i) => `
        <tr>
          <td>${i === 0 ? '<strong>Previous Addresses</strong>' : ''}</td>
          <td class="text-center" style="font-size: 9pt;">${tuPrevAddresses[i] || '-'}</td>
          <td class="text-center" style="font-size: 9pt;">${expPrevAddresses[i] || '-'}</td>
          <td class="text-center" style="font-size: 9pt;">${eqPrevAddresses[i] || '-'}</td>
        </tr>
        `).join('') : ''}
        ${maxEmployers > 0 ? Array.from({ length: maxEmployers }, (_, i) => `
        <tr>
          <td>${i === 0 ? '<strong>Employers</strong>' : ''}</td>
          <td class="text-center">${tuEmployers[i] || '-'}</td>
          <td class="text-center">${expEmployers[i] || '-'}</td>
          <td class="text-center">${eqEmployers[i] || '-'}</td>
        </tr>
        `).join('') : ''}
        ${maxAkas > 0 ? Array.from({ length: maxAkas }, (_, i) => `
        <tr>
          <td>${i === 0 ? '<strong>Also Known As</strong>' : ''}</td>
          <td class="text-center">${tuAkas[i] || '-'}</td>
          <td class="text-center">${expAkas[i] || '-'}</td>
          <td class="text-center">${eqAkas[i] || '-'}</td>
        </tr>
        `).join('') : ''}
      </tbody>
    </table>
    
    <div class="info-box tip" style="margin-top: 20px;">
      <strong>Why Personal Information Matters</strong>
      <p style="margin-top: 8px;">Under Metro 2 guidelines, credit bureaus must maintain accurate consumer identifying information. Incorrect names, addresses, or birthdates can:</p>
      <ul style="margin-left: 20px; margin-top: 8px;">
        <li>Cause accounts to be incorrectly matched to your file</li>
        <li>Lead to mixed credit files with another consumer</li>
        <li>Trigger fraud alerts or identity verification failures</li>
        <li>Affect your ability to obtain credit, employment, or housing</li>
      </ul>
    </div>
  `;
}

export function generateCreditAnalysisReportHTML(data: CreditAnalysisReportData): string {
  const company = { ...DEFAULT_COMPANY_INFO, ...data.companyInfo };
  const { client, bureauSummary, creditUtilization, derogatoryAccounts, publicRecords, inquiries } = data;
  
  const fullName = `${client.firstName} ${client.lastName}`;
  const reportDate = formatDate(data.reportDate);
  
  // Calculate totals
  const derogatoryTotal = derogatoryAccounts.length;
  const publicRecordsTotal = publicRecords.length;
  const inquiriesTotal = inquiries.length;
  


  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credit Analysis Report - ${fullName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    :root {
      --primary: #0F172A;
      --secondary: #C6A87C;
      --secondary-light: #E5D5BC;
      --text-dark: #0F131A;
      --text-light: #64748B;
      --bg-page: #F9F8F6;
      --bg-card: #FFFFFF;
      --success: #059669;
      --warning: #D97706;
      --danger: #DC2626;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: var(--text-dark);
      background: var(--bg-page);
      -webkit-font-smoothing: antialiased;
    }
    
    .container {
      max-width: 8.5in;
      margin: 0 auto;
      background: var(--bg-card);
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
    }
    
    .page {
      padding: 40px 56px;
    }
    
    .page-break {
      page-break-after: always;
      height: 0;
    }
    
    /* Typography */
    h1, h2, h3, h4, h5 {
      font-family: 'Playfair Display', serif;
      color: var(--primary);
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    h1 { font-size: 2em; }
    h2 { 
      font-size: 1.5em; 
      padding-bottom: 12px; 
      margin-top: 32px;
      margin-bottom: 24px;
      border-bottom: none;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    h2::before {
      content: '';
      display: block;
      width: 4px;
      height: 28px;
      background: var(--secondary);
      border-radius: 2px;
    }
    h3 { font-size: 1.25em; color: var(--primary); }
    h4 { font-size: 1.1em; color: var(--text-dark); }
    h5 { font-size: 1em; color: var(--text-dark); margin-top: 16px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; }
    
    p {
      margin-bottom: 12px;
      text-align: justify;
    }
    
    ol, ul {
      margin: 12px 0 12px 24px;
    }
    
    li {
      margin-bottom: 6px;
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
      color: white;
      margin-bottom: 0;
    }
    .brand-text p {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--secondary);
      margin-top: 4px;
      margin-bottom: 0;
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
    
    /* Cover Page */
    .cover-page {
      text-align: center;
      padding: 80px 56px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-page) 100%);
    }
    
    .logo-container {
      margin-bottom: 48px;
    }
    
    .logo-svg {
      width: 80px;
      height: 80px;
      margin-bottom: 24px;
    }
    
    .company-name {
      font-family: 'Playfair Display', serif;
      font-size: 2.5em;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -1px;
    }
    
    .company-tagline {
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: var(--secondary);
      font-weight: 600;
    }
    
    .report-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.5em;
      color: var(--text-light);
      margin: 48px 0;
      font-weight: 400;
    }
    
    .prepared-for {
      font-style: italic;
      color: var(--text-light);
      margin-bottom: 8px;
    }
    
    .client-name {
      font-family: 'Playfair Display', serif;
      font-size: 2.2em;
      color: var(--primary);
      font-weight: 700;
    }
    
    .report-date-cover {
      margin-top: 16px;
      color: var(--text-light);
      font-size: 14px;
    }
    
    .prepared-by-section {
      margin-top: 60px;
      padding: 32px 48px;
      background: var(--bg-page);
      border-radius: 16px;
      border: 1px solid #E2E8F0;
      display: inline-block;
    }
    
    .prepared-by-section p {
      text-align: center;
      margin: 4px 0;
      font-size: 13px;
    }
    
    /* Tables */
    .table-container {
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
      background: white;
      margin: 20px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    
    thead th {
      background: var(--primary);
      color: #fff;
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    tbody td {
      padding: 14px 16px;
      border-bottom: 1px solid #F1F5F9;
      vertical-align: top;
    }
    
    tbody tr:nth-child(even) {
      background: #F8FAFC;
    }
    
    tbody tr:last-child td {
      border-bottom: none;
    }
    
    .text-center {
      text-align: center;
    }
    
    /* Score Cards */
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 24px 0;
    }
    
    .score-card {
      text-align: center;
      padding: 28px 20px;
      background: white;
      border-radius: 16px;
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
    
    .score-bureau {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--text-light);
      font-weight: 600;
      margin-bottom: 12px;
    }
    
    .score-value {
      font-family: 'Playfair Display', serif;
      font-size: 3em;
      font-weight: 700;
      color: var(--primary);
      line-height: 1;
    }
    
    .score-label {
      font-size: 12px;
      color: var(--secondary);
      margin-top: 8px;
      font-weight: 600;
    }
    
    /* Summary Table */
    .summary-table {
      margin: 20px 0;
    }
    
    .summary-table th {
      background: var(--primary);
    }
    
    .summary-table td:first-child {
      font-weight: 600;
      color: var(--primary);
    }
    
    /* Derogatory Items */
    .derogatory-table td {
      font-size: 9pt;
    }
    
    .issue-tag {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    
    .issue-late { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
    .issue-collection { background: #FFF7ED; color: #EA580C; border: 1px solid #FED7AA; }
    .issue-chargeoff { background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; }
    
    /* Utilization */
    .utilization-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    
    .utilization-card {
      padding: 20px;
      background: white;
      border-radius: 12px;
      text-align: center;
      border: 1px solid #E2E8F0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }
    
    .utilization-card p {
      margin-bottom: 8px;
    }
    
    .utilization-percent {
      font-family: 'Playfair Display', serif;
      font-size: 2em;
      font-weight: 700;
    }
    
    .utilization-excellent { color: var(--success); }
    .utilization-good { color: #10B981; }
    .utilization-fair { color: var(--warning); }
    .utilization-poor { color: #EA580C; }
    .utilization-very-poor { color: var(--danger); }
    
    .utilization-bar {
      height: 6px;
      background: #E2E8F0;
      border-radius: 3px;
      overflow: hidden;
      margin-top: 12px;
    }
    
    .utilization-fill {
      height: 100%;
      border-radius: 3px;
    }
    
    /* Info Boxes */
    .info-box {
      padding: 20px 24px;
      margin: 20px 0;
      border-radius: 12px;
      border-left: 4px solid;
    }
    
    .info-box p {
      margin-bottom: 0;
    }
    
    .info-box.tip {
      background: #ECFDF5;
      border-color: var(--success);
    }
    
    .info-box.warning {
      background: #FFFBEB;
      border-color: var(--warning);
    }
    
    .info-box.important {
      background: #FEF2F2;
      border-color: var(--danger);
    }
    
    /* Car Comparison */
    .car-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin: 24px 0;
      text-align: center;
    }
    
    .car-comparison .person {
      padding: 24px;
      border-radius: 12px;
    }
    
    .car-comparison .person h4 {
      margin-bottom: 16px;
    }
    
    .car-comparison .person p {
      margin-bottom: 6px;
      text-align: center;
    }
    
    .car-comparison .person-a {
      background: #ECFDF5;
      border: 2px solid var(--success);
    }
    
    .car-comparison .person-b {
      background: #FEF2F2;
      border: 2px solid var(--danger);
    }
    
    .difference-highlight {
      background: var(--primary);
      color: #fff;
      padding: 28px;
      border-radius: 12px;
      text-align: center;
      margin: 24px 0;
      position: relative;
      overflow: hidden;
    }
    
    .difference-highlight::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(198, 168, 124, 0.2) 0%, transparent 70%);
      transform: translate(30%, -30%);
    }
    
    .difference-amount {
      font-family: 'Playfair Display', serif;
      font-size: 2.5em;
      font-weight: 700;
      color: var(--secondary);
      position: relative;
    }
    
    /* Credit Graph */
    .credit-factors {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    
    .credit-factor {
      padding: 20px 12px;
      background: white;
      border-radius: 12px;
      text-align: center;
      border: 1px solid #E2E8F0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }
    
    .credit-factor p {
      margin-bottom: 4px;
      text-align: center;
    }
    
    .credit-factor-percent {
      font-family: 'Playfair Display', serif;
      font-size: 1.5em;
      font-weight: 700;
      color: var(--secondary);
    }
    
    /* Footer */
    .section-footer {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #E2E8F0;
      text-align: center;
      font-size: 0.85em;
      color: var(--text-light);
    }
    
    /* CTA Section */
    .cta-section {
      background: var(--primary);
      color: #fff;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      margin: 32px 0;
      position: relative;
      overflow: hidden;
    }
    
    .cta-section::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(198, 168, 124, 0.15) 0%, transparent 70%);
      transform: translate(30%, -30%);
    }
    
    .cta-section h3 {
      font-family: 'Playfair Display', serif;
      color: var(--secondary);
      margin-bottom: 12px;
      font-size: 1.5em;
      position: relative;
    }
    
    .cta-section p {
      position: relative;
      text-align: center;
    }
    
    .cta-contact {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-top: 24px;
      flex-wrap: wrap;
      position: relative;
    }
    
    .cta-contact a {
      color: var(--secondary);
      text-decoration: none;
      font-weight: 500;
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
    .footer p {
      text-align: center;
    }
    
    /* Print Styles */
    @media print {
      body {
        font-size: 10pt;
        background: white;
      }
      
      .container {
        box-shadow: none;
      }
      
      .page {
        padding: 20px 40px;
      }
      
      .page-break {
        page-break-after: always;
      }
      
      .score-card, .header, .cta-section, .difference-highlight, thead th {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .cover-page {
        min-height: auto;
        padding: 60px 40px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- COVER PAGE -->
    <div class="cover-page">
      <div class="logo-container">
        <svg class="logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="48" rx="8" fill="#0F172A"/>
          <path d="M14 16H34V19H26V34H22V19H14V16Z" fill="#C6A87C"/>
          <path d="M14 34V31H34V34H14Z" fill="#C6A87C" opacity="0.6"/>
        </svg>
        <div class="company-name">Top Tier</div>
        <div class="company-tagline">Financial Solutions</div>
      </div>
      
      <div class="report-title">Credit Analysis Report</div>
      
      <p class="prepared-for">Prepared for</p>
      <div class="client-name">${fullName}</div>
      <p class="report-date-cover">${reportDate}</p>
      
      <div class="prepared-by-section">
        <p class="prepared-for">Prepared by</p>
        <p><strong>${company.preparedBy}</strong></p>
        <p>${company.name}</p>
        <p>${company.address}</p>
        <p>${company.city}, ${company.state} ${company.zip}</p>
        <p>${company.email}</p>
        <p>Office: ${company.officePhone}</p>
        <p>Phone: ${company.phone}</p>
        <p>Fax: ${company.fax}</p>
        <p>${company.website}</p>
      </div>
    </div>
    
    <div class="page-break"></div>
    
    <!-- WELCOME LETTER -->
    <p><strong>Dear ${fullName},</strong></p>
    
    <p>On behalf of Top Tier Financial Solutions, I would like to extend a warm welcome to you as our valued client. We are delighted to have the opportunity to work with you on your credit restoration journey.</p>
    
    <p>First and foremost, thank you for choosing us to handle your credit needs. Your trust is our driving force. As we begin this journey together, please remember that regardless of your current credit situation, our aim is to make your credit improvement process as smooth and pleasant as possible. And remember - bad credit is no laughing matter, but it <em>is</em> fixable!</p>
    
    <h5>Key Points About Your Credit Audit:</h5>
    <ol>
      <li>This information is specifically tailored to <strong>your</strong> credit profile</li>
      <li>The insights provided are based on extensive research and expertise in the credit industry</li>
      <li>The audit will outline tasks for both you and Top Tier Financial Solutions to complete</li>
      <li>We encourage you to educate yourself on your credit - knowledge is power</li>
    </ol>
    
    <p>This credit analysis report gives you a comprehensive overview of how potential lenders view your credit today. It identifies the factors negatively impacting your score and explains our legal strategies to improve it. Additionally, it includes a step-by-step plan for accelerating the process.</p>
    
    <h5>This Report is Organized Into Five Sections:</h5>
    <ol>
      <li><strong>Credit Score Basics</strong> - Understanding how credit works</li>
      <li><strong>Your Credit Scores and Summary</strong> - Your current standing</li>
      <li><strong>Analysis of Your Accounts</strong> - Detailed breakdown of issues</li>
      <li><strong>An Overview of Our Process</strong> - How we'll help you</li>
      <li><strong>Your Role in the Process</strong> - What you can do to help</li>
    </ol>
    
    <p>Our dedicated team at Top Tier Financial Solutions is committed to supporting you every step of the way. After this audit, we will begin working on your file based on the insights gathered. Upon completion, you will have various opportunities to continue working with us for further credit enhancement.</p>
    
    <p>If you have any questions during the process, please feel free to reach out. Our mission is to help you achieve your financial goals. Your success is our priority.</p>
    
    <ul>
      <li>Email: ${company.email}</li>
      <li>Office: ${company.officePhone}</li>
      <li>Phone: ${company.phone}</li>
      <li>Fax: ${company.fax}</li>
      <li>Website: ${company.website}</li>
    </ul>
    
    <p>${fullName}, thank you once again for entrusting Top Tier Financial Solutions with your credit restoration. We are honored to assist you in achieving your financial aspirations.</p>
    
    <p>Best regards,<br/><strong>${company.preparedBy}</strong></p>
    
    <h5>Scope of Work</h5>
    <p>In the audit of the subject report, the auditor completed the following steps and analyses:</p>
    <ol>
      <li>Gathered and analyzed data from your credit report</li>
      <li>In connection with this audit, the auditor may have obtained information from:</li>
    </ol>
    <ul>
      <li>Credit Reporting Agencies (TransUnion, Experian, Equifax)</li>
      <li>Consumer-provided documentation</li>
      <li>Creditors of the consumer</li>
    </ul>
    
    <h5>Intended Use and Users</h5>
    <p>The intended use of this audit is to provide support and knowledge based on the consumer data provided. The primary users of this report are our clients, their legal counsel if applicable, and authorized parties. This audit is prepared exclusively for the identified users. No third parties are authorized to rely on this report without express written consent.</p>
    
    <h5>Assumptions and Limiting Conditions</h5>
    <p>This summary should not be construed as legal or financial advice. We assume no responsibility for:</p>
    <ol>
      <li>Legal matters affecting the report appraised</li>
      <li>The accuracy of the credit report provided to our company</li>
      <li>Hidden or unapparent conditions that would affect credit score impact</li>
      <li>Court appearances by reason of this audit</li>
    </ol>
    
    <div class="page-break"></div>
    
    <!-- PART 1: CREDIT SCORE BASICS -->
    <h2>Part 1 - Credit Score Basics</h2>
    
    <h3>The True Cost of a Low Credit Score</h3>
    
    <p>Understanding the financial impact of your credit score is crucial. Let's look at a real-world example:</p>
    
    <div style="text-align: center; margin: 20px 0;">
      <p><strong>Brand New Toyota Camry - $23,000</strong><br/>66-month financing term</p>
    </div>
    
    <div class="car-comparison">
      <div class="person person-a">
        <h4>Person A</h4>
        <p><strong>Credit Score: 730</strong></p>
        <p>Interest Rate: 1.99%</p>
        <p>Monthly Payment: $368.22</p>
        <p>Total Interest: $1,302.39</p>
        <p><strong>Total Paid: $24,302.39</strong></p>
      </div>
      <div class="person person-b">
        <h4>Person B</h4>
        <p><strong>Credit Score: 599</strong></p>
        <p>Interest Rate: 14.99%</p>
        <p>Monthly Payment: $513.97</p>
        <p>Total Interest: $10,921.44</p>
        <p><strong>Total Paid: $33,921.44</strong></p>
      </div>
    </div>
    
    <div class="difference-highlight">
      <p>Person B pays</p>
      <div class="difference-amount">$9,619.05 MORE</div>
      <p>for the exact same car at the exact same price!</p>
    </div>
    
    <p>This same scenario applies to your credit cards, mortgage, personal loans, and more. <strong>Improving your credit can save you tens of thousands of dollars over your lifetime.</strong></p>
    
    <h4>What Is a Credit Score?</h4>
    <p>A credit score is a numerical representation of your creditworthiness at a given moment. It predicts the likelihood of you becoming at least 90 days late on a payment within the next 24 months. Credit scores are calculated using proprietary formulas developed by various companies, with general guidelines provided on how these scores are determined.</p>
    
    <p>Fair Isaac Corporation (FICO) pioneered credit scoring in 1956, but widespread adoption didn't occur until the 1980s. In 1995, Fannie Mae and Freddie Mac recommended using credit scores in mortgage lending, solidifying their importance. Today, credit scores are also used by insurance companies, landlords, and employers.</p>
    
    <h4>The Three Major Credit Bureaus</h4>
    <p>Three major credit bureaus collect and maintain your credit information:</p>
    <ul>
      <li><strong>Equifax</strong> - Founded in 1899, headquartered in Atlanta, GA</li>
      <li><strong>Experian</strong> - Founded in 1996 (formerly TRW), headquartered in Dublin, Ireland</li>
      <li><strong>TransUnion</strong> - Founded in 1968, headquartered in Chicago, IL</li>
    </ul>
    <p>Each bureau maintains credit information on over 200 million consumers nationwide.</p>
    
    <h4>What's Included in Your Credit Report</h4>
    <ul>
      <li><strong>Personal Information:</strong> Name, addresses, date of birth, SSN, employment history</li>
      <li><strong>Account Information:</strong> Credit cards, loans, mortgages, payment history</li>
      <li><strong>Public Records:</strong> Bankruptcies, judgments, tax liens</li>
      <li><strong>Collection Accounts:</strong> Debts sent to collection agencies</li>
      <li><strong>Inquiries:</strong> Records of who has accessed your credit report</li>
    </ul>
    
    <h4>How Credit Scores Are Calculated</h4>
    <div class="credit-factors">
      <div class="credit-factor">
        <div class="credit-factor-percent">35%</div>
        <p><strong>Payment History</strong></p>
        <p style="font-size: 0.85em;">On-time payments, late payments, collections</p>
      </div>
      <div class="credit-factor">
        <div class="credit-factor-percent">30%</div>
        <p><strong>Utilization</strong></p>
        <p style="font-size: 0.85em;">Credit used vs. available</p>
      </div>
      <div class="credit-factor">
        <div class="credit-factor-percent">15%</div>
        <p><strong>Credit Age</strong></p>
        <p style="font-size: 0.85em;">Length of credit history</p>
      </div>
      <div class="credit-factor">
        <div class="credit-factor-percent">10%</div>
        <p><strong>Credit Mix</strong></p>
        <p style="font-size: 0.85em;">Types of accounts</p>
      </div>
      <div class="credit-factor">
        <div class="credit-factor-percent">10%</div>
        <p><strong>New Credit</strong></p>
        <p style="font-size: 0.85em;">Recent inquiries</p>
      </div>
    </div>
    
    <h4>Credit Score Ranges</h4>
    <table>
      <thead>
        <tr>
          <th>Score Range</th>
          <th>Rating</th>
          <th>What It Means</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>800+</td>
          <td><strong>Excellent</strong></td>
          <td>Best rates, instant approvals, premium offers</td>
        </tr>
        <tr>
          <td>740-799</td>
          <td><strong>Very Good</strong></td>
          <td>Above average rates, easy approvals</td>
        </tr>
        <tr>
          <td>670-739</td>
          <td><strong>Good</strong></td>
          <td>Average rates, standard terms</td>
        </tr>
        <tr>
          <td>580-669</td>
          <td><strong>Fair</strong></td>
          <td>Higher rates, possible restrictions</td>
        </tr>
        <tr>
          <td>Below 580</td>
          <td><strong>Poor</strong></td>
          <td>High rates, limited options, may require deposits</td>
        </tr>
      </tbody>
    </table>
    
    <div class="page-break"></div>
    
    <!-- PART 2: YOUR SCORES AND SUMMARY -->
    <h2>Part 2 - Your Credit Scores and Summary</h2>
    
    <p>We have analyzed your credit reports from the three major bureaus. Here are our findings:</p>
    
    <h3>Your Credit Scores</h3>
    <div class="scores-grid">
      <div class="score-card">
        <div class="score-bureau">TransUnion</div>
        <div class="score-value">${bureauSummary.transunion.creditScore || '---'}</div>
        <div class="score-label">${bureauSummary.transunion.lenderRank || ''}</div>
      </div>
      <div class="score-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <div class="score-bureau">Experian</div>
        <div class="score-value">${bureauSummary.experian.creditScore || '---'}</div>
        <div class="score-label">${bureauSummary.experian.lenderRank || ''}</div>
      </div>
      <div class="score-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <div class="score-bureau">Equifax</div>
        <div class="score-value">${bureauSummary.equifax.creditScore || '---'}</div>
        <div class="score-label">${bureauSummary.equifax.lenderRank || ''}</div>
      </div>
    </div>
    
    <div class="info-box tip">
      <strong>Keep Your Credit Monitoring Active</strong>
      <p style="margin-bottom: 0;">Your credit scores may vary depending on where you obtain your reports. Maintaining a single credit monitoring account provides a consistent baseline for tracking changes throughout the credit repair process.</p>
    </div>
    
    <h3>Your Derogatory Summary</h3>
    <p>We have identified items on your reports that are negatively impacting your score:</p>
    
    <table class="summary-table">
      <thead>
        <tr>
          <th></th>
          <th class="text-center">TransUnion</th>
          <th class="text-center">Experian</th>
          <th class="text-center">Equifax</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Delinquent</td>
          <td class="text-center">${bureauSummary.transunion.delinquent || 0}</td>
          <td class="text-center">${bureauSummary.experian.delinquent || 0}</td>
          <td class="text-center">${bureauSummary.equifax.delinquent || 0}</td>
        </tr>
        <tr>
          <td>Derogatory</td>
          <td class="text-center">${bureauSummary.transunion.derogatory || 0}</td>
          <td class="text-center">${bureauSummary.experian.derogatory || 0}</td>
          <td class="text-center">${bureauSummary.equifax.derogatory || 0}</td>
        </tr>
        <tr>
          <td>Collection</td>
          <td class="text-center">${bureauSummary.transunion.collection || 0}</td>
          <td class="text-center">${bureauSummary.experian.collection || 0}</td>
          <td class="text-center">${bureauSummary.equifax.collection || 0}</td>
        </tr>
        <tr>
          <td>Public Records</td>
          <td class="text-center">${bureauSummary.transunion.publicRecords || 0}</td>
          <td class="text-center">${bureauSummary.experian.publicRecords || 0}</td>
          <td class="text-center">${bureauSummary.equifax.publicRecords || 0}</td>
        </tr>
        <tr>
          <td>Inquiries (2 years)</td>
          <td class="text-center">${bureauSummary.transunion.inquiries || 0}</td>
          <td class="text-center">${bureauSummary.experian.inquiries || 0}</td>
          <td class="text-center">${bureauSummary.equifax.inquiries || 0}</td>
        </tr>
      </tbody>
    </table>
    
    <h3>Credit Summary</h3>
    <table class="summary-table">
      <thead>
        <tr>
          <th></th>
          <th class="text-center">TransUnion</th>
          <th class="text-center">Experian</th>
          <th class="text-center">Equifax</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total Accounts</td>
          <td class="text-center">${bureauSummary.transunion.totalAccounts || 0}</td>
          <td class="text-center">${bureauSummary.experian.totalAccounts || 0}</td>
          <td class="text-center">${bureauSummary.equifax.totalAccounts || 0}</td>
        </tr>
        <tr>
          <td>Open Accounts</td>
          <td class="text-center">${bureauSummary.transunion.openAccounts || 0}</td>
          <td class="text-center">${bureauSummary.experian.openAccounts || 0}</td>
          <td class="text-center">${bureauSummary.equifax.openAccounts || 0}</td>
        </tr>
        <tr>
          <td>Closed Accounts</td>
          <td class="text-center">${bureauSummary.transunion.closedAccounts || 0}</td>
          <td class="text-center">${bureauSummary.experian.closedAccounts || 0}</td>
          <td class="text-center">${bureauSummary.equifax.closedAccounts || 0}</td>
        </tr>
        <tr>
          <td>Balances</td>
          <td class="text-center">${formatCurrency(bureauSummary.transunion.balances)}</td>
          <td class="text-center">${formatCurrency(bureauSummary.experian.balances)}</td>
          <td class="text-center">${formatCurrency(bureauSummary.equifax.balances)}</td>
        </tr>
        <tr>
          <td>Payments</td>
          <td class="text-center">${formatCurrency(bureauSummary.transunion.payments)}</td>
          <td class="text-center">${formatCurrency(bureauSummary.experian.payments)}</td>
          <td class="text-center">${formatCurrency(bureauSummary.equifax.payments)}</td>
        </tr>
      </tbody>
    </table>
    
    ${renderPersonalInformationSection(data)}
    
    <div class="page-break"></div>
    
    <!-- PART 3: ACCOUNT ANALYSIS -->
    <h2>Part 3 - Analysis of Your Accounts</h2>
    
    <h3>Your Derogatory Items</h3>
    <p>You have <strong>${derogatoryTotal}</strong> items marked as delinquent or derogatory. Recent late payments, collections, and other derogatory items within the last six months hurt your score more than older inactive accounts. Accounts within the last 24 months carry the second most weight.</p>
    
    ${derogatoryTotal > 0 ? `
    <table class="derogatory-table">
      <thead>
        <tr>
          <th>Creditor/Furnisher</th>
          <th>TransUnion</th>
          <th>Experian</th>
          <th>Equifax</th>
          <th>Issue</th>
        </tr>
      </thead>
      <tbody>
        ${derogatoryAccounts.map(acc => `
        <tr>
          <td><strong>${acc.creditorName}</strong></td>
          <td>${acc.transunion.accountDate || '-'}</td>
          <td>${acc.experian.accountDate || '-'}</td>
          <td>${acc.equifax.accountDate || '-'}</td>
          <td><span class="issue-tag ${acc.uniqueStatus.toLowerCase().includes('collection') ? 'issue-collection' : acc.uniqueStatus.toLowerCase().includes('late') ? 'issue-late' : 'issue-chargeoff'}">${acc.uniqueStatus}</span></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<p style="color: #059669; padding: 20px; background: #ECFDF5; border-radius: 12px; border: 1px solid #A7F3D0;">Congratulations! No derogatory items found on your report.</p>'}
    
    <h3>Your Public Records</h3>
    <p>You have <strong>${publicRecordsTotal}</strong> public records. Public records include court records, bankruptcy filings, tax liens, and monetary judgments. These typically remain on your credit report for 7 to 10 years.</p>
    
    ${publicRecordsTotal > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Status</th>
          <th>TransUnion Filed</th>
          <th>Experian Filed</th>
          <th>Equifax Filed</th>
        </tr>
      </thead>
      <tbody>
        ${publicRecords.map(rec => `
        <tr>
          <td>${rec.type}</td>
          <td>${rec.status}</td>
          <td>${rec.transunionFiled || '-'}</td>
          <td>${rec.experianFiled || '-'}</td>
          <td>${rec.equifaxFiled || '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<p style="color: #059669; padding: 16px; background: #ECFDF5; border-radius: 12px; border: 1px solid #A7F3D0;">No public records found.</p>'}
    
    <h3>Your Inquiries</h3>
    <p>You have <strong>${inquiriesTotal}</strong> inquiries on your reports. Each time you apply for credit, it can lower your score. During credit repair, we strongly recommend that you <strong>do not apply for any new credit</strong>.</p>
    
    ${inquiriesTotal > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Business</th>
          <th>Type</th>
          <th>Date</th>
          <th>Bureau</th>
        </tr>
      </thead>
      <tbody>
        ${inquiries.slice(0, 15).map(inq => `
        <tr>
          <td>${inq.creditorName}</td>
          <td>${inq.inquiryType || '-'}</td>
          <td>${inq.inquiryDate ? formatDate(inq.inquiryDate) : '-'}</td>
          <td>${inq.bureau || '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ${inquiriesTotal > 15 ? `<p style="font-size: 0.85em; color: #64748B; margin-top: 12px;">+ ${inquiriesTotal - 15} more inquiries</p>` : ''}
    ` : '<p style="color: #059669; padding: 16px; background: #ECFDF5; border-radius: 12px; border: 1px solid #A7F3D0;">No recent inquiries found.</p>'}
    
    <h3>Credit Utilization</h3>
    <p>Your credit utilization ratio is one of the most important factors in your credit score. We recommend keeping utilization below 30%, ideally under 10%.</p>
    
    <div class="utilization-grid">
      <div class="utilization-card">
        <p><strong>TransUnion</strong></p>
        <div class="utilization-percent utilization-${getUtilizationImage(creditUtilization.transunion.percent)}">${creditUtilization.transunion.percent}%</div>
        <p style="font-size: 0.85em;">${formatCurrency(creditUtilization.transunion.balance)} of ${formatCurrency(creditUtilization.transunion.limit)}</p>
        <div class="utilization-bar">
          <div class="utilization-fill" style="width: ${Math.min(creditUtilization.transunion.percent, 100)}%; background: ${creditUtilization.transunion.percent >= 75 ? '#e53e3e' : creditUtilization.transunion.percent >= 50 ? '#ed8936' : creditUtilization.transunion.percent >= 30 ? '#ecc94b' : '#38a169'};"></div>
        </div>
      </div>
      <div class="utilization-card">
        <p><strong>Experian</strong></p>
        <div class="utilization-percent utilization-${getUtilizationImage(creditUtilization.experian.percent)}">${creditUtilization.experian.percent}%</div>
        <p style="font-size: 0.85em;">${formatCurrency(creditUtilization.experian.balance)} of ${formatCurrency(creditUtilization.experian.limit)}</p>
        <div class="utilization-bar">
          <div class="utilization-fill" style="width: ${Math.min(creditUtilization.experian.percent, 100)}%; background: ${creditUtilization.experian.percent >= 75 ? '#e53e3e' : creditUtilization.experian.percent >= 50 ? '#ed8936' : creditUtilization.experian.percent >= 30 ? '#ecc94b' : '#38a169'};"></div>
        </div>
      </div>
      <div class="utilization-card">
        <p><strong>Equifax</strong></p>
        <div class="utilization-percent utilization-${getUtilizationImage(creditUtilization.equifax.percent)}">${creditUtilization.equifax.percent}%</div>
        <p style="font-size: 0.85em;">${formatCurrency(creditUtilization.equifax.balance)} of ${formatCurrency(creditUtilization.equifax.limit)}</p>
        <div class="utilization-bar">
          <div class="utilization-fill" style="width: ${Math.min(creditUtilization.equifax.percent, 100)}%; background: ${creditUtilization.equifax.percent >= 75 ? '#e53e3e' : creditUtilization.equifax.percent >= 50 ? '#ed8936' : creditUtilization.equifax.percent >= 30 ? '#ecc94b' : '#38a169'};"></div>
        </div>
      </div>
    </div>
    
    <div class="info-box tip">
      <strong>Pro Tip:</strong> If you're carrying high balances, pay them down to below 25% of your available credit limit. This single action can boost your score significantly within 30-45 days.
    </div>
    
    <div class="page-break"></div>
    
    <!-- PART 4: OUR PROCESS -->
    <h2>Part 4 - An Overview of Our Process</h2>
    
    <h3>Our Plan of Action</h3>
    <p>The credit system is flawed, and studies show that nearly 80% of all credit reports contain errors that can lower your score. But you have rights, and we know how to use them to your benefit!</p>
    
    <p>The law gives you the right to dispute any item on your credit reports. And if those items cannot be verified, <strong>they must be removed</strong>. We will write strategic letters to the bureaus and creditors. If they can't prove it, they must remove it!</p>
    
    <h4>We Are Experts in Disputing Errors</h4>
    <p>While we cannot promise to remove all negative items on your report, we are well-versed in using the law to your advantage, including:</p>
    <ul>
      <li><strong>Fair Credit Reporting Act (FCRA)</strong> - Your right to accurate credit reporting</li>
      <li><strong>Fair Debt Collection Practices Act (FDCPA)</strong> - Protection from abusive collectors</li>
      <li><strong>Metro 2 Compliance</strong> - Industry reporting standards</li>
    </ul>
    
    <h4>What We Provide</h4>
    <ul>
      <li><strong>Document Preparation:</strong> We draft all dispute letters on your behalf</li>
      <li><strong>Bureau Communication:</strong> Strategic correspondence with all three bureaus</li>
      <li><strong>Creditor Challenges:</strong> Direct challenges to furnishers when needed</li>
      <li><strong>Credit Education:</strong> Guidance on how to manage and maintain excellent credit</li>
      <li><strong>Progress Tracking:</strong> Regular updates through your client portal</li>
    </ul>
    
    <h3>The Dispute Process</h3>
    <table>
      <thead>
        <tr>
          <th>Round</th>
          <th>Focus</th>
          <th>Timeline</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Round 1</strong></td>
          <td>Initial disputes - challenge all questionable items</td>
          <td>30-45 days</td>
        </tr>
        <tr>
          <td><strong>Round 2</strong></td>
          <td>Follow-up disputes - items not removed in Round 1</td>
          <td>30-45 days</td>
        </tr>
        <tr>
          <td><strong>Round 3+</strong></td>
          <td>Advanced strategies - method of verification, creditor direct</td>
          <td>30-45 days each</td>
        </tr>
      </tbody>
    </table>
    
    <div class="page-break"></div>
    
    <!-- PART 5: YOUR ROLE -->
    <h2>Part 5 - Your Role in the Process</h2>
    
    <h3>Your Next Steps</h3>
    <ol>
      <li><strong>Log into your Client Portal</strong> - We will email you the login details</li>
      <li><strong>Upload your documents:</strong>
        <ul>
          <li>Copy of your Photo ID</li>
          <li>Copy of your Social Security Card</li>
          <li>Proof of current address (utility bill, insurance statement, etc.)</li>
        </ul>
      </li>
      <li><strong>Provide credit monitoring login</strong> - So we can track changes to your reports</li>
    </ol>
    
    <h3>How You Can Speed Up the Process</h3>
    <ol>
      <li><strong>Stop applying for credit</strong> - Each inquiry lowers your scores</li>
      <li><strong>Do not close any accounts</strong> - This can also hurt your score</li>
      <li><strong>Pay down credit cards to below 25%</strong> - This has a huge positive impact</li>
      <li><strong>Never spend more than 25%</strong> of your limit, even if you pay it off monthly</li>
      <li><strong>Pay all bills on time</strong> - One missed payment can undo our work</li>
      <li><strong>Keep credit monitoring active</strong> - We need to see changes in real-time</li>
      <li><strong>Open all mail from bureaus</strong> - Forward replies to us immediately via your portal</li>
    </ol>
    
    <div class="info-box important">
      <strong>Important Reminder:</strong> It took time to get your credit into its current state, and cleaning it up will not happen overnight. We must proceed carefully and strategically, or the bureaus will mark disputes as "frivolous." Patience is key - trust the process!
    </div>
    
    <h3>This Process Takes Time</h3>
    <p>Each round of disputes takes 30-45 days for bureaus to respond. A difficult item may require multiple letters to multiple parties. Thanks to technology and your client portal, you'll receive real-time updates every step of the way.</p>
    
    <p>By following our program and advice, your credit <strong>will</strong> improve - and we'll teach you how to maintain excellent credit long after our work is done.</p>
    
    <div class="cta-section">
      <h3>Ready to Get Started?</h3>
      <p>Our team is ready to help you dispute inaccuracies and repair your credit.</p>
      <div class="cta-contact">
        <div>📞 <a href="tel:${company.officePhone}">${company.officePhone}</a></div>
        <div>📧 <a href="mailto:${company.email}">${company.email}</a></div>
        <div>🌐 ${company.website}</div>
      </div>
    </div>
    
    <p style="text-align: center; margin-top: 32px;">
      ${fullName}, thank you for choosing ${company.name}.<br/>
      We are honored to help you achieve your financial goals.<br/><br/>
      <strong>Credit is our passion. Your success is our mission.</strong>
    </p>
    
    <div class="section-footer">
      <p>This report is for informational purposes only and does not constitute legal or financial advice.</p>
      <p>&copy; ${new Date().getFullYear()} ${company.name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

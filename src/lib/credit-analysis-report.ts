// Credit Analysis Report Generator
// Comprehensive report matching the PHP Twig template format
// Includes: Cover Page, Welcome Letter, Credit Basics, Scores Summary, Account Analysis, Process Overview, Client Role

import type { BureauSummary, BureauPersonalInfo, DerogatoryAccount, PublicRecord, BureauCreditUtilization } from './parsers/pdf-parser';

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
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0.75in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      background: #fff;
    }
    
    .page {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px 40px;
    }
    
    .page-break {
      page-break-after: always;
      height: 0;
    }
    
    /* Typography */
    h1, h2, h3, h4, h5 {
      color: #1a365d;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; border-bottom: 2px solid #c9a227; padding-bottom: 8px; margin-top: 24px; }
    h3 { font-size: 1.25em; color: #2d3748; }
    h4 { font-size: 1.1em; color: #4a5568; }
    h5 { font-size: 1em; color: #4a5568; margin-top: 16px; }
    
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
    
    /* Cover Page */
    .cover-page {
      text-align: center;
      padding-top: 120px;
      min-height: 100vh;
    }
    
    .logo-container {
      margin-bottom: 40px;
    }
    
    .logo-svg {
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
    }
    
    .company-name {
      font-size: 2.5em;
      font-weight: 700;
      color: #1a365d;
      letter-spacing: -1px;
    }
    
    .company-tagline {
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 4px;
      color: #c9a227;
      font-weight: 500;
    }
    
    .report-title {
      font-size: 1.5em;
      color: #4a5568;
      margin: 40px 0;
      font-weight: 400;
    }
    
    .prepared-for {
      font-style: italic;
      color: #718096;
      margin-bottom: 8px;
    }
    
    .client-name {
      font-size: 2em;
      color: #1a365d;
      font-weight: 600;
    }
    
    .report-date {
      margin-top: 16px;
      color: #718096;
    }
    
    .prepared-by-section {
      margin-top: 80px;
      padding: 24px;
      background: #f7fafc;
      border-radius: 8px;
      display: inline-block;
    }
    
    .prepared-by-section p {
      text-align: center;
      margin: 4px 0;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10pt;
    }
    
    thead th {
      background: #1a365d;
      color: #fff;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
    }
    
    tbody td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    
    tbody tr:nth-child(even) {
      background: #f7fafc;
    }
    
    .text-center {
      text-align: center;
    }
    
    /* Score Cards */
    .scores-grid {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 24px 0;
    }
    
    .score-card {
      flex: 1;
      text-align: center;
      padding: 24px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: white;
    }
    
    .score-bureau {
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    
    .score-value {
      font-size: 3em;
      font-weight: 700;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    
    .score-label {
      font-size: 0.8em;
      opacity: 0.8;
      margin-top: 4px;
    }
    
    /* Summary Table */
    .summary-table {
      margin: 20px 0;
    }
    
    .summary-table th {
      background: #2d3748;
    }
    
    .summary-table td:first-child {
      font-weight: 600;
      color: #2d3748;
    }
    
    /* Derogatory Items */
    .derogatory-table td {
      font-size: 9pt;
    }
    
    .issue-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 500;
    }
    
    .issue-late { background: #fed7d7; color: #c53030; }
    .issue-collection { background: #feebc8; color: #c05621; }
    .issue-chargeoff { background: #e9d8fd; color: #6b46c1; }
    
    /* Utilization */
    .utilization-grid {
      display: flex;
      gap: 16px;
      margin: 20px 0;
    }
    
    .utilization-card {
      flex: 1;
      padding: 16px;
      background: #f7fafc;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    
    .utilization-percent {
      font-size: 2em;
      font-weight: 700;
    }
    
    .utilization-excellent { color: #38a169; }
    .utilization-good { color: #68d391; }
    .utilization-fair { color: #ecc94b; }
    .utilization-poor { color: #ed8936; }
    .utilization-very-poor { color: #e53e3e; }
    
    .utilization-bar {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    
    .utilization-fill {
      height: 100%;
      border-radius: 4px;
    }
    
    /* Info Boxes */
    .info-box {
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 8px;
      border-left: 4px solid;
    }
    
    .info-box.tip {
      background: #e6fffa;
      border-color: #38b2ac;
    }
    
    .info-box.warning {
      background: #fffaf0;
      border-color: #ed8936;
    }
    
    .info-box.important {
      background: #fff5f5;
      border-color: #e53e3e;
    }
    
    /* Car Comparison */
    .car-comparison {
      display: flex;
      gap: 24px;
      margin: 24px 0;
      text-align: center;
    }
    
    .car-comparison .person {
      flex: 1;
      padding: 20px;
      border-radius: 8px;
    }
    
    .car-comparison .person-a {
      background: #c6f6d5;
      border: 2px solid #38a169;
    }
    
    .car-comparison .person-b {
      background: #fed7d7;
      border: 2px solid #e53e3e;
    }
    
    .difference-highlight {
      background: #1a365d;
      color: #fff;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    
    .difference-amount {
      font-size: 2.5em;
      font-weight: 700;
      color: #c9a227;
    }
    
    /* Credit Graph */
    .credit-factors {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 16px 0;
    }
    
    .credit-factor {
      flex: 1;
      min-width: 150px;
      padding: 16px;
      background: #f7fafc;
      border-radius: 8px;
      text-align: center;
    }
    
    .credit-factor-percent {
      font-size: 1.5em;
      font-weight: 700;
      color: #667eea;
    }
    
    /* Footer */
    .section-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 0.9em;
      color: #718096;
    }
    
    /* CTA Section */
    .cta-section {
      background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
      color: #fff;
      padding: 32px;
      border-radius: 12px;
      text-align: center;
      margin: 32px 0;
    }
    
    .cta-section h3 {
      color: #c9a227;
      margin-bottom: 12px;
    }
    
    .cta-contact {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    
    .cta-contact a {
      color: #c9a227;
      text-decoration: none;
    }
    
    /* Print Styles */
    @media print {
      body {
        font-size: 10pt;
      }
      
      .page {
        padding: 0;
      }
      
      .page-break {
        page-break-after: always;
      }
      
      .score-card {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      thead th {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- COVER PAGE -->
    <div class="cover-page">
      <div class="logo-container">
        <svg class="logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" fill="#e2e8f0" stroke="#c9a227" stroke-width="2" stroke-linejoin="round"/>
          <path d="M24 11V37M13 17L24 11L35 17M13 25L24 31L35 25" stroke="#c9a227" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="24" cy="11" r="2" fill="#c9a227"/>
          <circle cx="13" cy="17" r="2" fill="#c9a227"/>
          <circle cx="35" cy="17" r="2" fill="#c9a227"/>
        </svg>
        <div class="company-name">Top Tier</div>
        <div class="company-tagline">Financial Solutions</div>
      </div>
      
      <div class="report-title">Credit Analysis Report</div>
      
      <p class="prepared-for">Prepared for</p>
      <div class="client-name">${fullName}</div>
      <p class="report-date">${reportDate}</p>
      
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
    ` : '<p style="color: #38a169; padding: 16px; background: #c6f6d5; border-radius: 8px;">Congratulations! No derogatory items found on your report.</p>'}
    
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
    ` : '<p style="color: #38a169;">No public records found.</p>'}
    
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
    ${inquiriesTotal > 15 ? `<p style="font-size: 0.9em; color: #718096;">+ ${inquiriesTotal - 15} more inquiries</p>` : ''}
    ` : '<p style="color: #38a169;">No recent inquiries found.</p>'}
    
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

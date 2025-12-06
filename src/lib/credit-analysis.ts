import { db } from '@/db/client';
import { 
  creditReports, 
  creditAccounts, 
  negativeItems, 
  creditAnalyses,
  creditScoreHistory,
  consumerProfiles,
  bureauDiscrepancies,
  fcraComplianceItems,
  personalInfoDisputes,
  inquiryDisputes,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getFileFromR2 } from './r2-storage';
import { 
  parsePdfCreditReport, 
  type ParsedCreditData, 
  type ParsedConsumerProfile,
  type ExtendedParsedCreditData,
  type DerogatoryAccount,
} from './parsers/pdf-parser';
import { parseHtmlCreditReport } from './parsers/html-parser';
import {
  calculateCompletenessScore,
  FCRA_REPORTING_LIMITS,
  isAccountNegative,
  calculateRiskLevel,
  type StandardizedAccount,
} from './parsers/metro2-mapping';

// Helper function to check if parsed data has extended bureau info
function isExtendedParsedData(data: ParsedCreditData): data is ExtendedParsedCreditData {
  return 'derogatoryAccounts' in data && Array.isArray((data as ExtendedParsedCreditData).derogatoryAccounts);
}

// Helper to find matching derogatory account by creditor name
function findDerogatoryMatch(
  creditorName: string, 
  derogatoryAccounts: DerogatoryAccount[] | undefined
): DerogatoryAccount | undefined {
  if (!derogatoryAccounts) return undefined;
  const normalizedName = creditorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return derogatoryAccounts.find(da => {
    const daNormalized = da.creditorName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return daNormalized === normalizedName || 
           daNormalized.includes(normalizedName) || 
           normalizedName.includes(daNormalized);
  });
}

// Helper to parse date string from derogatory account
function parseBureauDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr || dateStr === '-' || dateStr === '') return undefined;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function analyzeCreditReport(reportId: string): Promise<void> {
  // Get the report
  const [report] = await db
    .select()
    .from(creditReports)
    .where(eq(creditReports.id, reportId))
    .limit(1);

  if (!report) {
    throw new Error('Credit report not found');
  }

  // Update status to processing
  await db
    .update(creditReports)
    .set({ parseStatus: 'processing' })
    .where(eq(creditReports.id, reportId));

  try {
    // Clear existing parsed data for re-analysis
    await db.delete(negativeItems).where(eq(negativeItems.creditReportId, reportId));
    await db.delete(creditAccounts).where(eq(creditAccounts.creditReportId, reportId));
    await db.delete(consumerProfiles).where(eq(consumerProfiles.creditReportId, reportId));
    await db.delete(personalInfoDisputes).where(eq(personalInfoDisputes.creditReportId, reportId));
    await db.delete(inquiryDisputes).where(eq(inquiryDisputes.creditReportId, reportId));
    await db.delete(fcraComplianceItems).where(eq(fcraComplianceItems.clientId, report.clientId));

    // Get file from R2
    const fileBuffer = await getFileFromR2(report.fileUrl);
    
    // Parse based on file type
    let parsedData: ParsedCreditData;
    
    if (report.fileType === 'pdf') {
      parsedData = await parsePdfCreditReport(fileBuffer);
    } else if (report.fileType === 'html') {
      const htmlContent = fileBuffer.toString('utf-8');
      parsedData = parseHtmlCreditReport(htmlContent);
    } else {
      // Plain text - try to parse as best we can
      const textContent = fileBuffer.toString('utf-8');
      parsedData = parseHtmlCreditReport(`<pre>${textContent}</pre>`);
    }

    // Store consumer profile if available
    if (parsedData.consumerProfile) {
      await saveConsumerProfile(report.clientId, reportId, report.bureau, parsedData.consumerProfile);
    }

    // Store parsed accounts with completeness scoring
    const storedAccountIds: string[] = [];
    const accountIdMap = new Map<string, string>(); // Map creditor+account# to accountId
    
    for (const account of parsedData.accounts) {
      const accountId = randomUUID();
      storedAccountIds.push(accountId);
      
      // Create lookup key for linking negative items later
      const lookupKey = `${account.creditorName}|${account.accountNumber || ''}`.toLowerCase();
      accountIdMap.set(lookupKey, accountId);
      
      const accountStatus = account.accountStatus as StandardizedAccount['accountStatus'] | undefined;
      const paymentStatus = account.paymentStatus as StandardizedAccount['paymentStatus'] | undefined;
      const accountCategory = account.accountType as StandardizedAccount['accountCategory'] | undefined;

      // Calculate completeness score
      const { score: completenessScore, missingFields } = calculateCompletenessScore({
        creditorName: account.creditorName,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        accountStatus,
        balance: account.balance,
        creditLimit: account.creditLimit,
        highCredit: account.highCredit,
        dateOpened: account.dateOpened,
        dateReported: account.dateReported,
        paymentStatus,
      });
      
      // Re-calculate negative status and risk using metro2 functions
      const isNegativeCalc = isAccountNegative({
        accountStatus,
        paymentStatus,
        pastDueAmount: account.pastDueAmount,
      });
      const riskLevelCalc = calculateRiskLevel({
        accountStatus,
        paymentStatus,
        accountCategory,
      });
      
      // Determine per-bureau presence for credit accounts
      // For accounts, we use the single bureau field since accounts typically come per-bureau
      let accountOnTransunion = false;
      let accountOnExperian = false;
      let accountOnEquifax = false;
      
      const specificBureaus = ['transunion', 'experian', 'equifax'];
      const reportBureauLower = report.bureau?.toLowerCase();
      
      if (reportBureauLower && specificBureaus.includes(reportBureauLower)) {
        // Single specific bureau report
        accountOnTransunion = reportBureauLower === 'transunion';
        accountOnExperian = reportBureauLower === 'experian';
        accountOnEquifax = reportBureauLower === 'equifax';
      } else if (account.bureau) {
        const accountBureauLower = account.bureau.toLowerCase();
        if (specificBureaus.includes(accountBureauLower)) {
          accountOnTransunion = accountBureauLower === 'transunion';
          accountOnExperian = accountBureauLower === 'experian';
          accountOnEquifax = accountBureauLower === 'equifax';
        } else {
          // Account bureau is "combined" or unknown - mark all as true
          accountOnTransunion = true;
          accountOnExperian = true;
          accountOnEquifax = true;
        }
      } else {
        // Combined report - mark all as true (will be refined by derogatory match if available)
        accountOnTransunion = true;
        accountOnExperian = true;
        accountOnEquifax = true;
      }
      
      await db.insert(creditAccounts).values({
        id: accountId,
        creditReportId: reportId,
        clientId: report.clientId,
        creditorName: account.creditorName,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        accountStatus: account.accountStatus,
        balance: account.balance,
        creditLimit: account.creditLimit,
        highCredit: account.highCredit,
        monthlyPayment: account.monthlyPayment,
        pastDueAmount: account.pastDueAmount,
        paymentStatus: account.paymentStatus,
        dateOpened: account.dateOpened,
        dateReported: account.dateReported,
        bureau: report.bureau, // Legacy field for backward compatibility
        // Per-bureau presence fields
        onTransunion: accountOnTransunion,
        onExperian: accountOnExperian,
        onEquifax: accountOnEquifax,
        transunionDate: accountOnTransunion ? account.dateReported : undefined,
        experianDate: accountOnExperian ? account.dateReported : undefined,
        equifaxDate: accountOnEquifax ? account.dateReported : undefined,
        transunionBalance: accountOnTransunion ? account.balance : undefined,
        experianBalance: accountOnExperian ? account.balance : undefined,
        equifaxBalance: accountOnEquifax ? account.balance : undefined,
        isNegative: isNegativeCalc,
        riskLevel: riskLevelCalc,
        remarks: missingFields.length > 0 
          ? `Completeness: ${completenessScore}%. Missing: ${missingFields.join(', ')}`
          : account.remarks,
        createdAt: new Date(),
      });
    }

    // Store negative items and calculate FCRA compliance
    // CRITICAL FIX: Link negative items to their corresponding credit accounts
    // ENHANCEMENT: Extract per-bureau presence data from ExtendedParsedCreditData
    const extendedData = isExtendedParsedData(parsedData) ? parsedData : undefined;
    const derogatoryAccounts = extendedData ? extendedData.derogatoryAccounts : undefined;
    const personalInfoDisputesList = extendedData?.personalInfoDisputes || [];
    const inquiryDisputesList = extendedData?.inquiryDisputes || [];
    
    // Persist personal info disputes (names, DOB, addresses, employers)
    if (personalInfoDisputesList.length > 0) {
      for (const item of personalInfoDisputesList) {
        await db.insert(personalInfoDisputes).values({
          id: randomUUID(),
          clientId: report.clientId,
          creditReportId: reportId,
          bureau: item.bureau,
          type: item.type,
          value: item.value,
          createdAt: new Date(),
        });
      }
    }

    // Persist inquiry disputes with FCRA limit flag
    if (inquiryDisputesList.length > 0) {
      for (const inq of inquiryDisputesList) {
        await db.insert(inquiryDisputes).values({
          id: randomUUID(),
          clientId: report.clientId,
          creditReportId: reportId,
          creditorName: inq.creditorName,
          bureau: inq.bureau,
          inquiryDate: inq.inquiryDate,
          inquiryType: inq.inquiryType,
          isPastFcraLimit: inq.isPastFcraLimit,
          daysSinceInquiry: inq.daysSinceInquiry,
          createdAt: new Date(),
        });
      }
    }
    
    const negativeItemDedup = new Set<string>();

    for (const item of parsedData.negativeItems) {
      const negativeItemId = randomUUID();
      
      // Try to find matching credit account by creditor name
      // Some negative items (like collections) might not have exact account number matches
      let matchedAccountId: string | null = null;
      
      // First try exact match with account number if available
      if (item.accountNumber) {
        const lookupKey = `${item.creditorName}|${item.accountNumber}`.toLowerCase();
        matchedAccountId = accountIdMap.get(lookupKey) || null;
      }
      
      // If no match and no account number, try fuzzy match by creditor name only
      if (!matchedAccountId) {
        const creditorLower = item.creditorName.toLowerCase();
        for (const [key, accountId] of accountIdMap.entries()) {
          if (key.startsWith(creditorLower + '|')) {
            matchedAccountId = accountId;
            break;
          }
        }
      }
      
      // Find matching derogatory account for per-bureau data
      const derogatoryMatch = findDerogatoryMatch(item.creditorName, derogatoryAccounts);
      
      // Determine per-bureau presence
      // If we have derogatory match with per-bureau data, use it
      // Otherwise, fall back to report.bureau (single bureau report) or mark all as true (combined)
      let onTransunion = false;
      let onExperian = false;
      let onEquifax = false;
      let transunionDate: Date | undefined;
      let experianDate: Date | undefined;
      let equifaxDate: Date | undefined;
      let transunionStatus: string | undefined;
      let experianStatus: string | undefined;
      let equifaxStatus: string | undefined;
      
      const specificBureausForItem = ['transunion', 'experian', 'equifax'];
      const reportBureauLowerForItem = report.bureau?.toLowerCase();
      
      if (derogatoryMatch) {
        // Use per-bureau data from derogatory account
        onTransunion = !!(derogatoryMatch.transunion?.accountDate && derogatoryMatch.transunion.accountDate !== '-');
        onExperian = !!(derogatoryMatch.experian?.accountDate && derogatoryMatch.experian.accountDate !== '-');
        onEquifax = !!(derogatoryMatch.equifax?.accountDate && derogatoryMatch.equifax.accountDate !== '-');
        transunionDate = parseBureauDate(derogatoryMatch.transunion?.accountDate);
        experianDate = parseBureauDate(derogatoryMatch.experian?.accountDate);
        equifaxDate = parseBureauDate(derogatoryMatch.equifax?.accountDate);
        transunionStatus = derogatoryMatch.transunion?.accountStatus || derogatoryMatch.transunion?.paymentStatus;
        experianStatus = derogatoryMatch.experian?.accountStatus || derogatoryMatch.experian?.paymentStatus;
        equifaxStatus = derogatoryMatch.equifax?.accountStatus || derogatoryMatch.equifax?.paymentStatus;
      } else if (reportBureauLowerForItem && specificBureausForItem.includes(reportBureauLowerForItem)) {
        // Single specific bureau report - mark only that bureau as present
        onTransunion = reportBureauLowerForItem === 'transunion';
        onExperian = reportBureauLowerForItem === 'experian';
        onEquifax = reportBureauLowerForItem === 'equifax';
        // Set date for the reporting bureau
        if (onTransunion) transunionDate = item.dateReported || undefined;
        if (onExperian) experianDate = item.dateReported || undefined;
        if (onEquifax) equifaxDate = item.dateReported || undefined;
      } else {
        // Combined report or unknown bureau without derogatory match - conservatively mark all as true
        // This ensures items aren't accidentally filtered out
        onTransunion = true;
        onExperian = true;
        onEquifax = true;
      }

      // Deduplication: key by creditor + bureau + itemType + accountNumber
      const buildDedupKey = (bureauKey: string) => `${(item.creditorName || '').toLowerCase()}|${bureauKey}|${item.itemType}|${item.accountNumber || ''}`;
      const bureauKeys: string[] = [];
      if (onTransunion) bureauKeys.push('transunion');
      if (onExperian) bureauKeys.push('experian');
      if (onEquifax) bureauKeys.push('equifax');
      if (bureauKeys.length === 0) {
        bureauKeys.push(item.bureau?.toLowerCase() || 'combined');
      }

      if (bureauKeys.some(key => negativeItemDedup.has(buildDedupKey(key)))) {
        continue; // Skip duplicate insert for the same bureau grouping
      }
      bureauKeys.forEach(key => negativeItemDedup.add(buildDedupKey(key)));
      
      await db.insert(negativeItems).values({
        id: negativeItemId,
        creditReportId: reportId,
        clientId: report.clientId,
        creditAccountId: matchedAccountId, // CRITICAL: Link to credit account for Metro 2 data
        itemType: item.itemType,
        creditorName: item.creditorName,
        originalCreditor: item.originalCreditor,
        amount: item.amount,
        dateReported: item.dateReported,
        dateOfLastActivity: item.dateOfLastActivity, // Add this field for DOFD analysis
        bureau: report.bureau, // Legacy field for backward compatibility
        // Per-bureau presence fields
        onTransunion,
        onExperian,
        onEquifax,
        transunionDate,
        experianDate,
        equifaxDate,
        transunionStatus,
        experianStatus,
        equifaxStatus,
        riskSeverity: item.riskSeverity,
        recommendedAction: getRecommendedAction(item),
        createdAt: new Date(),
      });
      
      // Calculate and store FCRA compliance for this item
      await saveFcraComplianceItem(
        report.clientId,
        negativeItemId,
        item,
        report.bureau
      );
    }
    
    // Run cross-bureau discrepancy detection
    await detectBureauDiscrepancies(report.clientId);

    // Create or update analysis
    const analysisId = randomUUID();
    const now = new Date();
    
    await db.insert(creditAnalyses).values({
      id: analysisId,
      clientId: report.clientId,
      scoreTransunion: parsedData.scores.transunion,
      scoreExperian: parsedData.scores.experian,
      scoreEquifax: parsedData.scores.equifax,
      totalAccounts: parsedData.summary.totalAccounts,
      openAccounts: parsedData.summary.openAccounts,
      closedAccounts: parsedData.summary.closedAccounts,
      totalDebt: parsedData.summary.totalDebt,
      totalCreditLimit: parsedData.summary.totalCreditLimit,
      utilizationPercent: parsedData.summary.utilizationPercent,
      derogatoryCount: parsedData.negativeItems.filter(i => i.itemType !== 'late_payment').length,
      collectionsCount: parsedData.negativeItems.filter(i => i.itemType === 'collection').length,
      latePaymentCount: parsedData.negativeItems.filter(i => i.itemType === 'late_payment').length,
      inquiryCount: parsedData.inquiries.length,
      analysisSummary: JSON.stringify({
        scores: parsedData.scores,
        accountBreakdown: {
          total: parsedData.summary.totalAccounts,
          open: parsedData.summary.openAccounts,
          closed: parsedData.summary.closedAccounts,
        },
        debtSummary: {
          totalDebt: parsedData.summary.totalDebt,
          totalCreditLimit: parsedData.summary.totalCreditLimit,
          utilization: parsedData.summary.utilizationPercent,
        },
      }),
      recommendations: JSON.stringify(generateRecommendations(parsedData)),
      createdAt: now,
      updatedAt: now,
    });

    // Save score history for timeline tracking
    const validScores = [parsedData.scores.transunion, parsedData.scores.experian, parsedData.scores.equifax]
      .filter((s): s is number => s !== null && s !== undefined);
    const averageScore = validScores.length > 0 
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;

    await db.insert(creditScoreHistory).values({
      id: randomUUID(),
      clientId: report.clientId,
      creditReportId: reportId,
      scoreTransunion: parsedData.scores.transunion,
      scoreExperian: parsedData.scores.experian,
      scoreEquifax: parsedData.scores.equifax,
      averageScore,
      source: 'credit_report',
      recordedAt: now,
      createdAt: now,
    });

    // Update report status
    await db
      .update(creditReports)
      .set({
        parseStatus: 'completed',
        parsedAt: now,
        rawData: JSON.stringify({
          scores: parsedData.scores,
          summary: parsedData.summary,
          accountCount: parsedData.accounts.length,
          negativeItemCount: parsedData.negativeItems.length,
        }),
      })
      .where(eq(creditReports.id, reportId));

  } catch (error) {
    console.error('Error analyzing credit report:', error);
    
    // Update status to failed
    await db
      .update(creditReports)
      .set({
        parseStatus: 'failed',
        parseError: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(creditReports.id, reportId));

    throw error;
  }
}

function getRecommendedAction(item: { itemType: string; riskSeverity: string }): string {
  switch (item.itemType) {
    case 'collection':
      return item.riskSeverity === 'severe' ? 'pay_for_delete' : 'dispute';
    case 'charge_off':
      return 'dispute';
    case 'late_payment':
      return 'goodwill_letter';
    case 'bankruptcy':
    case 'foreclosure':
      return 'wait';
    default:
      return 'dispute';
  }
}

function generateRecommendations(data: ParsedCreditData): string[] {
  const recommendations: string[] = [];
  
  // Score-based recommendations
  const validScores = [data.scores.transunion, data.scores.experian, data.scores.equifax]
    .filter((s): s is number => s !== null && s !== undefined);
  const avgScore = validScores.length > 0 
    ? validScores.reduce((a, b) => a + b, 0) / validScores.length 
    : 0;
  
  if (avgScore && avgScore < 650) {
    recommendations.push('Your credit scores are in the fair to poor range. Focus on addressing negative items and reducing utilization.');
  }
  
  // Utilization recommendations
  if (data.summary.utilizationPercent > 50) {
    recommendations.push(`Your credit utilization is ${data.summary.utilizationPercent}%. Aim to reduce this below 30% for optimal credit score impact.`);
  } else if (data.summary.utilizationPercent > 30) {
    recommendations.push(`Your credit utilization is ${data.summary.utilizationPercent}%. Consider paying down balances to get below 30%.`);
  }
  
  // Collection recommendations
  const collections = data.negativeItems.filter(i => i.itemType === 'collection');
  if (collections.length > 0) {
    recommendations.push(`You have ${collections.length} collection account(s). Consider disputing inaccuracies or negotiating pay-for-delete agreements.`);
  }
  
  // Late payment recommendations
  const latePayments = data.negativeItems.filter(i => i.itemType === 'late_payment');
  if (latePayments.length > 0) {
    recommendations.push(`You have ${latePayments.length} late payment(s) on record. Consider sending goodwill letters to creditors for removal.`);
  }
  
  // Charge-off recommendations
  const chargeOffs = data.negativeItems.filter(i => i.itemType === 'charge_off');
  if (chargeOffs.length > 0) {
    recommendations.push(`You have ${chargeOffs.length} charge-off(s). Dispute any inaccuracies and consider settling remaining balances.`);
  }
  
  // Inquiry recommendations
  if (data.inquiries.length > 5) {
    recommendations.push(`You have ${data.inquiries.length} recent inquiries. Avoid applying for new credit for the next 6-12 months.`);
  }
  
  // Positive recommendations
  if (data.summary.openAccounts < 3) {
    recommendations.push('Consider opening a secured credit card or credit-builder loan to add positive trade lines.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Your credit profile looks healthy. Continue making on-time payments and keeping utilization low.');
  }
  
  return recommendations;
}

// ============================================
// CONSUMER PROFILE MANAGEMENT
// ============================================

async function saveConsumerProfile(
  clientId: string,
  creditReportId: string,
  bureau: string | null,
  profile: ParsedConsumerProfile
): Promise<void> {
  // Save each name variation
  for (const name of profile.names) {
    await db.insert(consumerProfiles).values({
      id: randomUUID(),
      clientId,
      creditReportId,
      bureau: name.bureau || bureau,
      firstName: name.firstName,
      middleName: name.middleName,
      lastName: name.lastName,
      suffix: name.suffix,
      ssnLast4: profile.ssnLast4,
      dateOfBirth: profile.dateOfBirth,
      createdAt: new Date(),
    });
  }
  
  // Save addresses
  for (const address of profile.addresses) {
    await db.insert(consumerProfiles).values({
      id: randomUUID(),
      clientId,
      creditReportId,
      bureau: address.bureau || bureau,
      addressStreet: address.street,
      addressCity: address.city,
      addressState: address.state,
      addressZip: address.zipCode,
      addressType: address.addressType,
      ssnLast4: profile.ssnLast4,
      dateOfBirth: profile.dateOfBirth,
      createdAt: new Date(),
    });
  }
  
  // Save employers
  for (const employer of profile.employers) {
    await db.insert(consumerProfiles).values({
      id: randomUUID(),
      clientId,
      creditReportId,
      bureau: employer.bureau || bureau,
      employer: employer.name,
      ssnLast4: profile.ssnLast4,
      dateOfBirth: profile.dateOfBirth,
      createdAt: new Date(),
    });
  }
}

// ============================================
// FCRA COMPLIANCE CHECKING
// ============================================

async function saveFcraComplianceItem(
  clientId: string,
  negativeItemId: string,
  item: { itemType: string; creditorName: string; dateReported?: Date },
  bureau: string | null
): Promise<void> {
  // Determine reporting limit based on item type
  let reportingLimitYears = FCRA_REPORTING_LIMITS.general;
  const itemTypeLower = item.itemType.toLowerCase();
  
  if (itemTypeLower.includes('bankruptcy')) {
    reportingLimitYears = itemTypeLower.includes('chapter_7') || itemTypeLower.includes('chapter7')
      ? FCRA_REPORTING_LIMITS.bankruptcy_chapter7
      : FCRA_REPORTING_LIMITS.bankruptcy_chapter13;
  } else if (itemTypeLower === 'collection') {
    reportingLimitYears = FCRA_REPORTING_LIMITS.collections;
  } else if (itemTypeLower === 'charge_off') {
    reportingLimitYears = FCRA_REPORTING_LIMITS.charge_offs;
  } else if (itemTypeLower === 'late_payment') {
    reportingLimitYears = FCRA_REPORTING_LIMITS.late_payments;
  } else if (itemTypeLower === 'foreclosure') {
    reportingLimitYears = FCRA_REPORTING_LIMITS.foreclosures;
  } else if (itemTypeLower === 'repossession') {
    reportingLimitYears = FCRA_REPORTING_LIMITS.repossessions;
  }
  
  // Calculate FCRA expiration date
  const dateOfFirstDelinquency = item.dateReported; // Using dateReported as proxy
  let fcraExpirationDate: Date | null = null;
  let daysUntilExpiration: number | null = null;
  let isPastLimit = false;
  
  if (dateOfFirstDelinquency) {
    fcraExpirationDate = new Date(dateOfFirstDelinquency);
    fcraExpirationDate.setFullYear(fcraExpirationDate.getFullYear() + reportingLimitYears);
    
    const now = new Date();
    daysUntilExpiration = Math.ceil((fcraExpirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    isPastLimit = daysUntilExpiration <= 0;
  }
  
  await db.insert(fcraComplianceItems).values({
    id: randomUUID(),
    clientId,
    negativeItemId,
    itemType: item.itemType,
    creditorName: item.creditorName,
    dateOfFirstDelinquency,
    fcraExpirationDate,
    reportingLimitYears,
    daysUntilExpiration,
    isPastLimit,
    bureau,
    disputeStatus: isPastLimit ? 'pending' : null,
    notes: isPastLimit 
      ? `FCRA VIOLATION: Item past ${reportingLimitYears}-year reporting limit. Immediate dispute recommended.`
      : daysUntilExpiration && daysUntilExpiration < 180
        ? `Item expires in ${daysUntilExpiration} days. Consider waiting or disputing.`
        : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ============================================
// CROSS-BUREAU DISCREPANCY DETECTION
// ============================================

async function detectBureauDiscrepancies(clientId: string): Promise<void> {
  // Get all accounts for this client grouped by creditor
  const allAccounts = await db
    .select()
    .from(creditAccounts)
    .where(eq(creditAccounts.clientId, clientId));
  
  // Get all consumer profiles for comparison
  const allProfiles = await db
    .select()
    .from(consumerProfiles)
    .where(eq(consumerProfiles.clientId, clientId));
  
  // Clear existing discrepancies for this client
  await db.delete(bureauDiscrepancies).where(eq(bureauDiscrepancies.clientId, clientId));
  
  // Group accounts by creditor name (normalized)
  const accountsByCreditor = new Map<string, typeof allAccounts>();
  for (const account of allAccounts) {
    const normalizedName = account.creditorName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!accountsByCreditor.has(normalizedName)) {
      accountsByCreditor.set(normalizedName, []);
    }
    accountsByCreditor.get(normalizedName)!.push(account);
  }
  
  // Check for account discrepancies
  for (const [_creditorKey, accounts] of accountsByCreditor) {
    if (accounts.length < 2) continue; // Need at least 2 bureaus to compare
    
    // Get values by bureau
    const byBureau: Record<string, typeof accounts[0]> = {};
    for (const acc of accounts) {
      if (acc.bureau) byBureau[acc.bureau] = acc;
    }
    
    const bureaus = Object.keys(byBureau);
    if (bureaus.length < 2) continue;
    
    // Compare balances
    const balances = bureaus.map(b => byBureau[b].balance).filter(b => b !== null);
    if (balances.length > 1) {
      const uniqueBalances = new Set(balances);
      if (uniqueBalances.size > 1) {
        await db.insert(bureauDiscrepancies).values({
          id: randomUUID(),
          clientId,
          discrepancyType: 'account_balance',
          field: 'balance',
          creditorName: accounts[0].creditorName,
          accountNumber: accounts[0].accountNumber,
          valueTransunion: byBureau['transunion']?.balance?.toString() || null,
          valueExperian: byBureau['experian']?.balance?.toString() || null,
          valueEquifax: byBureau['equifax']?.balance?.toString() || null,
          severity: 'medium',
          isDisputable: true,
          disputeRecommendation: 'Balance differs across bureaus. Request verification from all three bureaus.',
          createdAt: new Date(),
        });
      }
    }
    
    // Compare account status
    const statuses = bureaus.map(b => byBureau[b].accountStatus).filter(s => s !== null);
    if (statuses.length > 1) {
      const uniqueStatuses = new Set(statuses);
      if (uniqueStatuses.size > 1) {
        await db.insert(bureauDiscrepancies).values({
          id: randomUUID(),
          clientId,
          discrepancyType: 'account_status',
          field: 'accountStatus',
          creditorName: accounts[0].creditorName,
          accountNumber: accounts[0].accountNumber,
          valueTransunion: byBureau['transunion']?.accountStatus || null,
          valueExperian: byBureau['experian']?.accountStatus || null,
          valueEquifax: byBureau['equifax']?.accountStatus || null,
          severity: 'high',
          isDisputable: true,
          disputeRecommendation: 'Account status differs across bureaus. This is a strong dispute basis under FCRA.',
          createdAt: new Date(),
        });
      }
    }
    
    // Compare payment status
    const payStatuses = bureaus.map(b => byBureau[b].paymentStatus).filter(s => s !== null);
    if (payStatuses.length > 1) {
      const uniquePayStatuses = new Set(payStatuses);
      if (uniquePayStatuses.size > 1) {
        await db.insert(bureauDiscrepancies).values({
          id: randomUUID(),
          clientId,
          discrepancyType: 'payment_history',
          field: 'paymentStatus',
          creditorName: accounts[0].creditorName,
          accountNumber: accounts[0].accountNumber,
          valueTransunion: byBureau['transunion']?.paymentStatus || null,
          valueExperian: byBureau['experian']?.paymentStatus || null,
          valueEquifax: byBureau['equifax']?.paymentStatus || null,
          severity: 'high',
          isDisputable: true,
          disputeRecommendation: 'Payment history differs across bureaus. Request method of verification.',
          createdAt: new Date(),
        });
      }
    }
  }
  
  // Check for PII discrepancies
  await detectPiiDiscrepancies(clientId, allProfiles);
}

async function detectPiiDiscrepancies(
  clientId: string, 
  profiles: Array<{
    bureau: string | null;
    firstName: string | null;
    lastName: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
    ssnLast4: string | null;
    dateOfBirth: Date | null;
  }>
): Promise<void> {
  // Group profiles by bureau
  const byBureau: Record<string, typeof profiles> = {};
  for (const profile of profiles) {
    const bureau = profile.bureau || 'unknown';
    if (!byBureau[bureau]) byBureau[bureau] = [];
    byBureau[bureau].push(profile);
  }
  
  const bureaus = Object.keys(byBureau).filter(b => b !== 'unknown');
  if (bureaus.length < 2) return;
  
  // Check name variations
  const namesByBureau: Record<string, Set<string>> = {};
  for (const bureau of bureaus) {
    namesByBureau[bureau] = new Set();
    for (const profile of byBureau[bureau]) {
      if (profile.firstName && profile.lastName) {
        namesByBureau[bureau].add(`${profile.firstName} ${profile.lastName}`.toLowerCase());
      }
    }
  }
  
  // Find names that appear on one bureau but not others
  const allNames = new Set<string>();
  for (const names of Object.values(namesByBureau)) {
    for (const name of names) allNames.add(name);
  }
  
  for (const name of allNames) {
    const presentOn: string[] = [];
    const missingFrom: string[] = [];
    
    for (const bureau of bureaus) {
      if (namesByBureau[bureau].has(name)) {
        presentOn.push(bureau);
      } else {
        missingFrom.push(bureau);
      }
    }
    
    if (presentOn.length > 0 && missingFrom.length > 0) {
      await db.insert(bureauDiscrepancies).values({
        id: randomUUID(),
        clientId,
        discrepancyType: 'pii_name',
        field: 'name',
        valueTransunion: namesByBureau['transunion']?.has(name) ? name : null,
        valueExperian: namesByBureau['experian']?.has(name) ? name : null,
        valueEquifax: namesByBureau['equifax']?.has(name) ? name : null,
        severity: 'low',
        isDisputable: true,
        disputeRecommendation: `Name "${name}" appears on ${presentOn.join(', ')} but not on ${missingFrom.join(', ')}. May indicate identity issue.`,
        createdAt: new Date(),
      });
    }
  }
  
  // Check address variations similarly
  const addressesByBureau: Record<string, Set<string>> = {};
  for (const bureau of bureaus) {
    addressesByBureau[bureau] = new Set();
    for (const profile of byBureau[bureau]) {
      if (profile.addressStreet) {
        const addr = `${profile.addressStreet}, ${profile.addressCity}, ${profile.addressState} ${profile.addressZip}`.toLowerCase();
        addressesByBureau[bureau].add(addr);
      }
    }
  }
  
  const allAddresses = new Set<string>();
  for (const addrs of Object.values(addressesByBureau)) {
    for (const addr of addrs) allAddresses.add(addr);
  }
  
  for (const addr of allAddresses) {
    const presentOn: string[] = [];
    const missingFrom: string[] = [];
    
    for (const bureau of bureaus) {
      if (addressesByBureau[bureau].has(addr)) {
        presentOn.push(bureau);
      } else {
        missingFrom.push(bureau);
      }
    }
    
    if (presentOn.length > 0 && missingFrom.length > 0 && missingFrom.length < bureaus.length) {
      await db.insert(bureauDiscrepancies).values({
        id: randomUUID(),
        clientId,
        discrepancyType: 'pii_address',
        field: 'address',
        valueTransunion: addressesByBureau['transunion']?.has(addr) ? addr : null,
        valueExperian: addressesByBureau['experian']?.has(addr) ? addr : null,
        valueEquifax: addressesByBureau['equifax']?.has(addr) ? addr : null,
        severity: 'low',
        isDisputable: false,
        disputeRecommendation: `Address discrepancy found across bureaus. Review for accuracy.`,
        createdAt: new Date(),
      });
    }
  }
}

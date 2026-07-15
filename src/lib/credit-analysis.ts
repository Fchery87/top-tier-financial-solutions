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
import { and, eq, inArray, isNull } from 'drizzle-orm';
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
  FCRA_REPORTING_LIMITS,
  isAccountNegative,
  calculateRiskLevel,
  type StandardizedAccount,
} from './parsers/metro2-mapping';
import { buildFcraComplianceStatus, getObsolescenceClock } from './fcra-clock';
import { buildCreditAccountDerivedFields } from './credit-account-ingest';
import { getAccountPresence } from './credit-account-bureau-presence';
import { getNegativeItemPresence } from './credit-negative-item-bureau-presence';
import { buildAccountBalanceDiscrepancies } from './credit-analysis-discrepancies';

function determineParserReviewStatus(params: {
  sourceConfidence?: string;
  accountCompleteness: number[];
  accountCount: number;
}): { status: 'needs_review' | 'approved'; reason?: string } {
  if (params.sourceConfidence === 'low') {
    return { status: 'needs_review', reason: 'Low source detection confidence' };
  }

  if (params.accountCount === 0 || params.accountCount > 250) {
    return { status: 'needs_review', reason: 'Implausible account count' };
  }

  const lowCompleteness = params.accountCompleteness.filter((score) => score < 50).length;
  if (params.accountCompleteness.length > 0 && lowCompleteness / params.accountCompleteness.length > 0.4) {
    return { status: 'needs_review', reason: 'More than 40% of accounts have low completeness' };
  }

  return { status: 'approved' };
}

// Helper function to check if parsed data has extended bureau info
function isExtendedParsedData(data: ParsedCreditData): data is ExtendedParsedCreditData {
  return 'derogatoryAccounts' in data && Array.isArray((data as ExtendedParsedCreditData).derogatoryAccounts);
}

// Helper to find matching derogatory account by creditor name
function findDerogatoryMatch(
  creditorName: string,
  accountNumber: string | undefined,
  amount: number | undefined,
  derogatoryAccounts: DerogatoryAccount[] | undefined,
): { match?: DerogatoryAccount; confidence: 'high' | 'medium' | 'low' } {
  if (!derogatoryAccounts) return { confidence: 'low' };
  const normalizedName = creditorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const last4 = accountNumber?.replace(/\D/g, '').slice(-4);

  const scored = derogatoryAccounts.map((da) => {
    const daNormalized = da.creditorName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const daLast4 = da.creditorName.replace(/\D/g, '').slice(-4);
    let score = 0;

    if (last4 && daLast4 && last4 === daLast4) score += 100;
    if (daNormalized === normalizedName) score += 45;
    else if (daNormalized.includes(normalizedName) || normalizedName.includes(daNormalized)) score += 20;

    const itemAmount = amount ?? 0;
    if (itemAmount > 0 && /collection|chargeoff|charge_off|late/i.test(da.uniqueStatus)) {
      score += 5;
    }

    return { da, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) return { confidence: 'low' };
  return { match: best.da, confidence: best.score >= 100 ? 'high' : best.score >= 45 ? 'medium' : 'low' };
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
    // Clear existing parsed data for re-analysis.
    // Compliance items must be removed before their negative items: the FK nulls on
    // delete, which would orphan them. Scope to this report only — deleting by clientId
    // would wipe compliance items derived from the client's other reports.
    await db.delete(fcraComplianceItems).where(
      inArray(
        fcraComplianceItems.negativeItemId,
        db.select({ id: negativeItems.id }).from(negativeItems).where(eq(negativeItems.creditReportId, reportId))
      )
    );
    // Sweep rows orphaned before this scoping existed (negativeItemId already nulled)
    await db.delete(fcraComplianceItems).where(
      and(eq(fcraComplianceItems.clientId, report.clientId), isNull(fcraComplianceItems.negativeItemId))
    );
    await db.delete(negativeItems).where(eq(negativeItems.creditReportId, reportId));
    await db.delete(creditAccounts).where(eq(creditAccounts.creditReportId, reportId));
    await db.delete(consumerProfiles).where(eq(consumerProfiles.creditReportId, reportId));
    await db.delete(personalInfoDisputes).where(eq(personalInfoDisputes.creditReportId, reportId));
    await db.delete(inquiryDisputes).where(eq(inquiryDisputes.creditReportId, reportId));

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

    const now = new Date();

    // Store consumer profile if available
    if (parsedData.consumerProfile) {
      await saveConsumerProfile(report.clientId, reportId, report.bureau, parsedData.consumerProfile);
    }

    // Store parsed accounts with completeness scoring
    const storedAccountIds: string[] = [];
    const accountIdMap = new Map<string, string>(); // Map creditor+account# to accountId
    const completenessScores: number[] = [];
    
    for (const account of parsedData.accounts) {
      const accountId = randomUUID();
      storedAccountIds.push(accountId);
      
      // Create lookup key for linking negative items later
      const lookupKey = `${account.creditorName}|${account.accountNumber || ''}`.toLowerCase();
      accountIdMap.set(lookupKey, accountId);
      
      const accountStatus = account.accountStatus as StandardizedAccount['accountStatus'] | undefined;
      const paymentStatus = account.paymentStatus as StandardizedAccount['paymentStatus'] | undefined;
      const accountCategory = account.accountType as StandardizedAccount['accountCategory'] | undefined;

      const { completenessScore, missingFields, remarks } = buildCreditAccountDerivedFields({
        creditorName: account.creditorName,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        accountStatus: account.accountStatus,
        balance: account.balance,
        creditLimit: account.creditLimit,
        highCredit: account.highCredit,
        dateOpened: account.dateOpened,
        dateReported: account.dateReported,
        paymentStatus: account.paymentStatus,
        remarks: account.remarks,
      });
      
      completenessScores.push(completenessScore);

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
      
      const accountPresence = getAccountPresence(account, report.bureau);
      
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
        onTransunion: accountPresence.onTransunion,
        onExperian: accountPresence.onExperian,
        onEquifax: accountPresence.onEquifax,
        transunionDate: accountPresence.transunionDate,
        experianDate: accountPresence.experianDate,
        equifaxDate: accountPresence.equifaxDate,
        transunionBalance: accountPresence.transunionBalance,
        experianBalance: accountPresence.experianBalance,
        equifaxBalance: accountPresence.equifaxBalance,
        isNegative: isNegativeCalc,
        riskLevel: riskLevelCalc,
        completenessScore,
        missingFields,
        paymentHistoryGrid: account.paymentHistoryGrid ? JSON.stringify(account.paymentHistoryGrid) : null,
        remarks,
        createdAt: new Date(),
      });
    }

    const parserReview = determineParserReviewStatus({
      sourceConfidence: parsedData.detectedSource?.confidence,
      accountCompleteness: completenessScores,
      accountCount: parsedData.accounts.length,
    });

    if (parserReview.status === 'needs_review') {
      await db
        .update(creditReports)
        .set({
          parseStatus: 'completed',
          parserReviewStatus: 'needs_review',
          parserConfidence: parsedData.detectedSource?.confidence === 'high' ? 90 : parsedData.detectedSource?.confidence === 'medium' ? 60 : 30,
          parsedAt: now,
          rawData: JSON.stringify({
            scores: parsedData.scores,
            summary: parsedData.summary,
            accountCount: parsedData.accounts.length,
            negativeItemCount: parsedData.negativeItems.length,
            parserReviewReason: parserReview.reason,
          }),
        })
        .where(eq(creditReports.id, reportId));

      return;
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
      const derogatoryMatchResult = findDerogatoryMatch(item.creditorName, item.accountNumber, item.amount, derogatoryAccounts);
      const derogatoryMatch = derogatoryMatchResult.match;
      const matchedAccount = matchedAccountId
        ? parsedData.accounts.find(account => accountIdMap.get(`${account.creditorName}|${account.accountNumber || ''}`.toLowerCase()) === matchedAccountId)
        : undefined;
      const {
        onTransunion,
        onExperian,
        onEquifax,
        transunionDate,
        experianDate,
        equifaxDate,
        transunionStatus,
        experianStatus,
        equifaxStatus,
      } = getNegativeItemPresence({
        item,
        reportBureau: report.bureau,
        derogatoryMatch,
        matchedAccount,
      });

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
        dateOfFirstDelinquency: item.dateOfFirstDelinquency,
        bureauStatedRemovalDate: item.bureauStatedRemovalDate,
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
        notes: JSON.stringify({ matchConfidence: derogatoryMatchResult.confidence }),
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
    
    // Run cross-bureau discrepancy detection for this report pull only
    await detectBureauDiscrepancies(report.clientId, reportId);

    // Create or update analysis
    const analysisId = randomUUID();
    
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
        parserReviewStatus: 'approved',
        parserConfidence: parsedData.detectedSource?.confidence === 'high' ? 90 : parsedData.detectedSource?.confidence === 'medium' ? 60 : 30,
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
  item: {
    itemType: string;
    creditorName: string;
    dateReported?: Date;
    dateOfLastActivity?: Date;
    dateOfFirstDelinquency?: Date;
    bureauStatedRemovalDate?: Date;
  },
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
  
  // Calculate FCRA expiration date from the best available source.
  const obsolescenceClock = getObsolescenceClock({
    bureauStatedRemovalDate: item.bureauStatedRemovalDate,
    dateOfFirstDelinquency: item.dateOfFirstDelinquency,
    dateOfLastActivity: item.dateOfLastActivity,
    dateReported: item.dateReported,
  });
  const dateOfFirstDelinquency = obsolescenceClock.baseDate;
  let fcraExpirationDate: Date | null = null;
  let daysUntilExpiration: number | null = null;
  let isPastLimit = false;
  
  if (dateOfFirstDelinquency) {
    fcraExpirationDate = new Date(dateOfFirstDelinquency);
    fcraExpirationDate.setFullYear(fcraExpirationDate.getFullYear() + reportingLimitYears);
    
    const now = new Date();
    daysUntilExpiration = Math.ceil((fcraExpirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  const complianceStatus = buildFcraComplianceStatus({
    confidence: obsolescenceClock.confidence,
    reportingLimitYears,
    daysUntilExpiration,
  });
  isPastLimit = complianceStatus.isPastLimit;
  
  await db.insert(fcraComplianceItems).values({
    id: randomUUID(),
    clientId,
    negativeItemId,
    itemType: item.itemType,
    creditorName: item.creditorName,
    dateOfFirstDelinquency,
    dofdConfidence: obsolescenceClock.confidence,
    fcraExpirationDate,
    reportingLimitYears,
    daysUntilExpiration,
    isPastLimit,
    bureau,
    disputeStatus: complianceStatus.disputeStatus,
    notes: complianceStatus.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ============================================
// CROSS-BUREAU DISCREPANCY DETECTION
// ============================================

async function detectBureauDiscrepancies(clientId: string, creditReportId: string): Promise<void> {
  const allAccounts = await db
    .select()
    .from(creditAccounts)
    .where(and(eq(creditAccounts.clientId, clientId), eq(creditAccounts.creditReportId, creditReportId)));

  const allProfiles = await db
    .select()
    .from(consumerProfiles)
    .where(and(eq(consumerProfiles.clientId, clientId), eq(consumerProfiles.creditReportId, creditReportId)));

  // Clear existing discrepancies for this report before writing the latest pull snapshot.
  await db.delete(bureauDiscrepancies).where(eq(bureauDiscrepancies.creditReportId, creditReportId));

  const accountDiscrepancies = buildAccountBalanceDiscrepancies(clientId, creditReportId, allAccounts);
  if (accountDiscrepancies.length > 0) {
    await db.insert(bureauDiscrepancies).values(accountDiscrepancies);
  }

  await detectPiiDiscrepancies(clientId, creditReportId, allProfiles);
}

async function detectPiiDiscrepancies(
  clientId: string,
  creditReportId: string,
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
        creditReportId,
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
        creditReportId,
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

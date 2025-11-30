import { db } from '@/db/client';
import { creditReports, creditAccounts, negativeItems, creditAnalyses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getFileFromR2 } from './r2-storage';
import { parsePdfCreditReport, type ParsedCreditData } from './parsers/pdf-parser';
import { parseHtmlCreditReport } from './parsers/html-parser';

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

    // Store parsed accounts
    for (const account of parsedData.accounts) {
      await db.insert(creditAccounts).values({
        id: randomUUID(),
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
        bureau: report.bureau,
        isNegative: account.isNegative,
        riskLevel: account.riskLevel,
        remarks: account.remarks,
        createdAt: new Date(),
      });
    }

    // Store negative items
    for (const item of parsedData.negativeItems) {
      await db.insert(negativeItems).values({
        id: randomUUID(),
        creditReportId: reportId,
        clientId: report.clientId,
        itemType: item.itemType,
        creditorName: item.creditorName,
        originalCreditor: item.originalCreditor,
        amount: item.amount,
        dateReported: item.dateReported,
        bureau: report.bureau,
        riskSeverity: item.riskSeverity,
        recommendedAction: getRecommendedAction(item),
        createdAt: new Date(),
      });
    }

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

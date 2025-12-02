import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { 
  consultationRequests, 
  testimonials, 
  faqItems, 
  pages,
  clients,
  disputes,
  creditReports,
  negativeItems,
  creditAnalyses,
  clientAgreements,
  tasks
} from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { count, eq, and, or, sql, desc, isNull, lt, gt, gte, lte, between } from 'drizzle-orm';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) {
    return null;
  }
  
  return session.user;
}

export async function GET() {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      // Legacy stats
      newLeadsResult,
      pendingTestimonialsResult,
      publishedFaqsResult,
      activePagesResult,
      // Credit repair stats
      activeClientsResult,
      pendingReportsResult,
      disputesSentResult,
      disputesPendingResult,
      negativeItemsResult,
      // Dispute pipeline
      disputeRound1Result,
      disputeRound2Result,
      disputeRound3Result,
      disputesAwaitingResult,
      // Attention needed
      pendingAgreementsResult,
      overdueTasksResult,
      // Recent activity for timeline
      recentDisputesResult,
      recentReportsResult,
    ] = await Promise.all([
      // Legacy stats
      db.select({ count: count() }).from(consultationRequests).where(eq(consultationRequests.status, 'new')),
      db.select({ count: count() }).from(testimonials).where(eq(testimonials.isApproved, false)),
      db.select({ count: count() }).from(faqItems).where(eq(faqItems.isPublished, true)),
      db.select({ count: count() }).from(pages).where(eq(pages.isPublished, true)),
      // Credit repair stats
      db.select({ count: count() }).from(clients).where(eq(clients.status, 'active')),
      db.select({ count: count() }).from(creditReports).where(eq(creditReports.parseStatus, 'pending')),
      db.select({ count: count() }).from(disputes).where(eq(disputes.status, 'sent')),
      db.select({ count: count() }).from(disputes).where(or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress'))),
      db.select({ count: count() }).from(negativeItems),
      // Dispute pipeline by round
      db.select({ count: count() }).from(disputes).where(and(eq(disputes.round, 1), or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')))),
      db.select({ count: count() }).from(disputes).where(and(eq(disputes.round, 2), or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')))),
      db.select({ count: count() }).from(disputes).where(and(eq(disputes.round, 3), or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')))),
      db.select({ count: count() }).from(disputes).where(or(eq(disputes.status, 'draft'), eq(disputes.status, 'ready'))),
      // Attention needed
      db.select({ count: count() }).from(clientAgreements).where(eq(clientAgreements.status, 'pending')),
      db.select({ count: count() }).from(tasks).where(and(
        lt(tasks.dueDate, new Date()),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      )),
      // Recent activity
      db.select({
        id: disputes.id,
        clientId: disputes.clientId,
        bureau: disputes.bureau,
        status: disputes.status,
        createdAt: disputes.createdAt,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
        .from(disputes)
        .leftJoin(clients, eq(disputes.clientId, clients.id))
        .orderBy(desc(disputes.updatedAt))
        .limit(5),
      db.select({
        id: creditReports.id,
        clientId: creditReports.clientId,
        parseStatus: creditReports.parseStatus,
        uploadedAt: creditReports.uploadedAt,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
        .from(creditReports)
        .leftJoin(clients, eq(creditReports.clientId, clients.id))
        .orderBy(desc(creditReports.uploadedAt))
        .limit(5),
    ]);

    // Calculate average score change (simplified - would need historical data)
    const analysesWithScores = await db.select({
      scoreTransunion: creditAnalyses.scoreTransunion,
      scoreExperian: creditAnalyses.scoreExperian,
      scoreEquifax: creditAnalyses.scoreEquifax,
    }).from(creditAnalyses).limit(100);
    
    const avgScore = analysesWithScores.length > 0 
      ? Math.round(analysesWithScores.reduce((acc, a) => {
          const scores = [a.scoreTransunion, a.scoreExperian, a.scoreEquifax].filter(Boolean) as number[];
          return acc + (scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0);
        }, 0) / analysesWithScores.length)
      : 0;

    // Calculate success rate (disputes resolved as deleted / total resolved)
    const resolvedDisputes = await db.select({ outcome: disputes.outcome, bureau: disputes.bureau })
      .from(disputes)
      .where(eq(disputes.status, 'resolved'));
    
    const successRate = resolvedDisputes.length > 0
      ? Math.round((resolvedDisputes.filter(d => d.outcome === 'deleted').length / resolvedDisputes.length) * 100)
      : 0;

    // Success rate by bureau
    const bureaus = ['transunion', 'experian', 'equifax'];
    const successByBureau = bureaus.reduce((acc, bureau) => {
      const bureauDisputes = resolvedDisputes.filter(d => d.bureau === bureau);
      const deleted = bureauDisputes.filter(d => d.outcome === 'deleted').length;
      acc[bureau] = {
        total: bureauDisputes.length,
        deleted,
        rate: bureauDisputes.length > 0 ? Math.round((deleted / bureauDisputes.length) * 100) : 0,
      };
      return acc;
    }, {} as Record<string, { total: number; deleted: number; rate: number }>);

    // Disputes with response deadline in next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const responseDueSoon = await db.select({ count: count() })
      .from(disputes)
      .where(and(
        or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')),
        lte(disputes.responseDeadline, sevenDaysFromNow),
        gte(disputes.responseDeadline, new Date())
      ));

    // Overdue responses (past deadline, no response)
    const overdueResponses = await db.select({ count: count() })
      .from(disputes)
      .where(and(
        or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')),
        lt(disputes.responseDeadline, new Date()),
        isNull(disputes.responseReceivedAt)
      ));

    // Items removed this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const itemsRemovedThisMonth = await db.select({ count: count() })
      .from(disputes)
      .where(and(
        eq(disputes.outcome, 'deleted'),
        gte(disputes.updatedAt, startOfMonth)
      ));

    // Merge recent activity into timeline
    const recentActivity = [
      ...recentDisputesResult.map(d => ({
        type: 'dispute' as const,
        id: d.id,
        clientName: `${d.clientFirstName || ''} ${d.clientLastName || ''}`.trim() || 'Unknown',
        action: d.status === 'sent' ? 'Dispute sent' : `Dispute ${d.status}`,
        detail: d.bureau?.toUpperCase() || '',
        timestamp: d.createdAt,
      })),
      ...recentReportsResult.map(r => ({
        type: 'report' as const,
        id: r.id,
        clientName: `${r.clientFirstName || ''} ${r.clientLastName || ''}`.trim() || 'Unknown',
        action: r.parseStatus === 'completed' ? 'Report analyzed' : 'Report uploaded',
        detail: '',
        timestamp: r.uploadedAt,
      })),
    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 8);

    return NextResponse.json({
      // Legacy stats (keep for backwards compatibility)
      newLeads: newLeadsResult[0].count,
      pendingTestimonials: pendingTestimonialsResult[0].count,
      publishedFaqs: publishedFaqsResult[0].count,
      activePages: activePagesResult[0].count,
      // Credit repair metrics
      activeClients: activeClientsResult[0].count,
      pendingReports: pendingReportsResult[0].count,
      disputesSent: disputesSentResult[0].count,
      disputesPending: disputesPendingResult[0].count,
      totalNegativeItems: negativeItemsResult[0].count,
      avgCreditScore: avgScore,
      successRate,
      // Dispute pipeline
      disputePipeline: {
        round1: disputeRound1Result[0].count,
        round2: disputeRound2Result[0].count,
        round3: disputeRound3Result[0].count,
        awaiting: disputesAwaitingResult[0].count,
      },
      // Attention needed
      attentionNeeded: {
        pendingReports: pendingReportsResult[0].count,
        pendingAgreements: pendingAgreementsResult[0].count,
        overdueTasks: overdueTasksResult[0].count,
        responseDueSoon: responseDueSoon[0].count,
        overdueResponses: overdueResponses[0].count,
      },
      // Enhanced analytics
      successByBureau,
      itemsRemovedThisMonth: itemsRemovedThisMonth[0].count,
      // Recent activity
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

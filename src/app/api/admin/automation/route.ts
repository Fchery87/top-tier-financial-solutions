import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes, emailSendLog, emailAutomationRules } from '@/db/schema';
import { and, or, gte, count, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { getSetting } from '@/lib/settings-service';
import { getEscalationHealthStatus } from '@/lib/dispute-automation';

const ESCALATION_LAST_RUN_SETTING_KEY = 'automation.dispute_escalations.last_run';

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

export async function GET(_request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      sentTodayResult,
      failedTodayResult,
      pendingResult,
      activeRulesResult,
      recentFailuresResult,
      eligibleForEscalationResult,
      escalatedLast24hResult,
      escalationLastRunSetting,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(emailSendLog)
        .where(
          and(
            gte(emailSendLog.sentAt, startOfToday),
            eq(emailSendLog.status, 'sent')
          )
        ),
      db
        .select({ count: count() })
        .from(emailSendLog)
        .where(
          and(
            gte(emailSendLog.sentAt, startOfToday),
            or(
              eq(emailSendLog.status, 'failed'),
              eq(emailSendLog.status, 'bounced')
            )
          )
        ),
      db
        .select({ count: count() })
        .from(emailSendLog)
        .where(eq(emailSendLog.status, 'pending')),
      db
        .select({ count: count() })
        .from(emailAutomationRules)
        .where(eq(emailAutomationRules.isActive, true)),
      db
        .select({
          id: emailSendLog.id,
          toEmail: emailSendLog.toEmail,
          subject: emailSendLog.subject,
          triggerType: emailSendLog.triggerType,
          errorMessage: emailSendLog.errorMessage,
          createdAt: emailSendLog.createdAt,
        })
        .from(emailSendLog)
        .where(
          and(
            gte(emailSendLog.createdAt, last24h),
            or(
              eq(emailSendLog.status, 'failed'),
              eq(emailSendLog.status, 'bounced')
            )
          )
        )
        .orderBy(desc(emailSendLog.createdAt))
        .limit(3),
      db
        .select({ count: count() })
        .from(disputes)
        .where(
          and(
            inArray(disputes.status, ['sent', 'in_progress', 'responded']),
            isNull(disputes.responseReceivedAt),
            lte(disputes.escalationReadyAt, now)
          )
        ),
      db
        .select({ count: count() })
        .from(disputes)
        .where(
          and(
            eq(disputes.status, 'escalated'),
            gte(disputes.updatedAt, last24h)
          )
        ),
      getSetting(ESCALATION_LAST_RUN_SETTING_KEY),
    ]);

    type EscalationLastRun = {
      ranAt?: string;
      success?: boolean;
      dryRun?: boolean;
      checked?: number;
      escalated?: number;
      wouldEscalate?: number;
      skipped?: number;
      error?: string | null;
    };

    const runMeta: EscalationLastRun | null =
      escalationLastRunSetting && typeof escalationLastRunSetting === 'object'
        ? (escalationLastRunSetting as EscalationLastRun)
        : null;

    const escalationHealth = getEscalationHealthStatus({
      enabled: true,
      lastRunSuccess: runMeta?.success ?? null,
      lastRunAt: runMeta?.ranAt ?? null,
      staleAfterHours: 24,
    });

    return NextResponse.json({
      emailsSentToday: sentTodayResult[0]?.count ?? 0,
      emailsFailedToday: failedTodayResult[0]?.count ?? 0,
      pendingEmails: pendingResult[0]?.count ?? 0,
      automationsActive: activeRulesResult[0]?.count ?? 0,
      disputeEscalations: {
        eligibleNow: eligibleForEscalationResult[0]?.count ?? 0,
        escalatedLast24h: escalatedLast24hResult[0]?.count ?? 0,
        lastRunAt: runMeta?.ranAt ?? null,
        lastRunSuccess: runMeta?.success ?? null,
        lastRunDryRun: runMeta?.dryRun ?? null,
        lastRunChecked: runMeta?.checked ?? null,
        lastRunEscalated: runMeta?.escalated ?? null,
        lastRunWouldEscalate: runMeta?.wouldEscalate ?? null,
        lastRunSkipped: runMeta?.skipped ?? null,
        lastRunError: runMeta?.error ?? null,
        health: escalationHealth,
      },
      recentFailures: recentFailuresResult.map((f) => ({
        id: f.id,
        to_email: f.toEmail,
        subject: f.subject,
        trigger_type: f.triggerType,
        error_message: f.errorMessage,
        created_at: f.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error('Error fetching automation stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation stats' },
      { status: 500 }
    );
  }
}

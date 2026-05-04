import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { creditReports, disputeOutcomes } from '@/db/schema';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';

const bureauKeys = ['experian', 'transunion', 'equifax'] as const;

type BureauKey = typeof bureauKeys[number];

function emptyBureauProgress() {
  return {
    deleted: 0,
    updated: 0,
    verified: 0,
    new_negatives: 0,
  };
}

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
    const outcomes = await db
      .select({
        outcome: disputeOutcomes.outcome,
        bureau: disputeOutcomes.bureau,
        scoreImpact: disputeOutcomes.scoreImpact,
      })
      .from(disputeOutcomes);

    const newNegatives = await db
      .select({ bureau: creditReports.bureau })
      .from(creditReports);

    const bureauProgress: Record<BureauKey, ReturnType<typeof emptyBureauProgress>> = {
      experian: emptyBureauProgress(),
      transunion: emptyBureauProgress(),
      equifax: emptyBureauProgress(),
    };
    const outcomeCounts = { deleted: 0, updated: 0, verified: 0 };
    let totalScoreMovement = 0;

    for (const outcome of outcomes) {
      if (outcome.outcome === 'deleted') outcomeCounts.deleted += 1;
      if (outcome.outcome === 'updated') outcomeCounts.updated += 1;
      if (outcome.outcome === 'verified') outcomeCounts.verified += 1;
      if (typeof outcome.scoreImpact === 'number') totalScoreMovement += outcome.scoreImpact;

      if (outcome.bureau && bureauKeys.includes(outcome.bureau as BureauKey)) {
        const bureau = outcome.bureau as BureauKey;
        if (outcome.outcome === 'deleted') bureauProgress[bureau].deleted += 1;
        if (outcome.outcome === 'updated') bureauProgress[bureau].updated += 1;
        if (outcome.outcome === 'verified') bureauProgress[bureau].verified += 1;
      }
    }

    for (const item of newNegatives) {
      if (item.bureau && bureauKeys.includes(item.bureau as BureauKey)) {
        bureauProgress[item.bureau as BureauKey].new_negatives += 1;
      }
    }

    return NextResponse.json({
      client_outcome_analytics: {
        outcomes: outcomeCounts,
        score_movement: {
          total: totalScoreMovement,
        },
        new_negatives: {
          count: newNegatives.length,
        },
        bureau_progress: bureauProgress,
      },
    });
  } catch (error) {
    console.error('Error fetching client outcome analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch client outcome analytics' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { decideEscalation, loadDisputeChain } from '@/lib/dispute-escalation-decision';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const adminUser = await requireCapability('disputes:read');
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  const clientId = request.nextUrl.searchParams.get('clientId')?.trim() || '';
  const negativeItemId = request.nextUrl.searchParams.get('negativeItemId')?.trim() || '';
  if (!clientId || !negativeItemId) {
    return NextResponse.json({ error: 'clientId and negativeItemId are required' }, { status: 400 });
  }

  const history = await loadDisputeChain(id);
  const current = history[0];
  if (!current) return NextResponse.json({ error: 'Prior dispute not found' }, { status: 404 });

  if (current.clientId !== clientId || current.negativeItemId !== negativeItemId) {
    return NextResponse.json({
      eligible: false,
      reason: 'mismatched_dispute',
      eligible_at: null,
      message: 'The prior CRA dispute does not match the selected client and item.',
    }, { status: 409 });
  }

  const decision = decideEscalation({
    history,
    plan: {
      nextRound: 3,
      targetRecipient: 'cfpb',
      disputeType: 'fcra_violation_notice',
      methodology: 'factual',
      reasonCodes: [],
      customReason: 'CFPB complaint packet',
    },
  });
  const eligibility = decision.eligibility;

  return NextResponse.json({
    eligible: decision.kind === 'ready',
    reason: eligibility?.reason || 'missing_cra_dispute',
    eligible_at: eligibility?.eligibleAt?.toISOString() || null,
    message: decision.kind === 'blocked'
      ? decision.message
      : 'The prior CRA dispute is eligible for CFPB escalation.',
  });
}

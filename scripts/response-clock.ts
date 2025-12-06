/**
 * Response Clock Escalation Script
 * Finds disputes past escalationReadyAt and marks them escalated.
 * Run with: npx tsx scripts/response-clock.ts
 */

import { db } from '../db/client';
import { disputes } from '../db/schema';
import { and, lte, or, eq } from 'drizzle-orm';

async function run() {
  const now = new Date();
  console.log(`Running response clock at ${now.toISOString()}`);

  const ready = await db
    .select()
    .from(disputes)
    .where(
      and(
        or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')),
        lte(disputes.escalationReadyAt, now)
      )
    );

  let escalated = 0;

  for (const dispute of ready) {
    const history = dispute.escalationHistory ? JSON.parse(dispute.escalationHistory) : [];
    history.push({ escalatedAt: now.toISOString(), fromStatus: dispute.status });

    await db
      .update(disputes)
      .set({
        status: 'escalated',
        escalationHistory: JSON.stringify(history),
        updatedAt: now,
      })
      .where(eq(disputes.id, dispute.id));

    escalated += 1;
  }

  console.log(`Escalated ${escalated} disputes`);
}

run()
  .then(() => {
    console.log('Response clock complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Response clock failed', err);
    process.exit(1);
  });

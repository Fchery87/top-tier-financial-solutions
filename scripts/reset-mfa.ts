import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

import { session, twoFactor, user } from '../db/schema';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const USAGE = 'Usage: npm run security:reset-mfa -- <email> [--execute]';

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();
  if (!email) {
    console.error(USAGE);
    process.exit(1);
  }

  const { db } = await import('../db/client');
  const [account] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!account) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const enrolled = await db.select({ id: twoFactor.id }).from(twoFactor).where(eq(twoFactor.userId, account.id));
  console.log(`User ${account.email} (role ${String(account.role)}), two-factor ${account.twoFactorEnabled ? 'on' : 'off'}, ${enrolled.length} authenticator record(s).`);

  if (!execute) {
    console.log('Dry run. Nothing changed. Add --execute to remove the authenticator, backup codes, and all sessions.');
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, account.id));
    await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, account.id));
    await tx.delete(session).where(eq(session.userId, account.id));
  });
  console.log('Done. The user signs in with their password and is sent to set up two-step verification again.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { clients, clientNotificationPreferences } from '@/db/schema';
import { headers } from 'next/headers';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

async function getAuthenticatedClient(userId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.userId, userId))
    .limit(1);

  return client ?? null;
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function formatPreferences(preferences: {
  clientId: string;
  emailEnabled: boolean | null;
  messagingEmails: boolean | null;
  disputeUpdates: boolean | null;
  progressReports: boolean | null;
  marketingEmails: boolean | null;
  preferredFrequency: string | null;
}) {
  return {
    client_id: preferences.clientId,
    email_enabled: preferences.emailEnabled ?? true,
    messaging_emails: preferences.messagingEmails ?? true,
    dispute_updates: preferences.disputeUpdates ?? true,
    progress_reports: preferences.progressReports ?? true,
    marketing_emails: preferences.marketingEmails ?? false,
    preferred_frequency: preferences.preferredFrequency || 'immediate',
  };
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const [preferences] = await db
      .select()
      .from(clientNotificationPreferences)
      .where(eq(clientNotificationPreferences.clientId, client.id))
      .limit(1);

    return NextResponse.json({
      preferences: formatPreferences(preferences ?? {
        clientId: client.id,
        emailEnabled: true,
        messagingEmails: true,
        disputeUpdates: true,
        progressReports: true,
        marketingEmails: false,
        preferredFrequency: 'immediate',
      }),
    });
  } catch (error) {
    console.error('Error fetching portal notification preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch notification preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const client = await getAuthenticatedClient(user.id);

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const [existingPreferences] = await db
      .select()
      .from(clientNotificationPreferences)
      .where(eq(clientNotificationPreferences.clientId, client.id))
      .limit(1);

    const preferredFrequency = typeof body.preferred_frequency === 'string'
      ? body.preferred_frequency
      : (existingPreferences?.preferredFrequency || 'immediate');

    if (!['immediate', 'daily', 'weekly'].includes(preferredFrequency)) {
      return NextResponse.json({ error: 'Preferred frequency must be immediate, daily, or weekly' }, { status: 400 });
    }

    const nextPreferences = {
      id: existingPreferences?.id ?? randomUUID(),
      clientId: client.id,
      emailEnabled: toBoolean(body.email_enabled, existingPreferences?.emailEnabled ?? true),
      messagingEmails: toBoolean(body.messaging_emails, existingPreferences?.messagingEmails ?? true),
      disputeUpdates: toBoolean(body.dispute_updates, existingPreferences?.disputeUpdates ?? true),
      progressReports: toBoolean(body.progress_reports, existingPreferences?.progressReports ?? true),
      marketingEmails: toBoolean(body.marketing_emails, existingPreferences?.marketingEmails ?? false),
      preferredFrequency,
      updatedAt: new Date(),
    };

    if (existingPreferences) {
      await db
        .update(clientNotificationPreferences)
        .set({
          emailEnabled: nextPreferences.emailEnabled,
          messagingEmails: nextPreferences.messagingEmails,
          disputeUpdates: nextPreferences.disputeUpdates,
          progressReports: nextPreferences.progressReports,
          marketingEmails: nextPreferences.marketingEmails,
          preferredFrequency: nextPreferences.preferredFrequency,
          updatedAt: nextPreferences.updatedAt,
        })
        .where(eq(clientNotificationPreferences.id, existingPreferences.id));
    } else {
      await db.insert(clientNotificationPreferences).values({
        ...nextPreferences,
        createdAt: nextPreferences.updatedAt,
      });
    }

    return NextResponse.json({ preferences: formatPreferences(nextPreferences) });
  } catch (error) {
    console.error('Error updating portal notification preferences:', error);
    return NextResponse.json({ error: 'Failed to update notification preferences' }, { status: 500 });
  }
}

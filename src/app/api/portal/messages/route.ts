import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { clients, messages, messageThreads } from '@/db/schema';
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

function getIpAddress(headersList: Headers) {
  return headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ threads: [] });
    }

    const threadId = request.nextUrl.searchParams.get('thread_id');

    if (threadId) {
      const [thread] = await db
        .select()
        .from(messageThreads)
        .where(and(eq(messageThreads.id, threadId), eq(messageThreads.clientId, client.id)))
        .limit(1);

      if (!thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      const threadMessages = await db
        .select({
          id: messages.id,
          thread_id: messages.threadId,
          sender_type: messages.senderType,
          content: messages.content,
          is_read: messages.isRead,
          created_at: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(messages.createdAt);

      await db
        .update(messages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(messages.threadId, threadId),
          eq(messages.senderType, 'admin'),
          eq(messages.isRead, false),
        ));

      await db
        .update(messageThreads)
        .set({ unreadByClient: 0, updatedAt: new Date() })
        .where(eq(messageThreads.id, threadId));

      return NextResponse.json({
        thread: {
          id: thread.id,
          subject: thread.subject,
          status: thread.status,
          last_message_at: thread.lastMessageAt?.toISOString() || null,
          unread_by_client: thread.unreadByClient,
          created_at: thread.createdAt?.toISOString() || null,
        },
        messages: threadMessages.map((message) => ({
          ...message,
          created_at: message.created_at?.toISOString() || null,
        })),
      });
    }

    const threads = await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.clientId, client.id))
      .orderBy(messageThreads.lastMessageAt);

    return NextResponse.json({
      threads: threads.map((thread) => ({
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        last_message_at: thread.lastMessageAt?.toISOString() || null,
        unread_by_client: thread.unreadByClient,
        created_at: thread.createdAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching portal messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const threadId = body.thread_id as string | undefined;
    const subject = (body.subject as string | undefined)?.trim();
    const content = (body.content as string | undefined)?.trim();

    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const headersList = await headers();
    const senderIpAddress = getIpAddress(headersList);
    const now = new Date();

    if (threadId) {
      const [thread] = await db
        .select()
        .from(messageThreads)
        .where(and(eq(messageThreads.id, threadId), eq(messageThreads.clientId, client.id)))
        .limit(1);

      if (!thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      const messageId = randomUUID();
      await db.insert(messages).values({
        id: messageId,
        threadId,
        senderId: user.id,
        senderType: 'client',
        content,
        isRead: false,
        senderIpAddress,
        createdAt: now,
      });

      await db
        .update(messageThreads)
        .set({
          lastMessageAt: now,
          unreadByAdmin: 1,
          status: 'open',
          updatedAt: now,
        })
        .where(eq(messageThreads.id, threadId));

      return NextResponse.json({ message_id: messageId });
    }

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required for a new thread' }, { status: 400 });
    }

    const newThreadId = randomUUID();
    const messageId = randomUUID();

    await db.insert(messageThreads).values({
      id: newThreadId,
      clientId: client.id,
      subject,
      status: 'open',
      lastMessageAt: now,
      unreadByAdmin: 1,
      unreadByClient: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(messages).values({
      id: messageId,
      threadId: newThreadId,
      senderId: user.id,
      senderType: 'client',
      content,
      isRead: false,
      senderIpAddress,
      createdAt: now,
    });

    return NextResponse.json({ thread_id: newThreadId, message_id: messageId }, { status: 201 });
  } catch (error) {
    console.error('Error sending portal message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

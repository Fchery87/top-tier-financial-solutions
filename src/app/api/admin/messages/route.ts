import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { messageThreads, messages, clients, user } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// GET - List message threads or messages in a thread
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('thread_id');
    const clientId = searchParams.get('client_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (threadId) {
      // Get messages in a thread
      const thread = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, threadId))
        .limit(1);

      if (!thread.length) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      const threadMessages = await db
        .select({
          id: messages.id,
          thread_id: messages.threadId,
          sender_id: messages.senderId,
          sender_type: messages.senderType,
          content: messages.content,
          is_read: messages.isRead,
          read_at: messages.readAt,
          created_at: messages.createdAt,
          sender_name: user.name,
        })
        .from(messages)
        .leftJoin(user, eq(messages.senderId, user.id))
        .where(eq(messages.threadId, threadId))
        .orderBy(messages.createdAt);

      // Mark messages as read by admin
      await db
        .update(messages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(messages.threadId, threadId),
          eq(messages.senderType, 'client'),
          eq(messages.isRead, false)
        ));

      // Reset admin unread count
      await db
        .update(messageThreads)
        .set({ unreadByAdmin: 0 })
        .where(eq(messageThreads.id, threadId));

      return NextResponse.json({
        thread: thread[0],
        messages: threadMessages,
      });
    } else {
      // List threads
      let baseQuery = db
        .select({
          id: messageThreads.id,
          client_id: messageThreads.clientId,
          subject: messageThreads.subject,
          status: messageThreads.status,
          last_message_at: messageThreads.lastMessageAt,
          unread_by_admin: messageThreads.unreadByAdmin,
          unread_by_client: messageThreads.unreadByClient,
          created_at: messageThreads.createdAt,
          client_name: sql<string>`${clients.firstName} || ' ' || ${clients.lastName}`,
          client_email: clients.email,
        })
        .from(messageThreads)
        .leftJoin(clients, eq(messageThreads.clientId, clients.id))
        .orderBy(desc(messageThreads.lastMessageAt))
        .limit(limit)
        .offset(offset);

      if (clientId) {
        baseQuery = baseQuery.where(eq(messageThreads.clientId, clientId)) as typeof baseQuery;
      }

      const items = await baseQuery;

      // Get total unread count
      const unreadResult = await db
        .select({ total: sql<number>`COALESCE(SUM(unread_by_admin), 0)` })
        .from(messageThreads);

      return NextResponse.json({
        items,
        total_unread: Number(unreadResult[0].total),
        page,
        limit,
      });
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Create new thread or send message
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { threadId, clientId, subject, content } = body;

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';

    if (threadId) {
      // Send message to existing thread
      const thread = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, threadId))
        .limit(1);

      if (!thread.length) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      const messageId = crypto.randomUUID();
      await db.insert(messages).values({
        id: messageId,
        threadId,
        senderId: session.user.id,
        senderType: 'admin',
        content,
        isRead: false,
        senderIpAddress: ipAddress,
      });

      // Update thread
      await db
        .update(messageThreads)
        .set({
          lastMessageAt: new Date(),
          unreadByClient: sql`unread_by_client + 1`,
          status: 'open',
          updatedAt: new Date(),
        })
        .where(eq(messageThreads.id, threadId));

      return NextResponse.json({ id: messageId, message: 'Message sent successfully' });
    } else {
      // Create new thread
      if (!clientId || !subject || !content) {
        return NextResponse.json({ error: 'Client ID, subject, and content are required' }, { status: 400 });
      }

      // Verify client exists
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (!client.length) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      const newThreadId = crypto.randomUUID();
      await db.insert(messageThreads).values({
        id: newThreadId,
        clientId,
        subject,
        status: 'open',
        lastMessageAt: new Date(),
        unreadByClient: 1,
        unreadByAdmin: 0,
      });

      const messageId = crypto.randomUUID();
      await db.insert(messages).values({
        id: messageId,
        threadId: newThreadId,
        senderId: session.user.id,
        senderType: 'admin',
        content,
        isRead: false,
        senderIpAddress: ipAddress,
      });

      return NextResponse.json({ 
        threadId: newThreadId, 
        messageId, 
        message: 'Thread created and message sent successfully' 
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

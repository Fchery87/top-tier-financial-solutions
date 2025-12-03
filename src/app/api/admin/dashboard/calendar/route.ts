import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disputes, tasks, clientAgreements, clients } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdmin } from '@/lib/admin-auth';
import { and, gte, lte, eq, isNull, or } from 'drizzle-orm';

interface CalendarEvent {
  id: string;
  type: 'deadline' | 'task' | 'agreement' | 'followup';
  title: string;
  date: string;
  clientName?: string;
  clientId?: string;
  priority: 'high' | 'medium' | 'low';
}

async function validateAdminAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return false;
  }
  
  return await isAdmin(session.user.email);
}

export async function GET(request: NextRequest) {
  const authorized = await validateAdminAccess();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const events: CalendarEvent[] = [];

    // Get dispute response deadlines (30-day marks)
    const upcomingDeadlines = await db
      .select({
        id: disputes.id,
        responseDeadline: disputes.responseDeadline,
        clientId: disputes.clientId,
        bureau: disputes.bureau,
        creditorName: disputes.creditorName,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(disputes)
      .leftJoin(clients, eq(disputes.clientId, clients.id))
      .where(
        and(
          gte(disputes.responseDeadline, sevenDaysAgo),
          lte(disputes.responseDeadline, twoWeeksFromNow),
          eq(disputes.status, 'sent'),
          isNull(disputes.outcome)
        )
      );

    for (const deadline of upcomingDeadlines) {
      if (!deadline.responseDeadline) continue;
      
      const isOverdue = deadline.responseDeadline < now;
      const daysUntil = Math.ceil((deadline.responseDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      events.push({
        id: `deadline-${deadline.id}`,
        type: 'deadline',
        title: `${deadline.bureau} Response ${isOverdue ? 'OVERDUE' : 'Due'}`,
        date: deadline.responseDeadline.toISOString(),
        clientName: `${deadline.clientFirstName} ${deadline.clientLastName}`,
        clientId: deadline.clientId,
        priority: isOverdue ? 'high' : daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
      });
    }

    // Get upcoming tasks
    const upcomingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        clientId: tasks.clientId,
        priority: tasks.priority,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(
        and(
          gte(tasks.dueDate, sevenDaysAgo),
          lte(tasks.dueDate, twoWeeksFromNow),
          or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
        )
      );

    for (const task of upcomingTasks) {
      if (!task.dueDate) continue;
      
      const isOverdue = task.dueDate < now;
      
      events.push({
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        date: task.dueDate.toISOString(),
        clientName: task.clientFirstName && task.clientLastName 
          ? `${task.clientFirstName} ${task.clientLastName}` 
          : undefined,
        clientId: task.clientId || undefined,
        priority: isOverdue ? 'high' : task.priority === 'urgent' ? 'high' : task.priority === 'high' ? 'high' : 'medium',
      });
    }

    // Get agreement expirations
    const expiringAgreements = await db
      .select({
        id: clientAgreements.id,
        expiresAt: clientAgreements.expiresAt,
        clientId: clientAgreements.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(clientAgreements)
      .leftJoin(clients, eq(clientAgreements.clientId, clients.id))
      .where(
        and(
          gte(clientAgreements.expiresAt, now),
          lte(clientAgreements.expiresAt, twoWeeksFromNow),
          eq(clientAgreements.status, 'pending')
        )
      );

    for (const agreement of expiringAgreements) {
      if (!agreement.expiresAt) continue;
      
      const daysUntil = Math.ceil((agreement.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      events.push({
        id: `agreement-${agreement.id}`,
        type: 'agreement',
        title: 'Agreement Expires',
        date: agreement.expiresAt.toISOString(),
        clientName: `${agreement.clientFirstName} ${agreement.clientLastName}`,
        clientId: agreement.clientId,
        priority: daysUntil <= 2 ? 'high' : 'medium',
      });
    }

    // Sort events by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by date
    const groupedByDate: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const dateKey = event.date.split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(event);
    }

    // Get counts by type
    const counts = {
      deadlines: events.filter(e => e.type === 'deadline').length,
      tasks: events.filter(e => e.type === 'task').length,
      agreements: events.filter(e => e.type === 'agreement').length,
      overdue: events.filter(e => new Date(e.date) < now).length,
    };

    return NextResponse.json({
      events: events.slice(0, 20), // Limit to 20 events
      groupedByDate,
      counts,
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

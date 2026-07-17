'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  FileSignature,
  ListTodo,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  type: 'deadline' | 'task' | 'agreement' | 'followup';
  title: string;
  date: string;
  clientName?: string;
  clientId?: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarData {
  events: CalendarEvent[];
  counts: {
    deadlines: number;
    tasks: number;
    agreements: number;
    overdue: number;
  };
}

const TYPE_CONFIG = {
  deadline: { icon: Clock, color: 'text-destructive', label: 'Response Deadline' },
  task: { icon: ListTodo, color: 'text-warning', label: 'Task' },
  agreement: { icon: FileSignature, color: 'text-secondary', label: 'Agreement' },
  followup: { icon: Calendar, color: 'text-secondary', label: 'Follow-up' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const isPast = date < now;

  if (isToday) return isPast ? 'Today (Overdue)' : 'Today';
  if (isTomorrow) return 'Tomorrow';

  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `In ${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function WidgetTitle({ overdue }: { overdue: number }) {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Upcoming · Next 2 weeks
      </CardTitle>
      {overdue > 0 && (
        <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-destructive">
          {overdue} overdue
        </span>
      )}
    </div>
  );
}

export function CalendarWidget() {
  const [data, setData] = React.useState<CalendarData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchCalendar() {
      try {
        const response = await fetch('/api/admin/dashboard/calendar');
        if (response.ok) {
          const calendarData = await response.json();
          setData(calendarData);
        }
      } catch (error) {
        console.error('Error fetching calendar:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCalendar();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="border-b pb-4">
          <WidgetTitle overdue={0} />
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdue = data?.counts.overdue || 0;

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <WidgetTitle overdue={overdue} />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {/* Quick counts — hairline-joined strip */}
        <div className="grid grid-cols-3 gap-px border-b border-border/70 bg-border/70">
          {(
            [
              { label: 'Deadlines', value: data?.counts.deadlines || 0, tone: 'text-destructive' },
              { label: 'Tasks', value: data?.counts.tasks || 0, tone: 'text-warning' },
              { label: 'Agreements', value: data?.counts.agreements || 0, tone: 'text-secondary' },
            ] as const
          ).map((stat) => (
            <div key={stat.label} className="bg-card px-3 py-2.5 text-center">
              <p className={cn('font-mono text-lg font-semibold leading-none tabular-nums', stat.tone)}>{stat.value}</p>
              <p className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Event list */}
        {data?.events && data.events.length > 0 ? (
          <div className="divide-y divide-border/70">
            {data.events.slice(0, 5).map((event) => {
              const config = TYPE_CONFIG[event.type];
              const Icon = config.icon;
              const isPast = new Date(event.date) < new Date();

              const row = (
                <>
                  <Icon className={cn('h-4 w-4 shrink-0', config.color)} strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{event.title}</p>
                    {event.clientName && (
                      <p className="truncate text-xs text-muted-foreground">{event.clientName}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'whitespace-nowrap font-mono text-[10px] tabular-nums',
                      isPast ? 'font-semibold text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {formatDate(event.date)}
                  </span>
                </>
              );

              return event.clientId ? (
                <Link
                  key={event.id}
                  href={`/admin/clients/${event.clientId}`}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-muted/40"
                >
                  {row}
                  <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors duration-[120ms] group-hover:text-secondary" strokeWidth={1.75} />
                </Link>
              ) : (
                <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                  {row}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-2 h-8 w-8 opacity-40" strokeWidth={1.5} />
            <p className="text-sm">No upcoming events</p>
            <p className="mt-1 text-xs">All clear for the next 2 weeks.</p>
          </div>
        )}

        {/* View all link */}
        {data?.events && data.events.length > 5 && (
          <Link
            href="/admin/tasks"
            className="block border-t border-border/70 px-4 py-2.5 text-center font-mono text-[11px] text-muted-foreground transition-colors duration-[120ms] ease-[var(--ease-out)] hover:text-secondary"
          >
            View all {data.events.length} events →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

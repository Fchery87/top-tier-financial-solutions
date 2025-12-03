'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  FileSignature, 
  ListTodo,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

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
  deadline: { 
    icon: Clock, 
    color: 'text-red-500', 
    bgColor: 'bg-red-500/10',
    label: 'Response Deadline'
  },
  task: { 
    icon: ListTodo, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500/10',
    label: 'Task'
  },
  agreement: { 
    icon: FileSignature, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500/10',
    label: 'Agreement'
  },
  followup: { 
    icon: Calendar, 
    color: 'text-purple-500', 
    bgColor: 'bg-purple-500/10',
    label: 'Follow-up'
  },
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
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Calendar className="w-5 h-5 text-secondary" />
            Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasOverdue = (data?.counts.overdue || 0) > 0;

  return (
    <Card className={`bg-card/80 backdrop-blur-sm border-border/50 ${hasOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Calendar className="w-5 h-5 text-secondary" />
              Upcoming
            </CardTitle>
            <CardDescription>
              Next 2 weeks
            </CardDescription>
          </div>
          {hasOverdue && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {data?.counts.overdue} overdue
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-red-500/10">
            <p className="text-lg font-bold text-red-500">{data?.counts.deadlines || 0}</p>
            <p className="text-[10px] text-muted-foreground">Deadlines</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-orange-500/10">
            <p className="text-lg font-bold text-orange-500">{data?.counts.tasks || 0}</p>
            <p className="text-[10px] text-muted-foreground">Tasks</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-500/10">
            <p className="text-lg font-bold text-blue-500">{data?.counts.agreements || 0}</p>
            <p className="text-[10px] text-muted-foreground">Agreements</p>
          </div>
        </div>

        {/* Event list */}
        <div className="space-y-2">
          {data?.events.slice(0, 5).map((event, index) => {
            const config = TYPE_CONFIG[event.type];
            const Icon = config.icon;
            const isPast = new Date(event.date) < new Date();
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {event.clientId ? (
                  <Link
                    href={`/admin/clients/${event.clientId}`}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group ${isPast ? 'bg-red-500/5' : ''}`}
                  >
                    <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {event.clientName && (
                        <p className="text-xs text-muted-foreground truncate">{event.clientName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs ${isPast ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                        {formatDate(event.date)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-secondary" />
                    </div>
                  </Link>
                ) : (
                  <div className={`flex items-center gap-3 p-2 rounded-lg ${isPast ? 'bg-red-500/5' : ''}`}>
                    <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                    </div>
                    <span className={`text-xs ${isPast ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                      {formatDate(event.date)}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {(!data?.events || data.events.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events</p>
            <p className="text-xs mt-1">All clear for the next 2 weeks!</p>
          </div>
        )}

        {/* View all link */}
        {data?.events && data.events.length > 5 && (
          <Link
            href="/admin/tasks"
            className="block text-center text-xs text-muted-foreground hover:text-secondary mt-3 pt-3 border-t border-border/50"
          >
            View all {data.events.length} events →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

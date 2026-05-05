'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Target, CheckCircle, Clock } from 'lucide-react';
import type { PortalTask } from '@/components/portal/types';

interface PortalTasksProps {
  tasks: PortalTask[];
}

export default function PortalTasks({ tasks }: PortalTasksProps) {
  const sortedTasks = React.useMemo(() => {
    const pending = tasks.filter((t) => t.status !== 'done');
    if (pending.length === 0) return [] as PortalTask[];

    const priorityWeight: Record<PortalTask['priority'], number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...pending].sort((a, b) => {
      if (a.is_blocking !== b.is_blocking) return a.is_blocking ? -1 : 1;
      const pa = priorityWeight[a.priority];
      const pb = priorityWeight[b.priority];
      if (pa !== pb) return pa - pb;

      const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;

      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ca - cb;
    });
  }, [tasks]);

  const nextTask = sortedTasks[0] ?? null;
  const remainingTasks = nextTask
    ? sortedTasks.filter((t) => t.id !== nextTask.id)
    : sortedTasks;

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Target className="w-5 h-5 text-secondary" />
            Your Next Step
          </CardTitle>
          <CardDescription>
            {nextTask
              ? 'Complete this to keep your case moving smoothly.'
              : 'You are all caught up for now.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nextTask ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <p className="text-sm font-medium text-foreground">{nextTask.title}</p>
                {nextTask.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {nextTask.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  {nextTask.is_blocking && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                      Required
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-muted/70 capitalize">
                    {nextTask.priority} priority
                  </span>
                  {nextTask.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Due {new Date(nextTask.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {tasks.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {tasks.length - 1} other task{tasks.length - 1 === 1 ? '' : 's'} open.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>No open action items from us right now.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {sortedTasks.length > 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-secondary" />
              Your Tasks
            </CardTitle>
            <CardDescription>
              A summary of open items we may ask you to complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextTask && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <p className="text-xs font-semibold text-secondary mb-1">
                  Next step
                </p>
                <p className="text-sm font-medium text-foreground">{nextTask.title}</p>
                {nextTask.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {nextTask.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
                  {nextTask.is_blocking && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                      Required
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-muted/70 capitalize">
                    {nextTask.priority} priority
                  </span>
                  {nextTask.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Due {new Date(nextTask.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {remainingTasks.length > 0 && (
              <div className="space-y-2 max-h-[160px] overflow-y-auto">
                {remainingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-2 rounded-lg bg-muted/30 border border-border/40"
                  >
                    <p className="text-xs font-medium text-foreground truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      {task.is_blocking && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">
                          Required
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-full bg-muted/70 capitalize">
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

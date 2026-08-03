'use client';

import { AlertTriangle, Clock, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export interface ResponseReviewQueueDispute {
  id: string;
  clientName: string;
  bureau: string;
  round: number;
  responseDeadline: string | null;
}

function isOverdue(responseDeadline: string | null): boolean {
  return responseDeadline !== null && new Date(responseDeadline) < new Date();
}

function formatDeadline(responseDeadline: string | null): string {
  if (!responseDeadline) return 'No recorded deadline';
  return new Date(responseDeadline).toLocaleDateString();
}

export function ResponseReviewQueue({
  disputes,
  onReview,
}: {
  disputes: ResponseReviewQueueDispute[];
  onReview: (dispute: ResponseReviewQueueDispute) => void;
}) {
  const orderedDisputes = [...disputes].sort((left, right) => {
    const leftDeadline = left.responseDeadline ? new Date(left.responseDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDeadline = right.responseDeadline ? new Date(right.responseDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDeadline - rightDeadline;
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-secondary" />
          Response review queue
        </CardTitle>
        <CardDescription>Review received responses or record an overdue no-response outcome before any follow-up draft is created.</CardDescription>
      </CardHeader>
      <CardContent>
        {orderedDisputes.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4" />
            No response reviews are waiting.
          </div>
        ) : (
          <div className="space-y-2">
            {orderedDisputes.map(dispute => {
              const overdue = isOverdue(dispute.responseDeadline);
              return (
                <div key={dispute.id} className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{dispute.clientName}</p>
                    <p className="text-xs text-muted-foreground">Round {dispute.round} · {dispute.bureau}</p>
                    <p className={overdue ? 'mt-1 flex items-center gap-1 text-xs text-destructive' : 'mt-1 flex items-center gap-1 text-xs text-muted-foreground'}>
                      {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {overdue ? `Overdue since ${formatDeadline(dispute.responseDeadline)}` : `Deadline ${formatDeadline(dispute.responseDeadline)}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => onReview(dispute)} aria-label={`Review response for ${dispute.clientName}`}>
                    Review response
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Scale, Trophy, Clock } from 'lucide-react';
import type { PortalDispute, DisputeStats } from '@/components/portal/types';

interface PortalDisputesProps {
  disputes: PortalDispute[];
  disputeStats: DisputeStats | null;
}

export default function PortalDisputes({ disputes, disputeStats }: PortalDisputesProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <Scale className="w-5 h-5 text-secondary" />
          Dispute Progress
        </CardTitle>
        <CardDescription>
          Track the status of your credit disputes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disputeStats && disputeStats.total > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold text-foreground">{disputeStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                <p className="text-2xl font-bold text-blue-500">{disputeStats.in_progress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
                <p className="text-2xl font-bold text-yellow-500">{disputeStats.awaiting}</p>
                <p className="text-xs text-muted-foreground">Awaiting</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <p className="text-2xl font-bold text-green-500">{disputeStats.deleted}</p>
                <p className="text-xs text-muted-foreground">Deleted</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {disputes.map((dispute) => (
                <div
                  key={dispute.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    dispute.outcome === 'deleted'
                      ? 'bg-green-500/10 border-green-500/30'
                      : dispute.status === 'sent'
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-muted/30 border-border/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {dispute.outcome === 'deleted' ? (
                          <Trophy className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : dispute.status === 'sent' ? (
                          <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        ) : (
                          <Scale className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <p className="text-sm font-medium truncate">{dispute.creditor_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dispute.bureau.toUpperCase()} &bull; Round {dispute.round}
                        {dispute.item_type && ` \u2022 ${dispute.item_type.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {dispute.outcome === 'deleted' ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                          Removed
                        </span>
                      ) : dispute.outcome === 'verified' ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                          Escalating
                        </span>
                      ) : dispute.status === 'sent' ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-500">
                          In Review
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                          {dispute.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {dispute.sent_at && !dispute.outcome && dispute.response_deadline && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Response expected by {new Date(dispute.response_deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No disputes in progress yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              We&apos;ll start disputing negative items once your credit report is analyzed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

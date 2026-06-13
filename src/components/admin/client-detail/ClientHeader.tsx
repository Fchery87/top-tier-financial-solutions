'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  FileBarChart,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import type { ClientDetail, ClientDisputeStatus, CreditAnalysis } from './types';
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_CLASSES } from './types';

interface ClientHeaderProps {
  client: ClientDetail;
  disputeStatus: ClientDisputeStatus;
  latestAnalysis: CreditAnalysis | null;
  openDisputesCount: number;
  reportsCount: number;
  onRefresh: () => void;
  onUploadReport: () => void;
  onAuditReport: () => void;
}

export function ClientHeader({
  client,
  disputeStatus,
  latestAnalysis,
  openDisputesCount,
  reportsCount,
  onRefresh,
  onUploadReport,
  onAuditReport,
}: ClientHeaderProps) {
  const router = useRouter();

  const today = new Date();
  const daysActive = Math.floor(
    (today.getTime() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  const averageScore = latestAnalysis
    ? Math.round(
        ((latestAnalysis.score_transunion || 0) +
          (latestAnalysis.score_experian || 0) +
          (latestAnalysis.score_equifax || 0)) /
          [
            latestAnalysis.score_transunion,
            latestAnalysis.score_experian,
            latestAnalysis.score_equifax,
          ].filter(Boolean).length,
      )
    : null;

  return (
    <div className="border-b border-border/50 pb-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/clients')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-secondary">
              Client Case File
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
              {client.first_name} {client.last_name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={client.status} variant={getStatusVariant(client.status)} />
              <span className="text-sm text-muted-foreground">
                Client since {new Date(client.converted_at).toLocaleDateString()}
              </span>
              {disputeStatus && (
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${DISPUTE_STATUS_CLASSES[disputeStatus]}`}
                >
                  Disputes: {DISPUTE_STATUS_LABELS[disputeStatus]}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAuditReport}
            disabled={!latestAnalysis}
          >
            <FileBarChart className="w-4 h-4 mr-2" />
            Audit Report
          </Button>
          <Button size="sm" onClick={onUploadReport}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Report
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-4 ml-14 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Credit Score</span>
          <ScoreBadge score={averageScore} variant="gauge" size="md" showLabel />
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-medium tabular-nums">{openDisputesCount}</span>{' '}
            <span className="text-muted-foreground">Open Disputes</span>
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-medium tabular-nums">{daysActive}</span>{' '}
            <span className="text-muted-foreground">Days Active</span>
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-medium tabular-nums">{reportsCount}</span>{' '}
            <span className="text-muted-foreground">Reports</span>
          </span>
        </div>
      </div>
    </div>
  );
}

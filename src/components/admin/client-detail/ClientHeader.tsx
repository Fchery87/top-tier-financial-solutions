'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
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

  const scoreColor = averageScore
    ? averageScore >= 750
      ? 'text-green-500'
      : averageScore >= 700
        ? 'text-lime-500'
        : averageScore >= 650
          ? 'text-yellow-500'
          : averageScore >= 600
            ? 'text-orange-500'
            : 'text-red-500'
    : 'text-muted-foreground';

  return (
    <div className="border-b border-border/50 pb-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/clients')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-serif font-bold text-foreground"
            >
              {client.first_name} {client.last_name}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 mt-1 flex-wrap"
            >
              <StatusBadge status={client.status} variant={getStatusVariant(client.status)} />
              <span className="text-muted-foreground text-sm">
                Client since {new Date(client.converted_at).toLocaleDateString()}
              </span>
              {disputeStatus && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full border ${DISPUTE_STATUS_CLASSES[disputeStatus]}`}
                >
                  Disputes: {DISPUTE_STATUS_LABELS[disputeStatus]}
                </span>
              )}
            </motion.div>
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
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Credit Score</span>
          <span className={`text-lg font-bold ${scoreColor}`}>
            {averageScore ?? '—'}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-medium">{openDisputesCount}</span>{' '}
            <span className="text-muted-foreground">Open Disputes</span>
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-medium">{daysActive}</span>{' '}
            <span className="text-muted-foreground">Days Active</span>
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-medium">{reportsCount}</span>{' '}
            <span className="text-muted-foreground">Reports</span>
          </span>
        </div>
      </div>
    </div>
  );
}

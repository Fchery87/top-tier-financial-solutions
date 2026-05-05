'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  Scale,
  Trophy,
  Zap,
  FileText,
  ListTodo,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WorkQueue } from '@/components/admin/WorkQueue';
import { TeamActivity } from '@/components/admin/TeamActivity';
import { AutomationStatus } from '@/components/admin/AutomationStatus';

interface DashboardStats {
  activeClients: number;
  pendingReports: number;
  disputesSent: number;
  disputesPending: number;
  totalNegativeItems: number;
  avgCreditScore: number;
  successRate: number;
  disputePipeline: {
    round1: number;
    round2: number;
    round3: number;
    awaiting: number;
  };
  attentionNeeded: {
    pendingReports: number;
    pendingAgreements: number;
    overdueTasks: number;
    responseDueSoon: number;
    overdueResponses: number;
  };
  successByBureau: {
    transunion: { total: number; deleted: number; rate: number };
    experian: { total: number; deleted: number; rate: number };
    equifax: { total: number; deleted: number; rate: number };
  };
  itemsRemovedThisMonth: number;
  recentActivity: Array<{
    type: 'dispute' | 'report';
    id: string;
    clientName: string;
    action: string;
    detail: string;
    timestamp: string;
  }>;
  newLeads: number;
}

interface OperationsTabProps {
  stats: DashboardStats | null;
  showWorkQueue: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

export function OperationsTab({ stats, showWorkQueue, isSuperAdmin, isAdmin }: OperationsTabProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/admin/clients">
                <Users className="w-5 h-5" />
                <span className="text-xs">Clients</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/admin/disputes">
                <Scale className="w-5 h-5" />
                <span className="text-xs">Disputes</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/admin/results">
                <Trophy className="w-5 h-5" />
                <span className="text-xs">Results</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/admin/disputes/wizard">
                <Zap className="w-5 h-5" />
                <span className="text-xs">New Dispute</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/admin/dispute-templates">
                <FileText className="w-5 h-5" />
                <span className="text-xs">Templates</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/admin/tasks">
                <ListTodo className="w-5 h-5" />
                <span className="text-xs">Tasks</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {showWorkQueue && <WorkQueue />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(isSuperAdmin || isAdmin) && <TeamActivity />}
        <AutomationStatus />
      </div>

      {(stats?.newLeads ?? 0) > 0 && (isSuperAdmin || isAdmin) && (
        <Link href="/admin/leads">
          <Card className="bg-gradient-to-r from-secondary/5 to-transparent border-secondary/20 hover:border-secondary/40 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium">New Leads Waiting</p>
                  <p className="text-xs text-muted-foreground">Convert leads into clients</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-secondary">{stats?.newLeads ?? 0}</span>
                <ArrowRight className="w-5 h-5 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}

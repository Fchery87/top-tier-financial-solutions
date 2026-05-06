'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, ShieldCheck, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAdminRole } from '@/contexts/AdminContext';
import { DashboardTabs, type DashboardTab } from '@/components/admin/dashboard/DashboardTabs';
import { OverviewTab } from '@/components/admin/dashboard/OverviewTab';
import { PipelineTab } from '@/components/admin/dashboard/PipelineTab';
import { AnalyticsTab } from '@/components/admin/dashboard/AnalyticsTab';
import { OperationsTab } from '@/components/admin/dashboard/OperationsTab';
import { useDashboardStats } from '@/hooks/useAdminQueries';
import { formatTimeAgo } from '@/lib/format';

const TAB_STORAGE_KEY = 'admin-dashboard-tab';

export default function AdminDashboard() {
  const { role, isSuperAdmin, isAdmin } = useAdminRole();
  const { data: stats, isLoading: loading } = useDashboardStats();
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    const stored = window.localStorage.getItem('admin-dashboard-density');
    if (stored === 'comfortable' || stored === 'compact') return stored;
    return role === 'staff' ? 'compact' : 'comfortable';
  });
  const [hasLocalDensity, setHasLocalDensity] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('admin-dashboard-density');
    return stored === 'comfortable' || stored === 'compact';
  });
  const [showWorkQueue, setShowWorkQueue] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<DashboardTab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (stored === 'overview' || stored === 'pipeline' || stored === 'analytics' || stored === 'operations') return stored;
    return 'overview';
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    }
  }, [activeTab]);

  const totalAttention = stats
    ? (stats.attentionNeeded?.pendingReports ?? 0) +
      (stats.attentionNeeded?.pendingAgreements ?? 0) +
      (stats.attentionNeeded?.overdueTasks ?? 0) +
      (stats.attentionNeeded?.responseDueSoon ?? 0) +
      (stats.attentionNeeded?.overdueResponses ?? 0)
    : 0;

  const metricCardPadding = density === 'compact' ? 'p-3' : 'p-4';
  const metricGridGap = density === 'compact' ? 'gap-3' : 'gap-4';
  const isCompact = density === 'compact';

  const handleSetDensity = (value: 'comfortable' | 'compact') => {
    setDensity(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-dashboard-density', value);
    }
    setHasLocalDensity(true);
  };

  React.useEffect(() => {
    if (role !== 'super_admin') return;

    async function fetchDashboardPreferences() {
      try {
        const response = await fetch('/api/admin/settings?category=dashboard');
        if (!response.ok) return;
        const data = await response.json();
        const settings: Array<{ settingKey: string; parsedValue: unknown }> = data.settings || [];
        const byKey = new Map(settings.map((s) => [s.settingKey, s]));
        const densitySetting = byKey.get('dashboard.default_density');
        const workQueueSetting = byKey.get('dashboard.show_work_queue');

        if (
          densitySetting &&
          typeof densitySetting.parsedValue === 'string' &&
          (densitySetting.parsedValue === 'comfortable' || densitySetting.parsedValue === 'compact') &&
          !hasLocalDensity
        ) {
          setDensity(densitySetting.parsedValue);
        }

        if (workQueueSetting && typeof workQueueSetting.parsedValue === 'boolean') {
          setShowWorkQueue(workQueueSetting.parsedValue as boolean);
        } else {
          setShowWorkQueue(true);
        }
      } catch (error) {
        console.error('Error fetching dashboard preferences:', error);
      }
    }

    fetchDashboardPreferences();
  }, [role, hasLocalDensity]);

  return (
    <div className="space-y-6">
      <div className="surface-panel rounded-xl p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Operations console</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Credit Repair Command Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Monitor onboarding blockers, dispute deadlines, compliance exposure, and billing readiness from a single operational surface.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="mt-2 text-2xl font-semibold">{loading ? '...' : totalAttention}</p>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <Clock className="h-4 w-4 text-secondary" />
              <p className="mt-2 text-2xl font-semibold">{loading ? '...' : stats?.attentionNeeded?.responseDueSoon ?? 0}</p>
              <p className="text-xs text-muted-foreground">Responses due</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="mt-2 text-2xl font-semibold">{loading ? '...' : stats?.attentionNeeded?.pendingAgreements ?? 0}</p>
              <p className="text-xs text-muted-foreground">Agreement gates</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-5 md:flex-row md:items-center md:justify-between">
          <div className="hidden md:flex items-center gap-1 rounded-md bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">
            <span className="px-2">Density</span>
            <button
              type="button"
              onClick={() => handleSetDensity('comfortable')}
              className={
                `px-2 py-1 rounded transition-colors ` +
                (isCompact ? 'text-muted-foreground' : 'bg-background text-foreground shadow-sm')
              }
            >
              Comfort
            </button>
            <button
              type="button"
              onClick={() => handleSetDensity('compact')}
              className={
                `px-2 py-1 rounded transition-colors ` +
                (isCompact ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')
              }
            >
              Compact
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/admin/disputes/wizard">
                <Zap className="w-4 h-4 mr-2" />
                New Dispute
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/clients">
                <Users className="w-4 h-4 mr-2" />
                View Clients
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          loading={loading}
          totalAttention={totalAttention}
          formatTimeAgo={formatTimeAgo}
          metricCardPadding={metricCardPadding}
          metricGridGap={metricGridGap}
        />
      )}
      {activeTab === 'pipeline' && (
        <PipelineTab stats={stats} loading={loading} />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />
      )}
      {activeTab === 'operations' && (
        <OperationsTab
          stats={stats}
          showWorkQueue={showWorkQueue}
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

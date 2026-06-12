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

  const attentionStats = [
    { icon: AlertTriangle, accent: 'text-warning', value: totalAttention, label: 'Needs attention' },
    { icon: Clock, accent: 'text-secondary', value: stats?.attentionNeeded?.responseDueSoon ?? 0, label: 'Responses due' },
    { icon: ShieldCheck, accent: 'text-up', value: stats?.attentionNeeded?.pendingAgreements ?? 0, label: 'Agreement gates' },
  ];

  return (
    <div className="space-y-5">
      <div className="surface-panel rounded-xl p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-secondary">Operations Console</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
              Command Center
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden md:flex items-center gap-1 rounded-md border border-border bg-muted/60 p-0.5 text-[11px] text-muted-foreground">
              <span className="px-1.5">Density</span>
              <button
                type="button"
                onClick={() => handleSetDensity('comfortable')}
                className={
                  `rounded px-2 py-1 transition-colors ` +
                  (isCompact ? 'text-muted-foreground hover:text-foreground' : 'bg-card text-foreground shadow-sm')
                }
              >
                Comfort
              </button>
              <button
                type="button"
                onClick={() => handleSetDensity('compact')}
                className={
                  `rounded px-2 py-1 transition-colors ` +
                  (isCompact ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
              >
                Compact
              </button>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/clients">
                <Users className="mr-1.5 h-4 w-4" />
                Clients
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/disputes/wizard">
                <Zap className="mr-1.5 h-4 w-4" />
                New Dispute
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/70 pt-4 sm:max-w-xl">
          {attentionStats.map(({ icon: Icon, accent, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60">
                <Icon className={`h-4 w-4 ${accent}`} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xl font-semibold leading-none tabular-nums text-foreground">{loading ? '—' : value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
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

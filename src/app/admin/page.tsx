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
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatGrid, type StatItem } from '@/components/admin/StatGrid';

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

  const attentionStats: StatItem[] = [
    {
      icon: AlertTriangle,
      tone: totalAttention > 0 ? 'warning' : 'default',
      value: loading ? '—' : totalAttention,
      label: 'Needs attention',
    },
    {
      icon: Clock,
      tone: 'brass',
      value: loading ? '—' : stats?.attentionNeeded?.responseDueSoon ?? 0,
      label: 'Responses due',
    },
    {
      icon: ShieldCheck,
      tone: 'up',
      value: loading ? '—' : stats?.attentionNeeded?.pendingAgreements ?? 0,
      label: 'Agreement gates',
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations Console"
        title="Command Center"
        description="Live view of clients, disputes, and the work that needs attention today."
        actions={
          <>
            <div className="hidden md:flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5 text-[11px] text-muted-foreground">
              <span className="px-1.5">Density</span>
              <button
                type="button"
                onClick={() => handleSetDensity('comfortable')}
                className={
                  `rounded-md px-2 py-1 transition-colors duration-[160ms] ease-[var(--ease-out)] ` +
                  (isCompact ? 'text-muted-foreground hover:text-foreground' : 'bg-card text-foreground shadow-sm')
                }
              >
                Comfort
              </button>
              <button
                type="button"
                onClick={() => handleSetDensity('compact')}
                className={
                  `rounded-md px-2 py-1 transition-colors duration-[160ms] ease-[var(--ease-out)] ` +
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
          </>
        }
      />

      <StatGrid items={attentionStats} columns={3} className="sm:max-w-2xl" />

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

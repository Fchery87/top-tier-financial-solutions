'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Zap } from 'lucide-react';
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
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Credit Repair Command Center
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Monitor cases, track disputes, and manage your credit repair workflow in one command center.
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <div className="hidden md:flex items-center gap-1 rounded-full bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">
            <span className="px-2">Density</span>
            <button
              type="button"
              onClick={() => handleSetDensity('comfortable')}
              className={
                `px-2 py-0.5 rounded-full transition-colors ` +
                (isCompact ? 'text-muted-foreground' : 'bg-background text-foreground shadow-sm')
              }
            >
              Comfort
            </button>
            <button
              type="button"
              onClick={() => handleSetDensity('compact')}
              className={
                `px-2 py-0.5 rounded-full transition-colors ` +
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
        </motion.div>
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

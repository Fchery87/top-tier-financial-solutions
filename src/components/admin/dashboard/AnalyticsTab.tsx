'use client';

import * as React from 'react';
import { AdminAnalyticsPanel } from '@/components/admin/AdminAnalyticsPanel';
import { ScoreTrendChart } from '@/components/admin/ScoreTrendChart';
import { DisputeInsights } from '@/components/admin/DisputeInsights';
import { GoalTracker } from '@/components/admin/GoalTracker';
import { OnboardingProgress } from '@/components/admin/OnboardingProgress';

interface AnalyticsTabProps {
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

export function AnalyticsTab({ isSuperAdmin, isAdmin }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <AdminAnalyticsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreTrendChart />
        <DisputeInsights />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnboardingProgress />
        {(isSuperAdmin || isAdmin) && <GoalTracker />}
      </div>
    </div>
  );
}

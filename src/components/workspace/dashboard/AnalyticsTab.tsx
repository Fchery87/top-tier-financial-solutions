'use client';

import * as React from 'react';
import { AdminAnalyticsPanel } from '@/components/workspace/AdminAnalyticsPanel';
import { ScoreTrendChart } from '@/components/workspace/ScoreTrendChart';
import { DisputeInsights } from '@/components/workspace/DisputeInsights';
import { GoalTracker } from '@/components/workspace/GoalTracker';
import { OnboardingProgress } from '@/components/workspace/OnboardingProgress';

interface AnalyticsTabProps {
  isAdminTier: boolean;
}

export function AnalyticsTab({ isAdminTier }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <AdminAnalyticsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreTrendChart />
        <DisputeInsights />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OnboardingProgress />
        {isAdminTier && <GoalTracker />}
      </div>
    </div>
  );
}

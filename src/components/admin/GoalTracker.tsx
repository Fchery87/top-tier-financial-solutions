'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Target, Loader2, Trophy, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface Goal {
  type: string;
  label: string;
  current: number;
  target: number;
  icon: React.ElementType;
  color: string;
}

export function GoalTracker() {
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [month, setMonth] = React.useState('');

  React.useEffect(() => {
    async function fetchGoals() {
      try {
        // Get current month name
        const now = new Date();
        setMonth(now.toLocaleDateString('en-US', { month: 'long' }));

        // Fetch stats to calculate current progress
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const stats = await response.json();
          
          // Calculate current metrics from stats
          // These would ideally come from a goals API with user-defined targets
          setGoals([
            {
              type: 'deletions',
              label: 'Deletions',
              current: stats.itemsRemovedThisMonth || 0,
              target: 50, // Default target - could be user-configurable
              icon: Trophy,
              color: 'text-yellow-500',
            },
            {
              type: 'new_clients',
              label: 'New Clients',
              current: stats.newClientsThisMonth || stats.activeClients || 0,
              target: 10, // Default target
              icon: Users,
              color: 'text-blue-500',
            },
          ]);
        }
      } catch (error) {
        console.error('Error fetching goals:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchGoals();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Target className="w-5 h-5 text-secondary" />
            Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Target className="w-5 h-5 text-secondary" />
              {month} Goals
            </CardTitle>
            <CardDescription>
              Track your monthly targets
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {goals.map((goal, index) => {
            const Icon = goal.icon;
            const percentage = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
            const isComplete = goal.current >= goal.target;
            
            return (
              <motion.div
                key={goal.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${goal.color}`} />
                    <span className="text-sm font-medium">{goal.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isComplete ? 'text-green-500' : ''}`}>
                      {goal.current}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {goal.target}</span>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      isComplete 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                        : percentage >= 75 
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-gradient-to-r from-secondary to-secondary/70'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{Math.round(percentage)}% complete</span>
                  {isComplete ? (
                    <span className="text-green-500 font-medium">Goal achieved!</span>
                  ) : (
                    <span>{goal.target - goal.current} to go</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {goals.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No goals set</p>
            <p className="text-xs mt-1">Set monthly targets to track progress</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

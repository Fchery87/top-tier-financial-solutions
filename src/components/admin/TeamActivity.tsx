'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, Loader2, User, Briefcase, ListTodo, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  stats: {
    clientsAssigned: number;
    activeTasks: number;
    tasksDueToday: number;
  };
}

interface TeamData {
  members: TeamMember[];
  totalClients: number;
  totalTasks: number;
}

export function TeamActivity() {
  const [data, setData] = React.useState<TeamData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchTeamData() {
      try {
        // Fetch team stats - for now, use the stats endpoint
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const stats = await response.json();
          
          // For now, create a simple team view
          // This would be expanded with actual team member data
          setData({
            members: [
              {
                id: 'current-user',
                name: 'You (Admin)',
                email: '',
                role: 'super_admin',
                stats: {
                  clientsAssigned: stats.activeClients || 0,
                  activeTasks: stats.attentionNeeded?.overdueTasks || 0,
                  tasksDueToday: stats.attentionNeeded?.overdueTasks || 0,
                },
              },
            ],
            totalClients: stats.activeClients || 0,
            totalTasks: stats.attentionNeeded?.overdueTasks || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching team data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTeamData();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            Team Activity
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
              <Users className="w-5 h-5 text-secondary" />
              Team Activity
            </CardTitle>
            <CardDescription>
              {data?.members.length || 0} team member{(data?.members.length || 0) !== 1 ? 's' : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data?.members.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full bg-secondary/10">
                  <User className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {member.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded bg-background/50">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Briefcase className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold">{member.stats.clientsAssigned}</p>
                  <p className="text-[10px] text-muted-foreground">Clients</p>
                </div>
                <div className="text-center p-2 rounded bg-background/50">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <ListTodo className="w-3 h-3" />
                  </div>
                  <p className="text-sm font-semibold">{member.stats.activeTasks}</p>
                  <p className="text-[10px] text-muted-foreground">Tasks</p>
                </div>
                <div className="text-center p-2 rounded bg-background/50">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Clock className="w-3 h-3" />
                  </div>
                  <p className={`text-sm font-semibold ${member.stats.tasksDueToday > 0 ? 'text-orange-500' : ''}`}>
                    {member.stats.tasksDueToday}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Due Today</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {(!data?.members || data.members.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No team members</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mail, Users, UserMinus, TrendingUp, Loader2, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  source: string;
  status: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  unsubscribed: number;
}

export default function SubscribersAdminPage() {
  const [subscribers, setSubscribers] = React.useState<Subscriber[]>([]);
  const [stats, setStats] = React.useState<Stats>({ total: 0, active: 0, unsubscribed: 0 });
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'active' | 'unsubscribed'>('all');

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const response = await fetch(`/api/admin/subscribers?page=1&limit=100${statusParam}`);
      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.items);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSubscribers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleExport = () => {
    const csv = [
      ['Email', 'First Name', 'Last Name', 'Status', 'Source', 'Subscribed At'].join(','),
      ...subscribers.map((s) => [
        s.email,
        s.first_name || '',
        s.last_name || '',
        s.status,
        s.source,
        s.subscribed_at,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'email', header: 'Email', render: (sub: Subscriber) => (
      <div>
        <p className="font-medium">{sub.email}</p>
        {(sub.first_name || sub.last_name) && (
          <p className="text-sm text-muted-foreground">
            {[sub.first_name, sub.last_name].filter(Boolean).join(' ')}
          </p>
        )}
      </div>
    )},
    { key: 'source', header: 'Source', render: (sub: Subscriber) => (
      <span className="text-sm capitalize">{sub.source.replace('_', ' ')}</span>
    )},
    { key: 'status', header: 'Status', render: (sub: Subscriber) => (
      <StatusBadge status={sub.status as 'active' | 'unsubscribed'} />
    )},
    { key: 'subscribed_at', header: 'Subscribed', render: (sub: Subscriber) => (
      <span className="text-sm text-muted-foreground">
        {new Date(sub.subscribed_at).toLocaleDateString()}
      </span>
    )},
  ];

  const statCards = [
    { label: 'Total Subscribers', value: stats.total, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/20' },
    { label: 'Active', value: stats.active, icon: Mail, color: 'text-green-500', bgColor: 'bg-green-500/20' },
    { label: 'Unsubscribed', value: stats.unsubscribed, icon: UserMinus, color: 'text-orange-500', bgColor: 'bg-orange-500/20' },
    { label: 'Growth Rate', value: stats.active > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%', icon: TrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Email Subscribers</h1>
          <p className="text-muted-foreground">Manage your newsletter subscribers.</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'unsubscribed'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : (
            <DataTable columns={columns} data={subscribers} emptyMessage="No subscribers yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

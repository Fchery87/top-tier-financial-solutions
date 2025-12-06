'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle,
  FileSignature,
  Clock,
  DollarSign,
  MessageCircle,
  Loader2,
  ExternalLink,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface ComplianceStats {
  total_clients: number;
  clients_with_agreements: number;
  pending_agreements: number;
  agreements_in_cancellation: number;
  total_invoices: number;
  invoices_without_services: number;
  open_message_threads: number;
  avg_response_time_hours: number;
}

interface ComplianceAlert {
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export default function CompliancePage() {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<ComplianceStats | null>(null);
  const [alerts, setAlerts] = React.useState<ComplianceAlert[]>([]);

  const fetchComplianceData = async () => {
    setLoading(true);
    try {
      // Fetch data from multiple endpoints
      const [clientsRes, agreementsRes, invoicesRes, messagesRes] = await Promise.all([
        fetch('/api/admin/clients?limit=1'),
        fetch('/api/admin/agreements?type=agreements&limit=100'),
        fetch('/api/admin/billing?type=invoices&limit=100'),
        fetch('/api/admin/messages?limit=100'),
      ]);

      const clientsData = await clientsRes.json();
      const agreementsData = await agreementsRes.json();
      const invoicesData = await invoicesRes.json();
      const messagesData = await messagesRes.json();

      // Calculate stats
      const agreements = agreementsData.items || [];
      const invoices = invoicesData.items || [];
      const threads = messagesData.items || [];

      const signedAgreements = agreements.filter((a: { status: string }) => a.status === 'signed');
      const pendingAgreements = agreements.filter((a: { status: string }) => a.status === 'pending');
      const inCancellationWindow = signedAgreements.filter((a: { cancellation_deadline: string }) => {
        if (!a.cancellation_deadline) return false;
        return new Date(a.cancellation_deadline) > new Date();
      });

      const invoicesWithoutServices = invoices.filter((i: { services_rendered: string | null }) => !i.services_rendered);
      const openThreads = threads.filter((t: { status: string }) => t.status === 'open');

      const calculatedStats: ComplianceStats = {
        total_clients: clientsData.total || 0,
        clients_with_agreements: signedAgreements.length,
        pending_agreements: pendingAgreements.length,
        agreements_in_cancellation: inCancellationWindow.length,
        total_invoices: invoices.length,
        invoices_without_services: invoicesWithoutServices.length,
        open_message_threads: openThreads.length,
        avg_response_time_hours: 24, // Placeholder - would calculate from message timestamps
      };

      setStats(calculatedStats);

      // Generate alerts
      const generatedAlerts: ComplianceAlert[] = [];

      if (calculatedStats.pending_agreements > 0) {
        generatedAlerts.push({
          type: 'warning',
          title: `${calculatedStats.pending_agreements} Pending Agreement(s)`,
          description: 'Clients have been sent agreements but have not yet signed them.',
          action: { label: 'View Agreements', href: '/admin/agreements' },
        });
      }

      if (calculatedStats.agreements_in_cancellation > 0) {
        generatedAlerts.push({
          type: 'info',
          title: `${calculatedStats.agreements_in_cancellation} Agreement(s) in Cancellation Window`,
          description: 'These agreements are within the 3-day CROA cancellation period.',
          action: { label: 'View Details', href: '/admin/agreements' },
        });
      }

      if (invoicesWithoutServices.length > 0) {
        generatedAlerts.push({
          type: 'error',
          title: 'CROA Violation Risk',
          description: `${invoicesWithoutServices.length} invoice(s) do not have documented services. This violates CROA's no advance fees rule.`,
          action: { label: 'Review Invoices', href: '/admin/billing' },
        });
      }

      if (calculatedStats.total_clients > calculatedStats.clients_with_agreements) {
        const unsignedCount = calculatedStats.total_clients - calculatedStats.clients_with_agreements - calculatedStats.pending_agreements;
        if (unsignedCount > 0) {
          generatedAlerts.push({
            type: 'warning',
            title: `${unsignedCount} Client(s) Without Agreements`,
            description: 'Some active clients do not have signed service agreements.',
            action: { label: 'View Clients', href: '/admin/clients' },
          });
        }
      }

      if (openThreads.length > 5) {
        generatedAlerts.push({
          type: 'info',
          title: `${openThreads.length} Open Message Threads`,
          description: 'Consider responding to client messages to maintain good communication records.',
          action: { label: 'View Messages', href: '/admin/messages' },
        });
      }

      setAlerts(generatedAlerts);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchComplianceData();
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getAlertBg = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-500/5 border-red-500/20';
      case 'warning': return 'bg-amber-500/5 border-amber-500/20';
      case 'info': return 'bg-blue-500/5 border-blue-500/20';
      default: return 'bg-green-500/5 border-green-500/20';
    }
  };

  const complianceScore = React.useMemo(() => {
    if (!stats) return 0;
    let score = 100;
    
    // Deduct for violations
    if (stats.invoices_without_services > 0) score -= 30;
    if (stats.total_clients > 0 && stats.clients_with_agreements === 0) score -= 20;
    if (stats.pending_agreements > 3) score -= 10;
    
    return Math.max(0, score);
  }, [stats]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Compliance Dashboard
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            CROA/TSR compliance monitoring and alerts
          </motion.p>
        </div>
        <Button variant="outline" onClick={fetchComplianceData}>
          Refresh
        </Button>
      </div>

      {/* Compliance Score */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-secondary/10">
                  <ShieldCheck className="w-10 h-10 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Score</p>
                  <p className={`text-4xl font-bold ${getScoreColor(complianceScore)}`}>
                    {complianceScore}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                {complianceScore >= 90 ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Compliant
                  </span>
                ) : complianceScore >= 70 ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Needs Attention
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Action Required
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
        >
          <h2 className="text-lg font-semibold">Alerts & Actions</h2>
          {alerts.map((alert, index) => (
            <Card key={index} className={getAlertBg(alert.type)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                  {alert.action && (
                    <Link href={alert.action.href}>
                      <Button variant="outline" size="sm">
                        {alert.action.label}
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {alerts.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm">No compliance issues detected. Keep up the good work!</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileSignature className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground">Agreements</p>
            </div>
            <p className="text-2xl font-bold">{stats?.clients_with_agreements || 0}</p>
            <p className="text-xs text-muted-foreground">
              Signed | {stats?.pending_agreements || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground">Cancellation Window</p>
            </div>
            <p className="text-2xl font-bold">{stats?.agreements_in_cancellation || 0}</p>
            <p className="text-xs text-muted-foreground">
              Within 3-day CROA period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">Invoice Compliance</p>
            </div>
            <p className="text-2xl font-bold">
              {stats ? stats.total_invoices - stats.invoices_without_services : 0}
              <span className="text-sm text-muted-foreground font-normal">/{stats?.total_invoices || 0}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              With documented services
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MessageCircle className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-sm text-muted-foreground">Open Threads</p>
            </div>
            <p className="text-2xl font-bold">{stats?.open_message_threads || 0}</p>
            <p className="text-xs text-muted-foreground">
              Client messages
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* CROA/TSR Summary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">CROA Requirements</CardTitle>
            <CardDescription>Credit Repair Organizations Act compliance checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Written Contracts</p>
                <p className="text-xs text-muted-foreground">All agreements must be in writing with required disclosures</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">3-Day Right to Cancel</p>
                <p className="text-xs text-muted-foreground">Clients can cancel within 3 business days of signing</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">No Advance Fees</p>
                <p className="text-xs text-muted-foreground">Cannot charge until services have been rendered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Required Disclosures</p>
                <p className="text-xs text-muted-foreground">Consumer rights and no-guarantee statements</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">TSR Requirements</CardTitle>
            <CardDescription>Telemarketing Sales Rule compliance checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Fee Disclosure</p>
                <p className="text-xs text-muted-foreground">All fees must be clearly disclosed before purchase</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">No Misrepresentations</p>
                <p className="text-xs text-muted-foreground">Cannot make false claims about services or results</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Record Keeping</p>
                <p className="text-xs text-muted-foreground">Maintain records of all client communications</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Payment Timing</p>
                <p className="text-xs text-muted-foreground">Charge only after services are fully performed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

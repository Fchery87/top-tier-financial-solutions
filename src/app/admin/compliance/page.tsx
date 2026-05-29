'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ComplianceAlerts } from '@/components/admin/compliance/ComplianceAlerts';
import { ComplianceStatsGrid } from '@/components/admin/compliance/ComplianceStatsGrid';

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
        avg_response_time_hours: 24,
      };

      setStats(calculatedStats);

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

  const complianceScore = React.useMemo(() => {
    if (!stats) return 0;
    let score = 100;
    if (stats.invoices_without_services > 0) score -= 30;
    if (stats.total_clients > 0 && stats.clients_with_agreements === 0) score -= 20;
    if (stats.pending_agreements > 3) score -= 10;
    return Math.max(0, score);
  }, [stats]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-destructive';
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
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-sans font-bold text-foreground"
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-card border border-border">
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
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Compliant
                  </span>
                ) : complianceScore >= 70 ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Needs Attention
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Action Required
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <ComplianceAlerts alerts={alerts} />

      <ComplianceStatsGrid stats={stats} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-lg">CROA Requirements</CardTitle>
            <CardDescription>Credit Repair Organizations Act compliance checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Written Contracts</p>
                <p className="text-xs text-muted-foreground">All agreements must be in writing with required disclosures</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">3-Day Right to Cancel</p>
                <p className="text-xs text-muted-foreground">Clients can cancel within 3 business days of signing</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">No Advance Fees</p>
                <p className="text-xs text-muted-foreground">Cannot charge until services have been rendered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Required Disclosures</p>
                <p className="text-xs text-muted-foreground">Consumer rights and no-guarantee statements</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-lg">TSR Requirements</CardTitle>
            <CardDescription>Telemarketing Sales Rule compliance checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Fee Disclosure</p>
                <p className="text-xs text-muted-foreground">All fees must be clearly disclosed before purchase</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">No Misrepresentations</p>
                <p className="text-xs text-muted-foreground">Cannot make false claims about services or results</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Record Keeping</p>
                <p className="text-xs text-muted-foreground">Maintain records of all client communications</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
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

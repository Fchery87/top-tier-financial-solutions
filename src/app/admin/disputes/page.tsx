'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Scale, RefreshCw, Loader2, Send, Clock, RotateCcw,
  Wand2, CheckCircle2, FileText, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
import { useAdminRole } from '@/contexts/AdminContext';
import { DisputeCalendar } from '@/components/admin/DisputeCalendar';
import { DisputeStatsCards } from '@/components/admin/disputes/DisputeStatsCards';
import { DisputeFilters } from '@/components/admin/disputes/DisputeFilters';
import { DisputeDetailPanel } from '@/components/admin/disputes/DisputeDetailPanel';
import { toast } from 'sonner';

interface Dispute {
  id: string; client_id: string; client_name: string; negative_item_id: string | null;
  bureau: string; dispute_reason: string; dispute_type: string; status: string;
  round: number; tracking_number: string | null; sent_at: string | null;
  response_deadline: string | null; response_received_at: string | null;
  outcome: string | null; response_notes: string | null; response_document_url?: string | null;
  response_channel: string | null; score_impact: number | null;
  analysis_confidence?: number | null; auto_selected?: boolean;
  creditor_name: string | null; account_number: string | null; created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' }, { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready to Send' }, { value: 'sent', label: 'Sent' },
  { value: 'responded', label: 'Responded' }, { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];
const BUREAU_OPTIONS = [
  { value: 'all', label: 'All Bureaus' }, { value: 'transunion', label: 'TransUnion' },
  { value: 'experian', label: 'Experian' }, { value: 'equifax', label: 'Equifax' },
];

function readPref<T>(key: string, prefKey: string, field: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(prefKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (field in parsed) return parsed[field] as T;
    }
  } catch { /* ignore */ }
  return fallback;
}

export default function DisputesPage() {
  const searchParams = useSearchParams();
  const { userId, role } = useAdminRole();
  const preferencesKey = userId ? `admin-disputes-default-view:${userId}` : 'admin-disputes-default-view';
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState(() => {
    const fromUrl = searchParams.get('status');
    const valid = STATUS_OPTIONS.map((opt) => opt.value);
    if (fromUrl && valid.includes(fromUrl)) return fromUrl;
    return readPref(preferencesKey, preferencesKey, 'status', role === 'staff' ? 'sent' : 'all') as string;
  });
  const [selectedBureau, setSelectedBureau] = React.useState(() => {
    const fromUrl = searchParams.get('bureau');
    const valid = BUREAU_OPTIONS.map((opt) => opt.value);
    if (fromUrl && valid.includes(fromUrl)) return fromUrl;
    return readPref(preferencesKey, preferencesKey, 'bureau', 'all') as string;
  });
  const [showOverdueOnly, setShowOverdueOnly] = React.useState(() => {
    const fromUrl = searchParams.get('overdue');
    if (fromUrl === 'true') return true;
    if (fromUrl === 'false') return false;
    return readPref(preferencesKey, preferencesKey, 'overdue', false) as boolean;
  });
  const [showAwaitingOnly, setShowAwaitingOnly] = React.useState(() => {
    const fromUrl = searchParams.get('awaiting_response');
    if (fromUrl === 'true') return true;
    if (fromUrl === 'false') return false;
    return readPref(preferencesKey, preferencesKey, 'awaiting', false) as boolean;
  });
  const [roundFilter, setRoundFilter] = React.useState<number | null>(() => {
    const fromUrl = searchParams.get('round');
    if (!fromUrl) return null;
    const parsed = parseInt(fromUrl, 10);
    return Number.isNaN(parsed) ? null : parsed;
  });
  const [outcomeFilter, setOutcomeFilter] = React.useState<string | null>(() => {
    return searchParams.get('outcome') || null;
  });
  const [selectedDispute, setSelectedDispute] = React.useState<Dispute | null>(null);
  const [showResponseModal, setShowResponseModal] = React.useState(false);
  const [quickEscalatingId, setQuickEscalatingId] = React.useState<string | null>(null);

  const fetchDisputes = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedBureau !== 'all') params.append('bureau', selectedBureau);
      if (showOverdueOnly) params.append('overdue', 'true');
      if (showAwaitingOnly) params.append('awaiting_response', 'true');
      if (roundFilter !== null) params.append('round', String(roundFilter));
      if (outcomeFilter) params.append('outcome', outcomeFilter);
      const response = await fetch(`/api/admin/disputes?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setDisputes(data.disputes);
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedBureau, showOverdueOnly, showAwaitingOnly, roundFilter, outcomeFilter]);

  React.useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const handleLogResponse = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setShowResponseModal(true);
  };

  const handleQuickRedispute = async (dispute: Dispute) => {
    setQuickEscalatingId(dispute.id);
    try {
      const resp = await fetch(`/api/admin/disputes/${dispute.id}/quick-redispute`, { method: 'POST' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Failed to create quick re-dispute');
        return;
      }
      const data = await resp.json();
      if (data?.message) toast.success(data.message);
      fetchDisputes();
    } catch (error) {
      console.error('Error creating quick re-dispute:', error);
      toast.error('Failed to create quick re-dispute');
    } finally {
      setQuickEscalatingId(null);
    }
  };

  const getDeadlineStatus = (dispute: Dispute) => {
    if (!dispute.sent_at || dispute.response_received_at || dispute.outcome) return null;
    const deadline = dispute.response_deadline ? new Date(dispute.response_deadline) : null;
    if (!deadline) return null;
    const now = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { status: 'overdue', days: Math.abs(daysLeft), color: 'text-destructive bg-destructive/10' };
    if (daysLeft <= 7) return { status: 'urgent', days: daysLeft, color: 'text-warning bg-warning/10' };
    return { status: 'ok', days: daysLeft, color: 'text-success bg-success/10' };
  };

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case 'deleted': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'verified': return <RotateCcw className="w-4 h-4 text-warning" />;
      case 'updated': return <FileText className="w-4 h-4 text-secondary" />;
      case 'no_response': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'frivolous': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };

  const stats = React.useMemo(() => {
    const now = new Date();
    return {
      total: disputes.length,
      sent: disputes.filter(d => d.status === 'sent').length,
      resolved: disputes.filter(d => d.status === 'resolved').length,
      overdue: disputes.filter(d => {
        if (!d.response_deadline || d.response_received_at) return false;
        return new Date(d.response_deadline) < now;
      }).length,
      deleted: disputes.filter(d => d.outcome === 'deleted').length,
      verified: disputes.filter(d => d.outcome === 'verified').length,
    };
  }, [disputes]);

  const resetAuxFilters = () => { setRoundFilter(null); setOutcomeFilter(null); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-light tracking-tight text-foreground">Dispute Management</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-muted-foreground mt-1">Track dispute responses, log outcomes, and manage escalations</motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchDisputes} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button asChild><Link href="/admin/disputes/wizard"><Wand2 className="w-4 h-4 mr-2" />New Disputes</Link></Button>
        </motion.div>
      </div>

      <DisputeStatsCards stats={stats} showOverdueOnly={showOverdueOnly} onOverdueToggle={() => { setShowOverdueOnly(!showOverdueOnly); resetAuxFilters(); }} />
      <DisputeCalendar disputes={disputes} />

      <DisputeFilters
        selectedStatus={selectedStatus} onStatusChange={(v) => { setSelectedStatus(v); resetAuxFilters(); }}
        selectedBureau={selectedBureau} onBureauChange={(v) => { setSelectedBureau(v); resetAuxFilters(); }}
        showAwaitingOnly={showAwaitingOnly} onAwaitingToggle={() => { setShowAwaitingOnly(!showAwaitingOnly); resetAuxFilters(); }}
        showOverdueOnly={showOverdueOnly} onOverdueToggle={() => { setShowOverdueOnly(!showOverdueOnly); resetAuxFilters(); }}
        onClearFilters={() => { setSelectedStatus('all'); setSelectedBureau('all'); setShowAwaitingOnly(false); setShowOverdueOnly(false); resetAuxFilters(); }}
        onSaveAsDefault={() => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(preferencesKey, JSON.stringify({ status: selectedStatus, bureau: selectedBureau, overdue: showOverdueOnly, awaiting: showAwaitingOnly }));
            toast.success('Current filters saved as your default view.');
          }
        }}
        statusOptions={STATUS_OPTIONS} bureauOptions={BUREAU_OPTIONS}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Disputes ({disputes.length})</CardTitle>
            <CardDescription>Click on a dispute to log response or view details</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12">
                <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No disputes found matching your filters.</p>
                <Button className="mt-4" asChild><Link href="/admin/disputes/wizard"><Wand2 className="w-4 h-4 mr-2" />Create New Disputes</Link></Button>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map((dispute) => {
                  const deadlineStatus = getDeadlineStatus(dispute);
                  return (
                    <div key={dispute.id} className={`p-4 rounded-lg bg-muted/50 border transition-all hover:bg-muted cursor-pointer ${deadlineStatus?.status === 'overdue' ? 'border-destructive/50' : 'border-border/50'}`} onClick={() => handleLogResponse(dispute)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{dispute.client_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">R{dispute.round}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {dispute.bureau.charAt(0).toUpperCase() + dispute.bureau.slice(1)}
                            </span>
                            {dispute.outcome && (
                              <span className="flex items-center gap-1">{getOutcomeIcon(dispute.outcome)}<span className="text-xs capitalize">{dispute.outcome.replace('_', ' ')}</span></span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{dispute.creditor_name || dispute.dispute_reason}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {dispute.sent_at && <span className="flex items-center gap-1"><Send className="w-3 h-3" />Sent {new Date(dispute.sent_at).toLocaleDateString()}</span>}
                            {deadlineStatus && <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${deadlineStatus.color}`}><Clock className="w-3 h-3" />{deadlineStatus.status === 'overdue' ? `${deadlineStatus.days}d overdue` : `${deadlineStatus.days}d left`}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={dispute.status} variant={getStatusVariant(dispute.status)} />
                          {dispute.status === 'sent' && !dispute.outcome && <Button size="sm" onClick={(e) => { e.stopPropagation(); handleLogResponse(dispute); }}>Log Response</Button>}
                          {dispute.outcome === 'verified' && (
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleQuickRedispute(dispute); }} disabled={quickEscalatingId === dispute.id}>
                              {quickEscalatingId === dispute.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}Quick Re-Dispute
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <DisputeDetailPanel open={showResponseModal} dispute={selectedDispute} onClose={() => { setShowResponseModal(false); setSelectedDispute(null); }} onResponseLogged={fetchDisputes} />
    </div>
  );
}

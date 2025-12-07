'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Scale,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wand2,
  Send,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';

interface Dispute {
  id: string;
  client_id: string;
  client_name: string;
  negative_item_id: string | null;
  bureau: string;
  dispute_reason: string;
  dispute_type: string;
  status: string;
  round: number;
  tracking_number: string | null;
  sent_at: string | null;
  response_deadline: string | null;
  response_received_at: string | null;
  outcome: string | null;
  response_notes: string | null;
  creditor_name: string | null;
  account_number: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready to Send' },
  { value: 'sent', label: 'Sent' },
  { value: 'responded', label: 'Responded' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

const BUREAU_OPTIONS = [
  { value: 'all', label: 'All Bureaus' },
  { value: 'transunion', label: 'TransUnion' },
  { value: 'experian', label: 'Experian' },
  { value: 'equifax', label: 'Equifax' },
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'Select Outcome' },
  { value: 'deleted', label: 'Deleted ✓' },
  { value: 'verified', label: 'Verified (Escalate)' },
  { value: 'updated', label: 'Updated/Modified' },
  { value: 'no_response', label: 'No Response (30+ days)' },
];

export default function DisputesPage() {
  const searchParams = useSearchParams();
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState(() => {
    const fromUrl = searchParams.get('status');
    const valid = STATUS_OPTIONS.map((opt) => opt.value);
    return fromUrl && valid.includes(fromUrl) ? fromUrl : 'all';
  });
  const [selectedBureau, setSelectedBureau] = React.useState(() => {
    const fromUrl = searchParams.get('bureau');
    const valid = BUREAU_OPTIONS.map((opt) => opt.value);
    return fromUrl && valid.includes(fromUrl) ? fromUrl : 'all';
  });
  const [showOverdueOnly, setShowOverdueOnly] = React.useState(() => searchParams.get('overdue') === 'true');
  const [showAwaitingOnly, setShowAwaitingOnly] = React.useState(() => searchParams.get('awaiting_response') === 'true');
  const [roundFilter, setRoundFilter] = React.useState<number | null>(() => {
    const fromUrl = searchParams.get('round');
    if (!fromUrl) return null;
    const parsed = parseInt(fromUrl, 10);
    return Number.isNaN(parsed) ? null : parsed;
  });
  const [outcomeFilter, setOutcomeFilter] = React.useState<string | null>(() => {
    const fromUrl = searchParams.get('outcome');
    return fromUrl || null;
  });

  // Response modal state
  const [selectedDispute, setSelectedDispute] = React.useState<Dispute | null>(null);
  const [showResponseModal, setShowResponseModal] = React.useState(false);
  const [responseOutcome, setResponseOutcome] = React.useState('');
  const [responseNotes, setResponseNotes] = React.useState('');
  const [responseDate, setResponseDate] = React.useState('');
  const [createNextRound, setCreateNextRound] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

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

  React.useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleLogResponse = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setResponseOutcome('');
    setResponseNotes('');
    setResponseDate(new Date().toISOString().split('T')[0]);
    setCreateNextRound(true);
    setShowResponseModal(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedDispute || !responseOutcome) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/disputes/${selectedDispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: responseOutcome === 'deleted' ? 'resolved' : 'responded',
          outcome: responseOutcome,
          responseNotes,
          responseReceivedAt: responseDate,
          createNextRound: responseOutcome === 'verified' && createNextRound,
          escalationReason: responseOutcome === 'verified' ? responseNotes : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowResponseModal(false);
        setSelectedDispute(null);
        fetchDisputes();

        if (data.next_round_dispute) {
          alert(`Response logged! Round ${data.next_round_dispute.round} dispute created automatically.`);
        }
      }
    } catch (error) {
      console.error('Error logging response:', error);
      alert('Failed to log response');
    } finally {
      setSubmitting(false);
    }
  };

  const getDeadlineStatus = (dispute: Dispute) => {
    if (!dispute.sent_at || dispute.response_received_at || dispute.outcome) {
      return null;
    }

    const deadline = dispute.response_deadline ? new Date(dispute.response_deadline) : null;
    if (!deadline) return null;

    const now = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { status: 'overdue', days: Math.abs(daysLeft), color: 'text-red-500 bg-red-500/10' };
    } else if (daysLeft <= 7) {
      return { status: 'urgent', days: daysLeft, color: 'text-yellow-500 bg-yellow-500/10' };
    } else {
      return { status: 'ok', days: daysLeft, color: 'text-green-500 bg-green-500/10' };
    }
  };

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case 'deleted':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'verified':
        return <RotateCcw className="w-4 h-4 text-yellow-500" />;
      case 'updated':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'no_response':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  // Stats
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
            Dispute Management
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Track dispute responses, log outcomes, and manage escalations
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <Button variant="outline" onClick={fetchDisputes} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/admin/disputes/wizard">
              <Wand2 className="w-4 h-4 mr-2" />
              New Disputes
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <Scale className="w-5 h-5 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <Send className="w-5 h-5 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-card/80 backdrop-blur-sm border-border/50 cursor-pointer transition-all ${showOverdueOnly ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => {
            setShowOverdueOnly(!showOverdueOnly);
            setRoundFilter(null);
            setOutcomeFilter(null);
          }}
        >
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-500">{stats.deleted}</p>
            <p className="text-xs text-muted-foreground">Deleted</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <RotateCcw className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold text-yellow-500">{stats.verified}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">{stats.resolved}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setRoundFilter(null);
              setOutcomeFilter(null);
            }}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <select
          value={selectedBureau}
          onChange={(e) => {
            setSelectedBureau(e.target.value);
            setRoundFilter(null);
            setOutcomeFilter(null);
          }}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          {BUREAU_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Button
          variant={showAwaitingOnly ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setShowAwaitingOnly(!showAwaitingOnly);
            setRoundFilter(null);
            setOutcomeFilter(null);
          }}
        >
          <Clock className="w-4 h-4 mr-1" />
          Awaiting Response
        </Button>
        <Button
          variant={showOverdueOnly ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => {
            setShowOverdueOnly(!showOverdueOnly);
            setRoundFilter(null);
            setOutcomeFilter(null);
          }}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Overdue Only
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedStatus('all');
            setSelectedBureau('all');
            setShowAwaitingOnly(false);
            setShowOverdueOnly(false);
            setRoundFilter(null);
            setOutcomeFilter(null);
          }}
        >
          Clear Filters
        </Button>
      </motion.div>

      {/* Disputes List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Disputes ({disputes.length})</CardTitle>
            <CardDescription>Click on a dispute to log response or view details</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12">
                <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No disputes found matching your filters.</p>
                <Button className="mt-4" asChild>
                  <Link href="/admin/disputes/wizard">
                    <Wand2 className="w-4 h-4 mr-2" />
                    Create New Disputes
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map((dispute) => {
                  const deadlineStatus = getDeadlineStatus(dispute);

                  return (
                    <div
                      key={dispute.id}
                      className={`p-4 rounded-lg bg-muted/50 border transition-all hover:bg-muted cursor-pointer ${
                        deadlineStatus?.status === 'overdue' ? 'border-red-500/50' : 'border-border/50'
                      }`}
                      onClick={() => handleLogResponse(dispute)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{dispute.client_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                              R{dispute.round}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              dispute.bureau === 'transunion' ? 'bg-blue-500/10 text-blue-500' :
                              dispute.bureau === 'experian' ? 'bg-purple-500/10 text-purple-500' :
                              'bg-red-500/10 text-red-500'
                            }`}>
                              {dispute.bureau.charAt(0).toUpperCase() + dispute.bureau.slice(1)}
                            </span>
                            {dispute.outcome && (
                              <span className="flex items-center gap-1">
                                {getOutcomeIcon(dispute.outcome)}
                                <span className="text-xs capitalize">{dispute.outcome.replace('_', ' ')}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {dispute.creditor_name || dispute.dispute_reason}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {dispute.sent_at && (
                              <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                Sent {new Date(dispute.sent_at).toLocaleDateString()}
                              </span>
                            )}
                            {deadlineStatus && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${deadlineStatus.color}`}>
                                <Clock className="w-3 h-3" />
                                {deadlineStatus.status === 'overdue'
                                  ? `${deadlineStatus.days}d overdue`
                                  : `${deadlineStatus.days}d left`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={dispute.status} variant={getStatusVariant(dispute.status)} />
                          {dispute.status === 'sent' && !dispute.outcome && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLogResponse(dispute);
                              }}
                            >
                              Log Response
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

      {/* Response Modal */}
      <AnimatePresence>
        {showResponseModal && selectedDispute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowResponseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card className="bg-card border-border shadow-2xl">
                <CardHeader>
                  <CardTitle>Log Bureau Response</CardTitle>
                  <CardDescription>
                    {selectedDispute.client_name} - {selectedDispute.bureau.toUpperCase()} - Round {selectedDispute.round}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedDispute.creditor_name && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium">{selectedDispute.creditor_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDispute.dispute_reason}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Response Outcome *</label>
                    <select
                      value={responseOutcome}
                      onChange={(e) => setResponseOutcome(e.target.value)}
                      className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm"
                    >
                      {OUTCOME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Response Date</label>
                    <Input
                      type="date"
                      value={responseDate}
                      onChange={(e) => setResponseDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder="Any details about the response..."
                      className="w-full min-h-[80px] mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                    />
                  </div>

                  {responseOutcome === 'verified' && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createNextRound}
                          onChange={(e) => setCreateNextRound(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">
                          Auto-create Round {(selectedDispute.round || 1) + 1} escalation dispute
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Will generate a Method of Verification letter for the next round.
                      </p>
                    </div>
                  )}

                  {responseOutcome === 'deleted' && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Item will be marked as successfully removed!
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowResponseModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSubmitResponse}
                      disabled={!responseOutcome || submitting}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Save Response
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

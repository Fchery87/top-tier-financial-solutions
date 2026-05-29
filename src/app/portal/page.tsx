'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Loader2, FileText, Sparkles, Shield, Calendar, FileSignature,
} from 'lucide-react';
import { toast } from 'sonner';
import PortalHeader from '@/components/portal/PortalHeader';
import PortalNav from '@/components/portal/PortalNav';
import PortalCaseStatus from '@/components/portal/PortalCaseStatus';
import PortalDisputes from '@/components/portal/PortalDisputes';
import PortalScoreHistory from '@/components/portal/PortalScoreHistory';
import PortalTasks from '@/components/portal/PortalTasks';
import PortalDocuments from '@/components/portal/PortalDocuments';
import PortalAuditReportCard from '@/components/portal/PortalAuditReportCard';
import PortalLetterConsent from '@/components/portal/PortalLetterConsent';
import PortalFeedbackCard from '@/components/portal/PortalFeedbackCard';
import PortalUploadModal from '@/components/portal/PortalUploadModal';
import PortalLetterPreview from '@/components/portal/PortalLetterPreview';
import type {
  ClientCase, Document, AuditReportStatus, PortalDispute, DisputeStats,
  ScoreHistoryEntry, ScoreSummary, PortalTask, LetterForApproval, PortalFeedbackEntry,
} from '@/components/portal/types';

export default function PortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [cases, setCases] = React.useState<ClientCase[]>([]);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [auditReport, setAuditReport] = React.useState<AuditReportStatus | null>(null);
  const [disputes, setDisputes] = React.useState<PortalDispute[]>([]);
  const [disputeStats, setDisputeStats] = React.useState<DisputeStats | null>(null);
  const [scoreHistory, setScoreHistory] = React.useState<ScoreHistoryEntry[]>([]);
  const [scoreSummary, setScoreSummary] = React.useState<ScoreSummary | null>(null);
  const [tasks, setTasks] = React.useState<PortalTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [letters, setLetters] = React.useState<LetterForApproval[]>([]);
  const [signature, setSignature] = React.useState('');
  const [approvingLetters, setApprovingLetters] = React.useState(false);
  const [selectedLetter, setSelectedLetter] = React.useState<LetterForApproval | null>(null);
  const [feedbackEntry, setFeedbackEntry] = React.useState<PortalFeedbackEntry | null>(null);
  const [feedbackRating, setFeedbackRating] = React.useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = React.useState('');
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);
  const [showUploadModal, setShowUploadModal] = React.useState(false);

  const pendingLetters = React.useMemo(
    () => letters.filter((l) => l.status === 'pending'), [letters],
  );

  React.useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, docsRes, auditRes, disputesRes, scoreRes, lettersRes, feedbackRes] = await Promise.all([
        fetch('/api/portal/cases'), fetch('/api/portal/documents'),
        fetch('/api/portal/audit-report'), fetch('/api/portal/disputes'),
        fetch('/api/portal/score-history'), fetch('/api/portal/letters'),
        fetch('/api/portal/feedback?context=portal_overall'),
      ]);
      if (casesRes.ok) { const d = await casesRes.json(); setCases(d.cases || []); }
      if (docsRes.ok) { const d = await docsRes.json(); setDocuments(d.documents || []); }
      if (auditRes.ok) { const d = await auditRes.json(); setAuditReport(d); }
      if (disputesRes.ok) { const d = await disputesRes.json(); setDisputes(d.disputes || []); setDisputeStats(d.stats || null); }
      if (scoreRes.ok) { const d = await scoreRes.json(); setScoreHistory(d.history || []); setScoreSummary(d.summary || null); }
      if (lettersRes.ok) { const d = await lettersRes.json(); setLetters(d.letters || []); }
      if (feedbackRes.ok) {
        const d = await feedbackRes.json();
        const entry = (d.feedback && d.feedback[0]) || null;
        setFeedbackEntry(entry); setFeedbackRating(entry?.rating ?? null);
      }
      const tasksRes = await fetch('/api/portal/tasks');
      if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(d.tasks || []); }
    } catch (e) { console.error('Error fetching portal data:', e); } finally { setLoading(false); }
  };

  const handleApproveLetters = async () => {
    if (pendingLetters.length === 0) return;
    if (!signature.trim()) { toast.error('Please type your full name as your electronic signature.'); return; }
    setApprovingLetters(true);
    try {
      for (const letter of pendingLetters) {
        if (!letter.approval_id) continue;
        const response = await fetch('/api/portal/letters/approve', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approval_id: letter.approval_id, signature_text: signature.trim() }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error('Error approving letter:', data.error || response.statusText);
          toast.error('We were unable to record your approval for all letters. Please try again or contact support.');
          return;
        }
      }
      const refreshed = await fetch('/api/portal/letters');
      if (refreshed.ok) { const d = await refreshed.json(); setLetters(d.letters || []); }
    } catch (e) { console.error('Error approving letters:', e); toast.error('Approval failed. Please try again.'); }
    finally { setApprovingLetters(false); }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackRating) { toast.error('Please select a rating from 1 to 5.'); return; }
    setSubmittingFeedback(true);
    try {
      const response = await fetch('/api/portal/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'portal_overall', rating: feedbackRating, comment: feedbackComment.trim() || null }),
      });
      if (!response.ok) { const d = await response.json().catch(() => ({})); toast.error(d.error || 'Failed to submit feedback'); return; }
      setFeedbackEntry(await response.json());
    } catch (e) { console.error('Error submitting feedback:', e); toast.error('Failed to submit feedback'); }
    finally { setSubmittingFeedback(false); }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Client Portal</CardTitle>
            <CardDescription>Please sign in to access your client portal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"><Link href="/sign-in">Sign In</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link href="/sign-up">Create Account</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCase = cases.find((c) => c.status === 'active') || cases[0];

  return (
    <div className="flex flex-col min-h-screen">
      <PortalHeader userName={user.name?.split(' ')[0] || 'Client'} />
      <PortalNav />

      <section className="bg-background/80 py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
          ) : cases.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-lg bg-accent flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-secondary" />
                </div>
                <h2 className="text-3xl font-display font-light mb-4 text-foreground">No Active Cases</h2>
                <p className="text-muted-foreground mb-8">
                  You don&apos;t have any active credit repair cases yet. Book a free consultation to get started on your credit repair journey.
                </p>
                <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <Link href="/contact"><Sparkles className="w-4 h-4 mr-2" />Book Free Consultation</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
              <PortalCaseStatus activeCase={activeCase} />

              <div className="space-y-6 lg:sticky lg:top-24">
                <PortalTasks tasks={tasks} />
                <PortalDocuments documents={documents} onUpload={() => setShowUploadModal(true)} />
                {auditReport && <PortalAuditReportCard auditReport={auditReport} />}
                <PortalLetterConsent
                  letters={letters} pendingLetters={pendingLetters}
                  signature={signature} approvingLetters={approvingLetters}
                  onSignatureChange={setSignature} onApprove={handleApproveLetters}
                  onLetterClick={setSelectedLetter}
                />
                <PortalFeedbackCard
                  feedbackEntry={feedbackEntry} feedbackRating={feedbackRating}
                  feedbackComment={feedbackComment} submittingFeedback={submittingFeedback}
                  onRatingChange={setFeedbackRating} onCommentChange={setFeedbackComment}
                  onSubmit={handleSubmitFeedback}
                />
                <Card>
                  <CardHeader><CardTitle className="text-xl">Quick Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/portal/agreement"><FileSignature className="w-4 h-4 mr-2" />Service Agreement</Link>
                    </Button>
                    {auditReport?.has_report && (
                      <Button asChild variant="outline" className="w-full justify-start">
                        <Link href="/portal/audit-report"><FileText className="w-4 h-4 mr-2" />View Audit Report</Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/contact"><Calendar className="w-4 h-4 mr-2" />Schedule Consultation</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/settings"><Shield className="w-4 h-4 mr-2" />Account Settings</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-6 lg:col-start-1 lg:row-start-2">
                <PortalDisputes disputes={disputes} disputeStats={disputeStats} />
                <PortalScoreHistory scoreHistory={scoreHistory} scoreSummary={scoreSummary} />
              </div>
            </div>
          )}
        </div>
      </section>

      <PortalUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} onUploadComplete={fetchData} />
      <PortalLetterPreview letter={selectedLetter} onClose={() => setSelectedLetter(null)} />
    </div>
  );
}

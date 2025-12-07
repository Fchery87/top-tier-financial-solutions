'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  Loader2, FileText, TrendingUp, Clock, CheckCircle, 
  AlertCircle, Upload, ChevronRight, Sparkles, Shield,
  FileUp, Calendar, Target, Zap, FileSignature, Scale,
  Trophy, TrendingDown, BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';

interface AuditReportStatus {
  has_report: boolean;
  client_name?: string;
  report_date?: string;
  scores?: {
    transunion: number | null;
    experian: number | null;
    equifax: number | null;
  } | null;
}

interface CaseUpdate {
  id: string;
  title: string;
  description: string | null;
  update_type: string;
  created_at: string;
}

interface ClientCase {
  id: string;
  case_number: string;
  status: string;
  current_phase: string;
  credit_score_start: number | null;
  credit_score_current: number | null;
  negative_items_start: number | null;
  negative_items_removed: number | null;
  started_at: string;
  completed_at: string | null;
  updates: CaseUpdate[];
}

interface Document {
  id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

interface PortalDispute {
  id: string;
  bureau: string;
  status: string;
  round: number;
  creditor_name: string;
  item_type: string | null;
  sent_at: string | null;
  response_deadline: string | null;
  outcome: string | null;
  outcome_date: string | null;
  created_at: string | null;
}

interface DisputeStats {
  total: number;
  in_progress: number;
  deleted: number;
  awaiting: number;
}

interface ScoreHistoryEntry {
  id: string;
  score_transunion: number | null;
  score_experian: number | null;
  score_equifax: number | null;
  average_score: number | null;
  recorded_at: string;
}

interface ScoreSummary {
  current_average: number | null;
  starting_average: number | null;
  total_change: number;
  current_scores: {
    transunion: number | null;
    experian: number | null;
    equifax: number | null;
  };
  records_count: number;
}

interface PortalTask {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  is_blocking: boolean;
  created_at: string | null;
}

interface LetterForApproval {
  approval_id: string | null;
  dispute_id: string;
  bureau: string;
  round: number | null;
  status: 'pending' | 'approved' | 'rejected';
  creditor_name: string;
  letter_content: string;
  created_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
}

interface PortalFeedbackEntry {
  id: string;
  context: string;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
}

const phaseLabels: Record<string, string> = {
  initial_review: 'Initial Review',
  dispute_preparation: 'Dispute Preparation',
  disputes_sent: 'Disputes Sent',
  awaiting_response: 'Awaiting Response',
  follow_up: 'Follow Up',
  completed: 'Completed',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

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

  // Document upload state
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadFileType, setUploadFileType] = React.useState('credit_report');
  const [uploadNotes, setUploadNotes] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const sortedTasks = React.useMemo(() => {
    const pending = tasks.filter((t) => t.status !== 'done');
    if (pending.length === 0) return [] as PortalTask[];

    const priorityWeight: Record<PortalTask['priority'], number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...pending].sort((a, b) => {
      if (a.is_blocking !== b.is_blocking) return a.is_blocking ? -1 : 1;
      const pa = priorityWeight[a.priority];
      const pb = priorityWeight[b.priority];
      if (pa !== pb) return pa - pb;

      const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;

      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ca - cb;
    });
  }, [tasks]);

  const nextTask = sortedTasks[0] ?? null;
  const remainingTasks = nextTask
    ? sortedTasks.filter((t) => t.id !== nextTask.id)
    : sortedTasks;

  const pendingLetters = React.useMemo(
    () => letters.filter((l) => l.status === 'pending'),
    [letters],
  );

  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, docsRes, auditRes, disputesRes, scoreRes, lettersRes, feedbackRes] = await Promise.all([
        fetch('/api/portal/cases'),
        fetch('/api/portal/documents'),
        fetch('/api/portal/audit-report'),
        fetch('/api/portal/disputes'),
        fetch('/api/portal/score-history'),
        fetch('/api/portal/letters'),
        fetch('/api/portal/feedback?context=portal_overall'),
      ]);

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData.cases || []);
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditReport(auditData);
      }

      if (disputesRes.ok) {
        const disputesData = await disputesRes.json();
        setDisputes(disputesData.disputes || []);
        setDisputeStats(disputesData.stats || null);
      }

      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScoreHistory(scoreData.history || []);
        setScoreSummary(scoreData.summary || null);
      }

      if (lettersRes.ok) {
        const lettersData = await lettersRes.json();
        setLetters(lettersData.letters || []);
      }

      if (feedbackRes.ok) {
        const fbData = await feedbackRes.json();
        const entry = (fbData.feedback && fbData.feedback[0]) || null;
        if (entry) {
          setFeedbackEntry(entry);
          setFeedbackRating(entry.rating);
        } else {
          setFeedbackEntry(null);
          setFeedbackRating(null);
        }
      }

      const tasksRes = await fetch('/api/portal/tasks');
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'text/html',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a PDF, HTML, TXT, image, or Word document.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('file_type', uploadFileType);
      formData.append('notes', uploadNotes);

      const response = await fetch('/api/portal/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadFileType('credit_report');
        setUploadNotes('');
        fetchData(); // Refresh documents list
      } else {
        const error = await response.json();
        alert(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleApproveLetters = async () => {
    if (pendingLetters.length === 0) return;
    if (!signature.trim()) {
      alert('Please type your full name as your electronic signature.');
      return;
    }

    setApprovingLetters(true);
    try {
      for (const letter of pendingLetters) {
        if (!letter.approval_id) continue;

        const response = await fetch('/api/portal/letters/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approval_id: letter.approval_id,
            signature_text: signature.trim(),
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error('Error approving letter:', data.error || response.statusText);
          alert('We were unable to record your approval for all letters. Please try again or contact support.');
          return;
        }
      }

      const refreshed = await fetch('/api/portal/letters');
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        setLetters(refreshedData.letters || []);
      }
    } catch (error) {
      console.error('Error approving letters:', error);
      alert('We were unable to record your approval. Please try again or contact support.');
    } finally {
      setApprovingLetters(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackRating) {
      alert('Please select a rating from 1 to 5.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const response = await fetch('/api/portal/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'portal_overall',
          rating: feedbackRating,
          comment: feedbackComment.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Failed to submit feedback');
        return;
      }

      const created = await response.json();
      setFeedbackEntry(created);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-2xl">Client Portal</CardTitle>
            <CardDescription>Please sign in to access your client portal.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCase = cases.find((c) => c.status === 'active') || cases[0];
  const scoreImprovement = activeCase?.credit_score_current && activeCase?.credit_score_start
    ? activeCase.credit_score_current - activeCase.credit_score_start
    : 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden">
        <GradientOrbs className="opacity-50" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background z-[1]" />

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="relative inline-flex">
                <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md" />
                <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-secondary/30 text-foreground text-sm font-medium">
                  <Shield className="w-4 h-4 text-secondary" />
                  Client Portal
                </div>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-4 text-foreground">
              Welcome back, <span className="text-gradient-gold">{user.name?.split(' ')[0] || 'Client'}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Track your credit repair progress, view updates, and manage your documents all in one place.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 md:py-12 bg-background relative">
        <div className="container mx-auto px-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : cases.length === 0 ? (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-secondary" />
                </div>
                <h2 className="text-2xl font-serif font-bold mb-4 text-foreground">No Active Cases</h2>
                <p className="text-muted-foreground mb-8">
                  You don&apos;t have any active credit repair cases yet. Book a free consultation to get started on your credit repair journey.
                </p>
                <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <Link href="/contact">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Book Free Consultation
                  </Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Stats Cards */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-secondary/20">
                          <Target className="w-6 h-6 text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Score</p>
                          <p className="text-2xl font-bold text-foreground">
                            {activeCase?.credit_score_current || '---'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-green-500/20">
                          <TrendingUp className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Score Improvement</p>
                          <p className="text-2xl font-bold text-green-500">
                            +{scoreImprovement} pts
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                          <Zap className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Items Removed</p>
                          <p className="text-2xl font-bold text-foreground">
                            {activeCase?.negative_items_removed || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-purple-500/20">
                          <Calendar className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Case Status</p>
                          <p className="text-lg font-bold text-foreground capitalize">
                            {activeCase?.status || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Case Details & Timeline */}
              <div className="lg:col-span-2 space-y-6">
                {/* Current Phase */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl flex items-center gap-2">
                      <Clock className="w-5 h-5 text-secondary" />
                      Current Phase
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                      <span className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColors[activeCase?.status || 'pending']}`}>
                        {activeCase?.status?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-foreground font-medium">
                        {phaseLabels[activeCase?.current_phase || 'initial_review']}
                      </span>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-4">
                      {Object.entries(phaseLabels).map(([key, label], idx) => {
                        const phases = Object.keys(phaseLabels);
                        const currentIdx = phases.indexOf(activeCase?.current_phase || 'initial_review');
                        const isComplete = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        
                        return (
                          <div key={key} className="flex items-center">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
                              isComplete ? 'bg-green-500/20 text-green-400' :
                              isCurrent ? 'bg-secondary/20 text-secondary' :
                              'bg-muted/30 text-muted-foreground'
                            }`}>
                              {isComplete ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : isCurrent ? (
                                <Clock className="w-4 h-4" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-current" />
                              )}
                              <span className="text-xs font-medium">{label}</span>
                            </div>
                            {idx < Object.keys(phaseLabels).length - 1 && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Updates */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-secondary" />
                      Recent Updates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeCase?.updates && activeCase.updates.length > 0 ? (
                      <div className="space-y-4">
                        {activeCase.updates.map((update) => (
                          <div key={update.id} className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-secondary mt-2" />
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{update.title}</p>
                              {update.description && (
                                <p className="text-sm text-muted-foreground mt-1">{update.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(update.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No updates yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Disputes Progress */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl flex items-center gap-2">
                      <Scale className="w-5 h-5 text-secondary" />
                      Dispute Progress
                    </CardTitle>
                    <CardDescription>
                      Track the status of your credit disputes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {disputeStats && disputeStats.total > 0 ? (
                      <div className="space-y-4">
                        {/* Dispute Stats */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="p-3 rounded-lg bg-muted/30 text-center">
                            <p className="text-2xl font-bold text-foreground">{disputeStats.total}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                          <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                            <p className="text-2xl font-bold text-blue-500">{disputeStats.in_progress}</p>
                            <p className="text-xs text-muted-foreground">In Progress</p>
                          </div>
                          <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
                            <p className="text-2xl font-bold text-yellow-500">{disputeStats.awaiting}</p>
                            <p className="text-xs text-muted-foreground">Awaiting</p>
                          </div>
                          <div className="p-3 rounded-lg bg-green-500/10 text-center">
                            <p className="text-2xl font-bold text-green-500">{disputeStats.deleted}</p>
                            <p className="text-xs text-muted-foreground">Deleted</p>
                          </div>
                        </div>

                        {/* Dispute List */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {disputes.map((dispute) => (
                            <div 
                              key={dispute.id} 
                              className={`p-3 rounded-lg border transition-colors ${
                                dispute.outcome === 'deleted' 
                                  ? 'bg-green-500/10 border-green-500/30' 
                                  : dispute.status === 'sent' 
                                    ? 'bg-blue-500/10 border-blue-500/30'
                                    : 'bg-muted/30 border-border/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {dispute.outcome === 'deleted' ? (
                                      <Trophy className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    ) : dispute.status === 'sent' ? (
                                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    ) : (
                                      <Scale className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <p className="text-sm font-medium truncate">{dispute.creditor_name}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {dispute.bureau.toUpperCase()} • Round {dispute.round}
                                    {dispute.item_type && ` • ${dispute.item_type.replace(/_/g, ' ')}`}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {dispute.outcome === 'deleted' ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                                      Removed
                                    </span>
                                  ) : dispute.outcome === 'verified' ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                                      Escalating
                                    </span>
                                  ) : dispute.status === 'sent' ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-500">
                                      In Review
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                                      {dispute.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {dispute.sent_at && !dispute.outcome && dispute.response_deadline && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Response expected by {new Date(dispute.response_deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No disputes in progress yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          We&apos;ll start disputing negative items once your credit report is analyzed.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Score History Chart */}
                {scoreHistory.length > 1 && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-secondary" />
                        Score Progress
                      </CardTitle>
                      <CardDescription>
                        Your credit score journey over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {scoreSummary && (
                        <div className="mb-6 p-4 rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Total Change</p>
                              <div className="flex items-center gap-2">
                                {scoreSummary.total_change >= 0 ? (
                                  <TrendingUp className="w-5 h-5 text-green-500" />
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-red-500" />
                                )}
                                <p className={`text-2xl font-bold ${
                                  scoreSummary.total_change >= 0 ? 'text-green-500' : 'text-red-500'
                                }`}>
                                  {scoreSummary.total_change >= 0 ? '+' : ''}{scoreSummary.total_change} pts
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Current Average</p>
                              <p className="text-2xl font-bold text-foreground">
                                {scoreSummary.current_average || '---'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Simple Bar Chart */}
                      <div className="h-32 flex items-end gap-1">
                        {scoreHistory.slice(0, 12).reverse().map((entry, index) => {
                          const score = entry.average_score || 0;
                          const maxScore = 850;
                          const heightPercent = (score / maxScore) * 100;
                          
                          return (
                            <div key={entry.id} className="flex-1 flex flex-col items-center gap-1">
                              <div 
                                className="w-full bg-secondary rounded-t transition-all hover:bg-secondary/80"
                                style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '4px' }}
                                title={`${score} - ${new Date(entry.recorded_at).toLocaleDateString()}`}
                              />
                              {index % 3 === 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Documents Sidebar */}
              <div className="space-y-6">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl flex items-center gap-2">
                      <Target className="w-5 h-5 text-secondary" />
                      Your Next Step
                    </CardTitle>
                    <CardDescription>
                      {nextTask
                        ? 'Complete this to keep your case moving smoothly.'
                        : 'You are all caught up for now.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {nextTask ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                          <p className="text-sm font-medium text-foreground">{nextTask.title}</p>
                          {nextTask.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {nextTask.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                            {nextTask.is_blocking && (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                                Required
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-muted/70 capitalize">
                              {nextTask.priority} priority
                            </span>
                            {nextTask.due_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due {new Date(nextTask.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {tasks.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {tasks.length - 1} other task{tasks.length - 1 === 1 ? '' : 's'} open.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>No open action items from us right now.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {sortedTasks.length > 0 && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-secondary" />
                        Your Tasks
                      </CardTitle>
                      <CardDescription>
                        A summary of open items we may ask you to complete.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {nextTask && (
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                          <p className="text-xs font-semibold text-secondary mb-1">
                            Next step
                          </p>
                          <p className="text-sm font-medium text-foreground">{nextTask.title}</p>
                          {nextTask.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {nextTask.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
                            {nextTask.is_blocking && (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                                Required
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-muted/70 capitalize">
                              {nextTask.priority} priority
                            </span>
                            {nextTask.due_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due {new Date(nextTask.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {remainingTasks.length > 0 && (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto">
                          {remainingTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2 rounded-lg bg-muted/30 border border-border/40"
                            >
                              <p className="text-xs font-medium text-foreground truncate">
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                {task.is_blocking && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">
                                    Required
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded-full bg-muted/70 capitalize">
                                  {task.priority}
                                </span>
                                {task.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(task.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <FileUp className="w-5 h-5 text-secondary" />
                        Documents
                      </CardTitle>
                      <CardDescription>
                        Your uploaded documents and correspondence
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowUploadModal(true)}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Upload
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {documents.length > 0 ? (
                      <div className="space-y-3">
                        {documents.slice(0, 5).map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <FileText className="w-5 h-5 text-secondary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <FileUp className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No documents yet.</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => setShowUploadModal(true)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Upload Your First Document
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Audit Report Card */}
                {auditReport?.has_report && (
                  <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 backdrop-blur-sm border-secondary/30 hover:border-secondary/50 transition-all">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <FileText className="w-5 h-5 text-secondary" />
                        Credit Analysis Report
                      </CardTitle>
                      <CardDescription>
                        Your personalized credit audit is ready
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {auditReport.scores && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-background/50">
                            <p className="text-xs text-muted-foreground">TU</p>
                            <p className="text-lg font-bold text-foreground">{auditReport.scores.transunion || '---'}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-background/50">
                            <p className="text-xs text-muted-foreground">EX</p>
                            <p className="text-lg font-bold text-foreground">{auditReport.scores.experian || '---'}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-background/50">
                            <p className="text-xs text-muted-foreground">EQ</p>
                            <p className="text-lg font-bold text-foreground">{auditReport.scores.equifax || '---'}</p>
                          </div>
                        </div>
                      )}
                      <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Link href="/portal/audit-report">
                          <FileText className="w-4 h-4 mr-2" />
                          View Full Report
                        </Link>
                      </Button>
                      {auditReport.report_date && (
                        <p className="text-xs text-muted-foreground text-center">
                          Generated {new Date(auditReport.report_date).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Letter consent card */}
                {letters.length > 0 && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <FileSignature className="w-5 h-5 text-secondary" />
                        Dispute Letters & Consent
                      </CardTitle>
                      <CardDescription>
                        Review the dispute letters prepared for your latest round and approve them electronically.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pendingLetters.length > 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            We&apos;ve prepared {letters.length}{' '}
                            letter{letters.length === 1 ? '' : 's'} for your most recent dispute round.
                            You can click any letter to preview the full text before approving.
                          </p>
                          <div className="space-y-2 max-h-[180px] overflow-y-auto">
                            {letters.map((letter) => (
                              <button
                                key={letter.dispute_id}
                                type="button"
                                onClick={() => setSelectedLetter(letter)}
                                className="w-full text-left p-3 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {letter.creditor_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Round {letter.round ?? 1} • {letter.bureau.toUpperCase()}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[11px] px-2 py-1 rounded-full border ${
                                      letter.status === 'approved'
                                        ? 'bg-green-500/10 border-green-500/40 text-green-500'
                                        : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500'
                                    }`}
                                  >
                                    {letter.status === 'approved' ? 'Approved' : 'Needs approval'}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="space-y-2 pt-3 border-t border-border/60">
                            <label className="text-xs font-medium text-muted-foreground" htmlFor="letter-signature">
                              Type your full name as your electronic signature
                            </label>
                            <Input
                              id="letter-signature"
                              value={signature}
                              onChange={(e) => setSignature(e.target.value)}
                              placeholder="Full legal name"
                              className="h-9 text-sm"
                            />
                            <Button
                              type="button"
                              className="w-full mt-1"
                              onClick={handleApproveLetters}
                              disabled={approvingLetters || pendingLetters.length === 0}
                            >
                              {approvingLetters ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Recording Approval...
                                </>
                              ) : (
                                'Approve Letters'
                              )}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          All dispute letters for your latest round have been approved. Thank you.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Micro-feedback card */}
                {!feedbackEntry && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-secondary" />
                        How is your experience so far?
                      </CardTitle>
                      <CardDescription>
                        A quick 1–5 rating helps us improve your client portal.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFeedbackRating(value)}
                            className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
                              feedbackRating === value
                                ? 'bg-secondary text-secondary-foreground border-secondary'
                                : 'bg-background text-foreground border-border hover:border-secondary/60'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Optional: tell us what's working or what's confusing"
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        className="w-full"
                        onClick={handleSubmitFeedback}
                        disabled={submittingFeedback || !feedbackRating}
                      >
                        {submittingFeedback ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send feedback'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {feedbackEntry && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-secondary" />
                        Thank you for your feedback
                      </CardTitle>
                      <CardDescription>
                        You rated your experience {feedbackEntry.rating ?? '-'} / 5.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}

                {/* Quick Actions */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/portal/agreement">
                        <FileSignature className="w-4 h-4 mr-2" />
                        Service Agreement
                      </Link>
                    </Button>
                    {auditReport?.has_report && (
                      <Button asChild variant="outline" className="w-full justify-start">
                        <Link href="/portal/audit-report">
                          <FileText className="w-4 h-4 mr-2" />
                          View Audit Report
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/contact">
                        <Calendar className="w-4 h-4 mr-2" />
                        Schedule Consultation
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/settings">
                        <Shield className="w-4 h-4 mr-2" />
                        Account Settings
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowUploadModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle className="font-serif">Upload Document</CardTitle>
                <CardDescription>
                  Upload credit reports, ID documents, or correspondence for your case.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Document Type</label>
                  <select
                    value={uploadFileType}
                    onChange={(e) => setUploadFileType(e.target.value)}
                    className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="credit_report">Credit Report</option>
                    <option value="id_document">ID Document</option>
                    <option value="dispute_letter">Dispute Letter</option>
                    <option value="correspondence">Bureau Correspondence</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">File</label>
                  <div
                    className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-secondary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? (
                      <div>
                        <FileText className="w-8 h-8 mx-auto mb-2 text-secondary" />
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to select a file</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, HTML, TXT, images, or Word docs (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.html,.htm,.txt,.jpg,.jpeg,.png,.gif,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <textarea
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="Add any notes about this document..."
                    className="w-full min-h-[60px] mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setUploadNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Letter Preview Modal */}
      {selectedLetter && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedLetter(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
          >
            <Card className="bg-card border-border shadow-2xl h-full flex flex-col">
              <CardHeader>
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-secondary" />
                  Dispute Letter Preview
                </CardTitle>
                <CardDescription className="text-xs flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[11px]">
                    Round {selectedLetter.round ?? 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[11px] uppercase">
                    {selectedLetter.bureau}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {selectedLetter.creditor_name}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto border-t border-border/60 bg-muted/20">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {selectedLetter.letter_content}
                </pre>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  const [loading, setLoading] = React.useState(true);

  // Document upload state
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadFileType, setUploadFileType] = React.useState('credit_report');
  const [uploadNotes, setUploadNotes] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, docsRes, auditRes, disputesRes, scoreRes] = await Promise.all([
        fetch('/api/portal/cases'),
        fetch('/api/portal/documents'),
        fetch('/api/portal/audit-report'),
        fetch('/api/portal/disputes'),
        fetch('/api/portal/score-history'),
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
                          We'll start disputing negative items once your credit report is analyzed.
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
    </div>
  );
}

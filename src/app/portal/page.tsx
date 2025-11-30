'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Loader2, FileText, TrendingUp, Clock, CheckCircle, 
  AlertCircle, Upload, ChevronRight, Sparkles, Shield,
  FileUp, Calendar, Target, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';

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
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, docsRes] = await Promise.all([
        fetch('/api/portal/cases'),
        fetch('/api/portal/documents'),
      ]);

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData.cases || []);
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
      }
    } catch (error) {
      console.error('Error fetching portal data:', error);
    } finally {
      setLoading(false);
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
              </div>

              {/* Documents Sidebar */}
              <div className="space-y-6">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl flex items-center gap-2">
                      <FileUp className="w-5 h-5 text-secondary" />
                      Documents
                    </CardTitle>
                    <CardDescription>
                      Your uploaded documents and correspondence
                    </CardDescription>
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
                      <p className="text-muted-foreground text-center py-6">No documents yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
    </div>
  );
}

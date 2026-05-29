'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Loader2,
  Save,
  ExternalLink,
  Printer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ClientTabs, type ClientTab } from '@/components/admin/ClientTabs';
import { ProgressTab } from '@/components/admin/ProgressTab';
import { toast } from 'sonner';

import { ClientHeader } from '@/components/admin/client-detail/ClientHeader';
import { OverviewTab } from '@/components/admin/client-detail/OverviewTab';
import { ReportsTab } from '@/components/admin/client-detail/ReportsTab';
import { DisputesTab } from '@/components/admin/client-detail/DisputesTab';
import { TasksTab } from '@/components/admin/client-detail/TasksTab';
import { NotesTab } from '@/components/admin/client-detail/NotesTab';

import type {
  ClientDetail,
  CreditReport,
  CreditAnalysis,
  CreditAccount,
  NegativeItem,
  Dispute,
  ScoreHistory,
  ClientReadiness,
  ClientNote,
  Task,
  ClientDisputeStatus,
} from '@/components/admin/client-detail/types';
import {
  deriveDisputeStatus,
  bureauOptions,
} from '@/components/admin/client-detail/types';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [activeTab, setActiveTab] = React.useState<ClientTab>('overview');
  const [loading, setLoading] = React.useState(true);

  const [client, setClient] = React.useState<ClientDetail | null>(null);
  const [creditReports, setCreditReports] = React.useState<CreditReport[]>([]);
  const [latestAnalysis, setLatestAnalysis] = React.useState<CreditAnalysis | null>(null);
  const [creditAccounts, setCreditAccounts] = React.useState<CreditAccount[]>([]);
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [negativeItemsCount, setNegativeItemsCount] = React.useState(0);
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [scoreHistory, setScoreHistory] = React.useState<ScoreHistory[]>([]);
  const [readiness, setReadiness] = React.useState<ClientReadiness | null>(null);
  const [clientNotes, setClientNotes] = React.useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = React.useState<Task[]>([]);

  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [generatingReport, setGeneratingReport] = React.useState(false);
  const [sendingNudge, setSendingNudge] = React.useState(false);

  const [selectedBureau, setSelectedBureau] = React.useState('combined');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [reportDate, setReportDate] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const disputeStatus: ClientDisputeStatus = React.useMemo(
    () => deriveDisputeStatus(disputes, readiness),
    [disputes, readiness],
  );

  const fetchClientData = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClient(data.client);
        setCreditReports(data.credit_reports || []);
        setLatestAnalysis(data.latest_analysis);
        setCreditAccounts(data.credit_accounts || []);
        setNegativeItems(data.negative_items || []);
        setNegativeItemsCount(data.negative_items_count || 0);
        setDisputes(data.disputes || []);
        setScoreHistory(data.score_history || []);
        setReadiness(data.readiness || null);
      } else if (response.status === 404) {
        router.push('/admin/clients');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  const fetchNotesAndTasks = React.useCallback(async () => {
    try {
      const [notesRes, tasksRes] = await Promise.all([
        fetch(`/api/admin/notes?client_id=${clientId}&limit=50`),
        fetch(`/api/admin/tasks?client_id=${clientId}&limit=50`),
      ]);
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setClientNotes(notesData.items);
      }
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setClientTasks(tasksData.items);
      }
    } catch (error) {
      console.error('Error fetching notes/tasks:', error);
    }
  }, [clientId]);

  React.useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  React.useEffect(() => {
    if (clientId) fetchNotesAndTasks();
  }, [clientId, fetchNotesAndTasks]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('client_id', clientId);
      formData.append('bureau', selectedBureau);
      if (reportDate) formData.append('report_date', reportDate);

      const response = await fetch('/api/admin/credit-reports/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setShowUploadModal(false);
        setSelectedFile(null);
        setSelectedBureau('combined');
        setReportDate('');
        fetchClientData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateReport = async (openInNewTab: boolean = true) => {
    setGeneratingReport(true);
    try {
      if (openInNewTab) {
        window.open(`/admin/clients/${clientId}/audit-report`, '_blank');
      } else {
        const response = await fetch(`/api/admin/clients/${clientId}/audit-report`, { method: 'POST' });
        if (response.ok) toast.success('Audit report saved successfully!');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
      setShowReportModal(false);
    }
  };

  const handleSendNudge = async () => {
    if (!clientId) return;
    setSendingNudge(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'waiting_on_client' }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    } finally {
      setSendingNudge(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'text/html', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF, HTML, or text file');
        return;
      }
      setSelectedFile(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6">
      <div className="h-px w-full bg-gradient-to-r from-secondary/35 via-border to-transparent" />
      <ClientHeader
        client={client}
        disputeStatus={disputeStatus}
        latestAnalysis={latestAnalysis}
        openDisputesCount={disputes.filter((d) => ['sent', 'in_progress', 'pending'].includes(d.status)).length}
        reportsCount={creditReports.length}
        onRefresh={fetchClientData}
        onUploadReport={() => setShowUploadModal(true)}
        onAuditReport={() => setShowReportModal(true)}
      />

      <ClientTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          reports: creditReports.length,
          disputes: disputes.length,
          tasks: clientTasks.filter((t) => t.status !== 'done').length,
          notes: clientNotes.length,
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <OverviewTab
              client={client}
              clientId={clientId}
              latestAnalysis={latestAnalysis}
              readiness={readiness}
              scoreHistory={scoreHistory}
              negativeItemsCount={negativeItemsCount}
              disputes={disputes}
              creditReports={creditReports}
              clientNotes={clientNotes}
              clientTasks={clientTasks}
              onClientUpdated={(updated) => setClient(updated)}
              onSendNudge={handleSendNudge}
              sendingNudge={sendingNudge}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressTab
              clientId={clientId}
              creditReports={creditReports}
              scoreHistory={scoreHistory}
              disputes={disputes}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              clientId={clientId}
              creditReports={creditReports}
              creditAccounts={creditAccounts}
              onDataChanged={fetchClientData}
              onOpenUploadModal={() => setShowUploadModal(true)}
            />
          )}

          {activeTab === 'disputes' && (
            <DisputesTab
              clientId={clientId}
              negativeItems={negativeItems}
              disputes={disputes}
              onDataChanged={fetchClientData}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksTab
              clientId={clientId}
              tasks={clientTasks}
              onTasksChanged={fetchNotesAndTasks}
            />
          )}

          {activeTab === 'notes' && (
            <NotesTab
              clientId={clientId}
              notes={clientNotes}
              onNotesChanged={fetchNotesAndTasks}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowUploadModal(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="surface-panel rounded-lg shadow-xl">
              <CardHeader>
                <CardTitle>Upload Credit Report</CardTitle>
                <CardDescription>Upload a PDF or HTML credit report file.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Bureau</label>
                  <select value={selectedBureau} onChange={(e) => setSelectedBureau(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    {bureauOptions.map((b) => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Report Date (Optional)</label>
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">File</label>
                  <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-secondary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    {selectedFile ? (
                      <div>
                        <FileText className="w-8 h-8 mx-auto mb-2 text-secondary" />
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to select a file</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, HTML, or TXT (max 10MB)</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.html,.htm,.txt" onChange={handleFileSelect} className="hidden" />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleUpload} disabled={!selectedFile || uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="surface-panel rounded-lg shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-secondary" />
                  Generate Audit Report
                </CardTitle>
                <CardDescription>Create a professional credit audit report for {client?.first_name} {client?.last_name}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-md border border-border/70 bg-muted/40 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Negative Items:</span>
                    <span className="font-medium">{negativeItemsCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credit Scores:</span>
                    <span className="font-medium">{latestAnalysis?.score_transunion || '---'} / {latestAnalysis?.score_experian || '---'} / {latestAnalysis?.score_equifax || '---'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => handleGenerateReport(true)} disabled={generatingReport}>
                    {generatingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    View Report in New Tab
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleGenerateReport(true)} disabled={generatingReport}>
                    <Printer className="w-4 h-4 mr-2" />
                    Open for Printing / PDF
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleGenerateReport(false)} disabled={generatingReport}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Report to History
                  </Button>
                </div>
                <div className="pt-2">
                  <Button variant="ghost" className="w-full" onClick={() => setShowReportModal(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

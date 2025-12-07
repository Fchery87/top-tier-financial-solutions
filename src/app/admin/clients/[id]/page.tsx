'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Mail, 
  Phone, 
  Upload,
  FileText,
  Loader2,
  Save,
  Trash2,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Play,
  CheckCircle2,
  Lightbulb,
  Scale,
  Plus,
  MessageSquare,
  CheckSquare,
  Clock,
  User,
  FileBarChart,
  ExternalLink,
  Printer,
  Wand2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
import { ClientTabs, type ClientTab } from '@/components/admin/ClientTabs';
import { ProgressTab } from '@/components/admin/ProgressTab';

interface ClientDetail {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  notes: string | null;
  converted_at: string;
  created_at: string;
  user_name: string | null;
}

interface CreditReport {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number;
  bureau: string | null;
  report_date: string | null;
  parse_status: string;
  uploaded_at: string;
}

interface CreditAnalysis {
  id: string;
  score_transunion: number | null;
  score_experian: number | null;
  score_equifax: number | null;
  total_accounts: number;
  open_accounts: number;
  closed_accounts: number;
  total_debt: number;
  total_credit_limit: number;
  utilization_percent: number | null;
  derogatory_count: number;
  collections_count: number;
  late_payment_count: number;
  inquiry_count: number;
  created_at: string;
  recommendations?: string[];
}

interface Dispute {
  id: string;
  bureau: string;
  dispute_reason: string;
  dispute_type: string;
  status: string;
  round: number;
  sent_at: string | null;
  outcome: string | null;
  created_at: string;
}

interface CreditAccount {
  id: string;
  creditor_name: string;
  account_number: string | null;
  account_type: string | null;
  account_status: string | null;
  balance: number | null;
  credit_limit: number | null;
  payment_status: string | null;
  date_opened: string | null;
  bureau: string | null; // Legacy field
  // Per-bureau presence fields
  bureaus?: string[];
  on_transunion?: boolean;
  on_experian?: boolean;
  on_equifax?: boolean;
  transunion_date?: string | null;
  experian_date?: string | null;
  equifax_date?: string | null;
  transunion_balance?: number | null;
  experian_balance?: number | null;
  equifax_balance?: number | null;
  is_negative: boolean;
  risk_level: string | null;
}

interface NegativeItem {
  id: string;
  item_type: string;
  creditor_name: string;
  original_creditor: string | null;
  amount: number | null;
  date_reported: string | null;
  bureau: string | null; // Legacy field
  // Per-bureau presence fields
  bureaus?: string[];
  on_transunion?: boolean;
  on_experian?: boolean;
  on_equifax?: boolean;
  transunion_date?: string | null;
  experian_date?: string | null;
  equifax_date?: string | null;
  transunion_status?: string | null;
  experian_status?: string | null;
  equifax_status?: string | null;
  risk_severity: string;
  recommended_action: string | null;
  dispute_reason: string | null;
}

interface ClientNote {
  id: string;
  client_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface Task {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_at: string;
}

interface ScoreHistory {
  id: string;
  score_transunion: number | null;
  score_experian: number | null;
  score_equifax: number | null;
  average_score: number | null;
  source: string;
  notes: string | null;
  recorded_at: string;
}

interface ClientReadiness {
  has_portal_user: boolean;
  has_signed_agreement: boolean;
  has_credit_report: boolean;
  has_analyzed_report: boolean;
  has_case: boolean;
  has_disputes: boolean;
  unfinished_client_tasks: number;
  blocking_tasks: number;
  is_ready_for_round: boolean;
}

type ClientDisputeStatus =
  | 'not_started'
  | 'waiting_on_client'
  | 'with_bureaus'
  | 'analyzing_results'
  | 'completed';

const DISPUTE_STATUS_LABELS: Record<ClientDisputeStatus, string> = {
  not_started: 'Not started',
  waiting_on_client: 'Waiting on client',
  with_bureaus: 'With bureaus',
  analyzing_results: 'Analyzing results',
  completed: 'Completed',
};

const DISPUTE_STATUS_CLASSES: Record<ClientDisputeStatus, string> = {
  not_started: 'bg-muted text-muted-foreground border-border',
  waiting_on_client: 'bg-amber-500/10 text-amber-500 border-amber-500/40',
  with_bureaus: 'bg-blue-500/10 text-blue-500 border-blue-500/40',
  analyzing_results: 'bg-purple-500/10 text-purple-500 border-purple-500/40',
  completed: 'bg-green-500/10 text-green-500 border-green-500/40',
};

const statusOptions = ['pending', 'active', 'paused', 'completed', 'cancelled'];
const bureauOptions = ['transunion', 'experian', 'equifax', 'combined'];

// Helper function to check if account/item appears on a specific bureau
// Uses new per-bureau boolean fields with fallback to legacy bureau field
function appearsOnBureau(item: { bureau: string | null; on_transunion?: boolean; on_experian?: boolean; on_equifax?: boolean; bureaus?: string[] }, bureau: string): boolean {
  const bureauLower = bureau.toLowerCase();
  
  // Check new per-bureau boolean fields first
  if (bureauLower === 'transunion' && item.on_transunion !== undefined) return item.on_transunion;
  if (bureauLower === 'experian' && item.on_experian !== undefined) return item.on_experian;
  if (bureauLower === 'equifax' && item.on_equifax !== undefined) return item.on_equifax;
  
  // Check bureaus array if available
  if (item.bureaus && item.bureaus.length > 0) return item.bureaus.includes(bureauLower);
  
  // Fallback to legacy logic
  if (!item.bureau || item.bureau === 'combined') return true;
  return item.bureau.toLowerCase() === bureauLower;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  // Tab state
  const [activeTab, setActiveTab] = React.useState<ClientTab>('overview');

  // Data state
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [client, setClient] = React.useState<ClientDetail | null>(null);
  const [creditReports, setCreditReports] = React.useState<CreditReport[]>([]);
  const [latestAnalysis, setLatestAnalysis] = React.useState<CreditAnalysis | null>(null);
  const [creditAccounts, setCreditAccounts] = React.useState<CreditAccount[]>([]);
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [negativeItemsCount, setNegativeItemsCount] = React.useState(0);
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [scoreHistory, setScoreHistory] = React.useState<ScoreHistory[]>([]);
  const [readiness, setReadiness] = React.useState<ClientReadiness | null>(null);
  const disputeStatus: ClientDisputeStatus = React.useMemo(
    () => deriveDisputeStatus(disputes, readiness),
    [disputes, readiness],
  );
  
  const [editMode, setEditMode] = React.useState(false);
  const [editedClient, setEditedClient] = React.useState<Partial<ClientDetail>>({});
  
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [selectedBureau, setSelectedBureau] = React.useState('combined');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [reportDate, setReportDate] = React.useState('');

  // Notes and Tasks state
  const [clientNotes, setClientNotes] = React.useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = React.useState<Task[]>([]);
  const [newNote, setNewNote] = React.useState('');
  const [addingNote, setAddingNote] = React.useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = React.useState(false);
  const [newTask, setNewTask] = React.useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });
  const [addingTask, setAddingTask] = React.useState(false);

  // Dispute modal state
  const [showDisputeModal, setShowDisputeModal] = React.useState(false);
  const [selectedNegativeItem, setSelectedNegativeItem] = React.useState<NegativeItem | null>(null);
  const [creatingDispute, setCreatingDispute] = React.useState(false);
  const [disputeBureau, setDisputeBureau] = React.useState('transunion');
  const [disputeReason, setDisputeReason] = React.useState('');
  const [disputeType, setDisputeType] = React.useState('standard');

  // Audit report state
  const [generatingReport, setGeneratingReport] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [sendingNudge, setSendingNudge] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
        setEditedClient(data.client);
      } else if (response.status === 404) {
        router.push('/admin/clients');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  React.useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

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
    if (clientId) {
      fetchNotesAndTasks();
    }
  }, [clientId, fetchNotesAndTasks]);

  // Handlers
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedClient),
      });
      if (response.ok) {
        setClient({ ...client, ...editedClient } as ClientDetail);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error saving client:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'text/html', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a PDF, HTML, or text file');
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
        alert(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeReport = async (reportId: string) => {
    setAnalyzing(reportId);
    try {
      const response = await fetch(`/api/admin/credit-reports/${reportId}/parse`, { method: 'POST' });
      if (response.ok) {
        fetchClientData();
      } else {
        const error = await response.json();
        alert(error.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing report:', error);
      alert('Analysis failed');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Delete this credit report and all associated data?')) return;
    setDeleting(reportId);
    try {
      const response = await fetch(`/api/admin/credit-reports/${reportId}`, { method: 'DELETE' });
      if (response.ok) fetchClientData();
    } catch (error) {
      console.error('Error deleting report:', error);
    } finally {
      setDeleting(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const response = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, content: newNote.trim() }),
      });
      if (response.ok) {
        setNewNote('');
        fetchNotesAndTasks();
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await fetch(`/api/admin/notes/${noteId}`, { method: 'DELETE' });
      fetchNotesAndTasks();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    setAddingTask(true);
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
        }),
      });
      if (response.ok) {
        setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
        setShowAddTaskModal(false);
        fetchNotesAndTasks();
      }
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setAddingTask(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchNotesAndTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`/api/admin/tasks/${taskId}`, { method: 'DELETE' });
      fetchNotesAndTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleCreateDispute = (item: NegativeItem) => {
    setSelectedNegativeItem(item);
    setDisputeBureau(item.bureau || 'transunion');
    setDisputeReason(item.dispute_reason || `This ${formatItemType(item.item_type).toLowerCase()} is inaccurate and should be removed.`);
    setDisputeType('standard');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!client || !selectedNegativeItem) return;
    setCreatingDispute(true);
    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          negativeItemId: selectedNegativeItem.id,
          bureau: disputeBureau,
          disputeReason: disputeReason,
          disputeType: disputeType,
        }),
      });
      if (response.ok) {
        setShowDisputeModal(false);
        setSelectedNegativeItem(null);
        setDisputeReason('');
        fetchClientData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create dispute');
      }
    } catch (error) {
      console.error('Error creating dispute:', error);
      alert('Failed to create dispute');
    } finally {
      setCreatingDispute(false);
    }
  };

  const handleGenerateReport = async (openInNewTab: boolean = true, _reportType: 'comprehensive' | 'simple' = 'simple') => {
    setGeneratingReport(true);
    try {
      if (openInNewTab) {
        // Open the new audit report page for a better viewing experience
        window.open(`/admin/clients/${clientId}/audit-report`, '_blank');
      } else {
        const response = await fetch(`/api/admin/clients/${clientId}/audit-report`, { method: 'POST' });
        if (response.ok) alert('Audit report saved successfully!');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
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
        alert(data.error || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder');
    } finally {
      setSendingNudge(false);
    }
  };

  // Utility functions
  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 750) return 'text-green-500';
    if (score >= 700) return 'text-lime-500';
    if (score >= 650) return 'text-yellow-500';
    if (score >= 600) return 'text-orange-500';
    return 'text-red-500';
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const formatItemType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getRiskSeverityColor = (severity: string) => {
    switch (severity) {
      case 'severe': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'low': return 'text-green-500 bg-green-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'low': return 'text-green-500 bg-green-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const isTaskOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

function deriveDisputeStatus(
  disputes: Dispute[],
  readiness: ClientReadiness | null,
): ClientDisputeStatus {
  if (!disputes || disputes.length === 0) {
    return readiness && !readiness.is_ready_for_round ? 'waiting_on_client' : 'not_started';
  }

  const sentOrInProgress = disputes.filter((d) =>
    ['sent', 'in_progress'].includes(d.status),
  );
  const unresolvedSent = sentOrInProgress.filter((d) => !d.outcome);

  if (unresolvedSent.length > 0) {
    return 'with_bureaus';
  }

  const resolved = disputes.filter((d) =>
    d.status === 'resolved' || ['deleted', 'verified', 'updated'].includes(d.outcome ?? ''),
  );

  if (resolved.length > 0 && (!readiness || !readiness.is_ready_for_round)) {
    return 'analyzing_results';
  }

  if (resolved.length > 0) {
    return 'completed';
  }

  return readiness && !readiness.is_ready_for_round ? 'waiting_on_client' : 'not_started';
}

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/clients')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-serif font-bold text-foreground"
            >
              {client.first_name} {client.last_name}
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 mt-1 flex-wrap"
            >
              <StatusBadge status={client.status} variant={getStatusVariant(client.status)} />
              <span className="text-muted-foreground text-sm">Client since {new Date(client.converted_at).toLocaleDateString()}</span>
              {disputeStatus && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full border ${DISPUTE_STATUS_CLASSES[disputeStatus]}`}
                >
                  Disputes: {DISPUTE_STATUS_LABELS[disputeStatus]}
                </span>
              )}
            </motion.div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchClientData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setShowReportModal(true)}
            disabled={!latestAnalysis}
          >
            <FileBarChart className="w-4 h-4 mr-2" />
            Audit Report
          </Button>
          <Button size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Report
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <ClientTabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        counts={{
          reports: creditReports.length,
          disputes: disputes.length,
          tasks: clientTasks.filter(t => t.status !== 'done').length,
          notes: clientNotes.length,
        }}
      />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left - Contact Info + Readiness */}
              <div className="space-y-6">
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                    {!editMode ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>Edit</Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editMode ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">First Name</label>
                            <Input value={editedClient.first_name || ''} onChange={(e) => setEditedClient({ ...editedClient, first_name: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Last Name</label>
                            <Input value={editedClient.last_name || ''} onChange={(e) => setEditedClient({ ...editedClient, last_name: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Email</label>
                          <Input value={editedClient.email || ''} onChange={(e) => setEditedClient({ ...editedClient, email: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Phone</label>
                          <Input value={editedClient.phone || ''} onChange={(e) => setEditedClient({ ...editedClient, phone: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Status</label>
                          <select value={editedClient.status || ''} onChange={(e) => setEditedClient({ ...editedClient, status: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                            {statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Notes</label>
                          <textarea value={editedClient.notes || ''} onChange={(e) => setEditedClient({ ...editedClient, notes: e.target.value })} className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{client.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{client.phone || 'No phone number'}</span>
                        </div>
                        {client.notes && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-sm text-muted-foreground">{client.notes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {readiness && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="w-5 h-5 text-secondary" />
                        Onboarding & Readiness
                      </CardTitle>
                      <CardDescription>
                        Snapshot of where this client is in the user-to-client workflow.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                          readiness.is_ready_for_round
                            ? 'border-green-500/40 bg-green-500/10 text-green-500'
                            : readiness.blocking_tasks > 0 || readiness.unfinished_client_tasks > 0
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                              : 'border-muted bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {readiness.is_ready_for_round ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                          <span className="font-medium">
                            {readiness.is_ready_for_round ? 'Ready for next dispute round' : 'Waiting on client'}
                          </span>
                        </div>
                        {!readiness.is_ready_for_round && (
                          <span className="text-xs">
                            {readiness.blocking_tasks > 0
                              ? `${readiness.blocking_tasks} blocking task${readiness.blocking_tasks > 1 ? 's' : ''}`
                              : readiness.unfinished_client_tasks > 0
                                ? `${readiness.unfinished_client_tasks} open task${readiness.unfinished_client_tasks > 1 ? 's' : ''}`
                                : 'Setup incomplete'}
                          </span>
                        )}
                      </div>

                      {readiness.at_risk && readiness.waiting_on_client_days !== null && (
                        <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-red-500/40 bg-red-500/10 text-red-500">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="font-medium">Client at risk</span>
                          </div>
                          <span>
                            Waiting on client for {readiness.waiting_on_client_days} day{readiness.waiting_on_client_days === 1 ? '' : 's'}
                          </span>
                        </div>
                      )}

                      <ul className="space-y-1 text-sm">
                        {[
                          { label: 'Portal account linked', value: readiness.has_portal_user },
                          { label: 'Service agreement signed', value: readiness.has_signed_agreement },
                          { label: 'Credit report uploaded', value: readiness.has_credit_report },
                          { label: 'Credit report analyzed', value: readiness.has_analyzed_report },
                          { label: 'Client case created', value: readiness.has_case },
                          { label: 'At least one dispute created', value: readiness.has_disputes },
                        ].map((item) => (
                          <li key={item.label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span
                              className={`flex items-center gap-1 text-xs font-medium ${
                                item.value ? 'text-green-500' : 'text-muted-foreground'
                              }`}
                            >
                              {item.value ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {item.value ? 'Done' : 'Pending'}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {readiness.at_risk && (
                        <div className="pt-3 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSendNudge}
                            disabled={sendingNudge}
                          >
                            {sendingNudge ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Mail className="w-3 h-3 mr-1" />
                            )}
                            Send reminder
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Center & Right - Credit Summary */}
              <div className="lg:col-span-2 space-y-6">
                {/* Credit Scores */}
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Credit Scores</CardTitle>
                    <CardDescription>
                      {latestAnalysis ? `Last updated ${new Date(latestAnalysis.created_at).toLocaleDateString()}` : 'No analysis available'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {latestAnalysis ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-1">TransUnion</p>
                          <p className={`text-3xl font-bold ${getScoreColor(latestAnalysis.score_transunion)}`}>
                            {latestAnalysis.score_transunion || '—'}
                          </p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-1">Experian</p>
                          <p className={`text-3xl font-bold ${getScoreColor(latestAnalysis.score_experian)}`}>
                            {latestAnalysis.score_experian || '—'}
                          </p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-1">Equifax</p>
                          <p className={`text-3xl font-bold ${getScoreColor(latestAnalysis.score_equifax)}`}>
                            {latestAnalysis.score_equifax || '—'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Upload a credit report to see scores and analysis.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                {latestAnalysis && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardContent className="p-4 text-center">
                        <CreditCard className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                        <p className="text-xl font-bold">{latestAnalysis.total_accounts}</p>
                        <p className="text-xs text-muted-foreground">Total Accounts</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardContent className="p-4 text-center">
                        <TrendingUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
                        <p className="text-xl font-bold">{latestAnalysis.utilization_percent || 0}%</p>
                        <p className="text-xs text-muted-foreground">Utilization</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardContent className="p-4 text-center">
                        <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-red-500" />
                        <p className="text-xl font-bold">{negativeItemsCount}</p>
                        <p className="text-xs text-muted-foreground">Negative Tradelines</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardContent className="p-4 text-center">
                        <TrendingDown className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                        <p className="text-xl font-bold">{formatCurrency(latestAnalysis.total_debt)}</p>
                        <p className="text-xs text-muted-foreground">Total Debt</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Recommendations */}
                {latestAnalysis?.recommendations && latestAnalysis.recommendations.length > 0 && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-yellow-500" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {latestAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                          <li key={index} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                            <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Score Progress Timeline */}
                {scoreHistory.length > 0 && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        Score Progress
                      </CardTitle>
                      <CardDescription>Credit score changes over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Score Timeline Chart */}
                        <div className="h-48 flex items-end gap-1">
                          {scoreHistory.slice(-12).map((entry, index) => {
                            const maxScore = 850;
                            const score = entry.average_score || 0;
                            const heightPercent = (score / maxScore) * 100;
                            const prevScore = index > 0 ? (scoreHistory.slice(-12)[index - 1]?.average_score || 0) : score;
                            const isImprovement = score > prevScore;
                            
                            return (
                              <div key={entry.id} className="flex-1 flex flex-col items-center gap-1">
                                <div 
                                  className={`w-full rounded-t transition-all ${
                                    isImprovement ? 'bg-green-500' : score < prevScore ? 'bg-red-500' : 'bg-blue-500'
                                  }`}
                                  style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                                  title={`${score} - ${new Date(entry.recorded_at).toLocaleDateString()}`}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Score Change Summary */}
                        {scoreHistory.length >= 2 && (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="text-sm font-medium">Score Change</p>
                              <p className="text-xs text-muted-foreground">
                                From {scoreHistory[0]?.average_score || '—'} to {scoreHistory[scoreHistory.length - 1]?.average_score || '—'}
                              </p>
                            </div>
                            <div className={`flex items-center gap-1 text-lg font-bold ${
                              (scoreHistory[scoreHistory.length - 1]?.average_score || 0) > (scoreHistory[0]?.average_score || 0)
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}>
                              {(scoreHistory[scoreHistory.length - 1]?.average_score || 0) > (scoreHistory[0]?.average_score || 0) ? (
                                <TrendingUp className="w-5 h-5" />
                              ) : (
                                <TrendingDown className="w-5 h-5" />
                              )}
                              {Math.abs((scoreHistory[scoreHistory.length - 1]?.average_score || 0) - (scoreHistory[0]?.average_score || 0))} pts
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <ProgressTab 
              clientId={clientId} 
              creditReports={creditReports}
              scoreHistory={scoreHistory}
              disputes={disputes}
            />
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Credit Reports</CardTitle>
                  <CardDescription>{creditReports.length} report(s) uploaded</CardDescription>
                </CardHeader>
                <CardContent>
                  {creditReports.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No credit reports uploaded yet.</p>
                      <Button className="mt-4" onClick={() => setShowUploadModal(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload First Report
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {creditReports.map((report) => (
                        <div key={report.id} className="p-4 rounded-lg bg-muted/50 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{report.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {report.bureau?.toUpperCase() || 'Combined'} • {new Date(report.uploaded_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={report.parse_status} variant={report.parse_status === 'completed' ? 'success' : report.parse_status === 'failed' ? 'danger' : 'warning'} />
                          </div>
                          <div className="flex items-center gap-2 pl-8">
                            {(report.parse_status === 'pending' || report.parse_status === 'failed') && (
                              <Button variant="outline" size="sm" onClick={() => handleAnalyzeReport(report.id)} disabled={analyzing === report.id || deleting === report.id}>
                                {analyzing === report.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                                Analyze
                              </Button>
                            )}
                            {report.parse_status === 'completed' && (
                              <Button variant="outline" size="sm" onClick={() => handleAnalyzeReport(report.id)} disabled={analyzing === report.id || deleting === report.id}>
                                {analyzing === report.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                Re-analyze
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleDeleteReport(report.id)} disabled={deleting === report.id || analyzing === report.id} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-200">
                              {deleting === report.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Credit Accounts */}
              {creditAccounts.length > 0 && (
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Credit Accounts</CardTitle>
                    <CardDescription>{creditAccounts.length} account(s) on file (all tradelines)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-2 font-medium">Creditor</th>
                            <th className="text-left p-2 font-medium">Type</th>
                            <th className="text-left p-2 font-medium">Bureaus</th>
                            <th className="text-right p-2 font-medium">Balance</th>
                            <th className="text-right p-2 font-medium">Limit</th>
                            <th className="text-left p-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditAccounts.map((account) => (
                            <tr key={account.id} className={`border-b border-border/50 ${account.is_negative ? 'bg-red-500/5' : ''}`}>
                              <td className="p-2">
                                <p className="font-medium">{account.creditor_name}</p>
                                {account.account_number && <p className="text-xs text-muted-foreground">****{account.account_number.slice(-4)}</p>}
                              </td>
                              <td className="p-2 text-muted-foreground capitalize">{account.account_type?.replace('_', ' ') || '—'}</td>
                              <td className="p-2">
                                {/* Bureau Indicators - Show which bureaus this account appears on */}
                                <div className="flex items-center gap-1">
                                  {['transunion', 'experian', 'equifax'].map((bureau) => {
                                    // Uses new per-bureau boolean fields with fallback to legacy logic
                                    const onBureau = appearsOnBureau(account, bureau);
                                    // Get bureau-specific balance for tooltip
                                    const bureauBalance = bureau === 'transunion' ? account.transunion_balance 
                                      : bureau === 'experian' ? account.experian_balance 
                                      : account.equifax_balance;
                                    const bureauDate = bureau === 'transunion' ? account.transunion_date 
                                      : bureau === 'experian' ? account.experian_date 
                                      : account.equifax_date;
                                    return (
                                      <span
                                        key={bureau}
                                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                          onBureau
                                            ? bureau === 'transunion' ? 'bg-blue-500/20 text-blue-500' :
                                              bureau === 'experian' ? 'bg-purple-500/20 text-purple-500' :
                                              'bg-green-500/20 text-green-500'
                                            : 'bg-muted/30 text-muted-foreground/30'
                                        }`}
                                        title={onBureau 
                                          ? `${bureau.charAt(0).toUpperCase() + bureau.slice(1)}${bureauBalance ? ` - $${(bureauBalance / 100).toFixed(2)}` : ''}${bureauDate ? ` (${new Date(bureauDate).toLocaleDateString()})` : ''}`
                                          : `Not reported on ${bureau.charAt(0).toUpperCase() + bureau.slice(1)}`}
                                      >
                                        {bureau === 'transunion' ? 'TU' : bureau === 'experian' ? 'EXP' : 'EQ'}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="p-2 text-right">{account.balance ? formatCurrency(account.balance) : '—'}</td>
                              <td className="p-2 text-right">{account.credit_limit ? formatCurrency(account.credit_limit) : '—'}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${account.payment_status === 'current' ? 'bg-green-500/10 text-green-500' : account.is_negative ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                                  {account.payment_status?.replace('_', ' ') || account.account_status || '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Disputes Tab */}
          {activeTab === 'disputes' && (
            <div className="space-y-6">
              {/* Negative Items */}
              {negativeItems.length > 0 && (
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Negative Items
                    </CardTitle>
                    <CardDescription>{negativeItems.length} item(s) affecting credit</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {negativeItems.map((item) => (
                        <div key={item.id} className="p-4 rounded-lg bg-muted/50 border border-border/50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskSeverityColor(item.risk_severity)}`}>
                                  {item.risk_severity.toUpperCase()}
                                </span>
                                <span className="text-xs text-muted-foreground">{formatItemType(item.item_type)}</span>
                              </div>
                              <p className="font-medium">{item.creditor_name}</p>
                              {item.original_creditor && <p className="text-xs text-muted-foreground">Original: {item.original_creditor}</p>}
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {item.amount && <span>Amount: {formatCurrency(item.amount)}</span>}
                                {item.bureau && <span>{item.bureau.toUpperCase()}</span>}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleCreateDispute(item)}>
                              <Scale className="w-4 h-4 mr-1" />
                              Dispute
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active Disputes */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Disputes</CardTitle>
                    <CardDescription>{disputes.length} dispute(s)</CardDescription>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => router.push('/admin/disputes/wizard')}>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Dispute Wizard
                  </Button>
                </CardHeader>
                <CardContent>
                  {disputes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No disputes created yet. Analyze a credit report to identify items to dispute.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {disputes.map((dispute) => (
                        <div key={dispute.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{dispute.dispute_reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {dispute.bureau.toUpperCase()} • Round {dispute.round} • {dispute.dispute_type}
                            </p>
                          </div>
                          <StatusBadge status={dispute.status} variant={getStatusVariant(dispute.status)} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-blue-500" />
                    Tasks
                  </CardTitle>
                  <CardDescription>{clientTasks.length} task(s) for this client</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddTaskModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Task
                </Button>
              </CardHeader>
              <CardContent>
                {clientTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tasks for this client yet.</p>
                ) : (
                  <div className="space-y-3">
                    {clientTasks.map((task) => (
                      <div key={task.id} className={`p-3 rounded-lg bg-muted/50 ${isTaskOverdue(task.due_date, task.status) ? 'border border-red-500/30' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                            {task.description && <p className="text-xs text-muted-foreground mt-1 truncate">{task.description}</p>}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                              {task.due_date && (
                                <span className={`text-xs flex items-center gap-1 ${isTaskOverdue(task.due_date, task.status) ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  <Clock className="w-3 h-3" />
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={task.status} onChange={(e) => handleTaskStatusChange(task.id, e.target.value)} className="h-7 px-2 text-xs rounded border border-input bg-background">
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Review</option>
                              <option value="done">Done</option>
                            </select>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteTask(task.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  Notes
                </CardTitle>
                <CardDescription>Activity and notes for this client</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  />
                  <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} className="self-end">
                    {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
                
                {clientNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No notes yet. Add a note above to track client interactions.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {clientNotes.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg bg-muted/50 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{note.author_name || 'Unknown'}</span>
                              <span>•</span>
                              <span>{new Date(note.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity" onClick={() => handleDeleteNote(note.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      {/* Upload Modal */}
      {showUploadModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowUploadModal(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <Card className="bg-card border-border shadow-2xl">
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
          </motion.div>
        </motion.div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddTaskModal(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Add Task</CardTitle>
                <CardDescription>Create a new task for this client.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Task description..." className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Due Date</label>
                    <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddTaskModal(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleAddTask} disabled={addingTask || !newTask.title.trim()}>
                    {addingTask && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowDisputeModal(false); setSelectedNegativeItem(null); }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Create Dispute</CardTitle>
                <CardDescription>Create a dispute for {selectedNegativeItem?.creditor_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Bureau</label>
                  <select value={disputeBureau} onChange={(e) => setDisputeBureau(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="transunion">TransUnion</option>
                    <option value="experian">Experian</option>
                    <option value="equifax">Equifax</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Dispute Type</label>
                  <select value={disputeType} onChange={(e) => setDisputeType(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="standard">Standard Dispute</option>
                    <option value="method_of_verification">Method of Verification</option>
                    <option value="direct_creditor">Direct to Creditor</option>
                    <option value="goodwill">Goodwill Letter</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Dispute Reason</label>
                  <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Reason for dispute..." className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowDisputeModal(false); setSelectedNegativeItem(null); }}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSubmitDispute} disabled={creatingDispute || !disputeReason.trim()}>
                    {creatingDispute && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create Dispute
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Audit Report Modal */}
      {showReportModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileBarChart className="w-5 h-5 text-secondary" />
                  Generate Audit Report
                </CardTitle>
                <CardDescription>Create a professional credit audit report for {client?.first_name} {client?.last_name}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
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
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
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
  Eye,
  Download,
  Play,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Scale,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';

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
  bureau: string | null;
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
  bureau: string | null;
  risk_severity: string;
  recommended_action: string | null;
  dispute_reason: string | null;
}

interface CreditAnalysisWithRecs extends CreditAnalysis {
  recommendations?: string[];
}

const statusOptions = ['pending', 'active', 'paused', 'completed', 'cancelled'];
const bureauOptions = ['transunion', 'experian', 'equifax', 'combined'];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [client, setClient] = React.useState<ClientDetail | null>(null);
  const [creditReports, setCreditReports] = React.useState<CreditReport[]>([]);
  const [latestAnalysis, setLatestAnalysis] = React.useState<CreditAnalysisWithRecs | null>(null);
  const [creditAccounts, setCreditAccounts] = React.useState<CreditAccount[]>([]);
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [negativeItemsCount, setNegativeItemsCount] = React.useState(0);
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [showDisputeModal, setShowDisputeModal] = React.useState(false);
  const [selectedNegativeItem, setSelectedNegativeItem] = React.useState<NegativeItem | null>(null);
  
  const [editMode, setEditMode] = React.useState(false);
  const [editedClient, setEditedClient] = React.useState<Partial<ClientDetail>>({});
  
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [selectedBureau, setSelectedBureau] = React.useState('combined');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [reportDate, setReportDate] = React.useState('');

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
      if (reportDate) {
        formData.append('report_date', reportDate);
      }

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
      const response = await fetch(`/api/admin/credit-reports/${reportId}/parse`, {
        method: 'POST',
      });

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
    if (!confirm('Are you sure you want to delete this credit report? This will also delete all associated accounts and negative items.')) {
      return;
    }

    setDeleting(reportId);
    try {
      const response = await fetch(`/api/admin/credit-reports/${reportId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchClientData();
      } else {
        const error = await response.json();
        alert(error.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateDispute = (item: NegativeItem) => {
    setSelectedNegativeItem(item);
    setShowDisputeModal(true);
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

  const formatItemType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 750) return 'text-green-500';
    if (score >= 700) return 'text-lime-500';
    if (score >= 650) return 'text-yellow-500';
    if (score >= 600) return 'text-orange-500';
    return 'text-red-500';
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

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
              className="text-3xl font-serif font-bold text-foreground"
            >
              {client.first_name} {client.last_name}
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 mt-1"
            >
              <StatusBadge status={client.status} variant={getStatusVariant(client.status)} />
              <span className="text-muted-foreground text-sm">Client since {new Date(client.converted_at).toLocaleDateString()}</span>
            </motion.div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchClientData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Report
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Client Info */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Contact Information</CardTitle>
              {!editMode ? (
                <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
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
                      <Input
                        value={editedClient.first_name || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Last Name</label>
                      <Input
                        value={editedClient.last_name || ''}
                        onChange={(e) => setEditedClient({ ...editedClient, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      value={editedClient.email || ''}
                      onChange={(e) => setEditedClient({ ...editedClient, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={editedClient.phone || ''}
                      onChange={(e) => setEditedClient({ ...editedClient, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={editedClient.status || ''}
                      onChange={(e) => setEditedClient({ ...editedClient, status: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={editedClient.notes || ''}
                      onChange={(e) => setEditedClient({ ...editedClient, notes: e.target.value })}
                      className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                    />
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

          {/* Credit Reports */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Credit Reports</CardTitle>
              <CardDescription>{creditReports.length} report(s) uploaded</CardDescription>
            </CardHeader>
            <CardContent>
              {creditReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No credit reports uploaded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {creditReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{report.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {report.bureau?.toUpperCase() || 'Combined'} • {new Date(report.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(report.parse_status === 'pending' || report.parse_status === 'failed') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnalyzeReport(report.id)}
                            disabled={analyzing === report.id || deleting === report.id}
                          >
                            {analyzing === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            <span className="ml-1">Analyze</span>
                          </Button>
                        )}
                        {report.parse_status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnalyzeReport(report.id)}
                            disabled={analyzing === report.id || deleting === report.id}
                          >
                            {analyzing === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            <span className="ml-1">Re-analyze</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deleting === report.id || analyzing === report.id}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          {deleting === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                        <StatusBadge 
                          status={report.parse_status} 
                          variant={report.parse_status === 'completed' ? 'success' : report.parse_status === 'failed' ? 'danger' : 'warning'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* Credit Scores */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
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
                <p className="text-sm text-muted-foreground text-center py-8">
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
                  <CreditCard className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{latestAnalysis.total_accounts}</p>
                  <p className="text-xs text-muted-foreground">Total Accounts</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">{latestAnalysis.utilization_percent || 0}%</p>
                  <p className="text-xs text-muted-foreground">Utilization</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold">{negativeItemsCount}</p>
                  <p className="text-xs text-muted-foreground">Negative Items</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardContent className="p-4 text-center">
                  <TrendingDown className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold">{formatCurrency(latestAnalysis.total_debt)}</p>
                  <p className="text-xs text-muted-foreground">Total Debt</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recommendations */}
          {latestAnalysis?.recommendations && latestAnalysis.recommendations.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Recommendations
                </CardTitle>
                <CardDescription>Action items based on credit analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {latestAnalysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Credit Accounts */}
          {creditAccounts.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Credit Accounts</CardTitle>
                <CardDescription>{creditAccounts.length} tradeline(s) on file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-medium">Creditor</th>
                        <th className="text-left p-2 font-medium">Type</th>
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
                            {account.account_number && (
                              <p className="text-xs text-muted-foreground">****{account.account_number.slice(-4)}</p>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground capitalize">
                            {account.account_type?.replace('_', ' ') || '—'}
                          </td>
                          <td className="p-2 text-right">
                            {account.balance ? formatCurrency(account.balance) : '—'}
                          </td>
                          <td className="p-2 text-right">
                            {account.credit_limit ? formatCurrency(account.credit_limit) : '—'}
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              account.payment_status === 'current' ? 'bg-green-500/10 text-green-500' :
                              account.is_negative ? 'bg-red-500/10 text-red-500' :
                              'bg-muted text-muted-foreground'
                            }`}>
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

          {/* Negative Items */}
          {negativeItems.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Negative Items
                </CardTitle>
                <CardDescription>{negativeItems.length} item(s) affecting your credit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {negativeItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskSeverityColor(item.risk_severity)}`}>
                              {item.risk_severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatItemType(item.item_type)}
                            </span>
                          </div>
                          <p className="font-medium">{item.creditor_name}</p>
                          {item.original_creditor && (
                            <p className="text-xs text-muted-foreground">Original: {item.original_creditor}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {item.amount && (
                              <span>Amount: {formatCurrency(item.amount)}</span>
                            )}
                            {item.bureau && (
                              <span>{item.bureau.toUpperCase()}</span>
                            )}
                            {item.date_reported && (
                              <span>Reported: {new Date(item.date_reported).toLocaleDateString()}</span>
                            )}
                          </div>
                          {item.recommended_action && (
                            <p className="text-xs mt-2 text-secondary">
                              Recommended: {item.recommended_action.replace('_', ' ')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateDispute(item)}
                        >
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

          {/* Disputes */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Disputes</CardTitle>
                <CardDescription>{disputes.length} dispute(s)</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDisputeModal(true)}
                disabled={negativeItems.length === 0}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Dispute
              </Button>
            </CardHeader>
            <CardContent>
              {disputes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No disputes created yet. Analyze a credit report to identify items to dispute.
                </p>
              ) : (
                <div className="space-y-3">
                  {disputes.map((dispute) => (
                    <div
                      key={dispute.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">{dispute.dispute_reason}</p>
                        <p className="text-xs text-muted-foreground">
                          {dispute.bureau.toUpperCase()} • Round {dispute.round} • {dispute.dispute_type}
                        </p>
                      </div>
                      <StatusBadge 
                        status={dispute.status} 
                        variant={getStatusVariant(dispute.status)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload Modal */}
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
                <CardTitle>Upload Credit Report</CardTitle>
                <CardDescription>Upload a PDF or HTML credit report file.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Bureau</label>
                  <select
                    value={selectedBureau}
                    onChange={(e) => setSelectedBureau(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {bureauOptions.map((b) => (
                      <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Report Date (Optional)</label>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
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
                        <p className="text-sm text-muted-foreground">
                          Click to select a file or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, HTML, or TXT (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.html,.htm,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={handleUpload} 
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Dispute Creation Modal */}
      {showDisputeModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setShowDisputeModal(false);
            setSelectedNegativeItem(null);
          }}
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
                <CardTitle>Create Dispute</CardTitle>
                <CardDescription>
                  {selectedNegativeItem 
                    ? `Dispute "${selectedNegativeItem.creditor_name}" - ${formatItemType(selectedNegativeItem.item_type)}`
                    : 'Select a negative item to dispute'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedNegativeItem ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Negative Item</label>
                    {negativeItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedNegativeItem(item)}
                        className="p-3 rounded-lg border border-border hover:border-secondary cursor-pointer transition-colors"
                      >
                        <p className="font-medium">{item.creditor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatItemType(item.item_type)} • {item.bureau?.toUpperCase()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium">{selectedNegativeItem.creditor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatItemType(selectedNegativeItem.item_type)} • {selectedNegativeItem.bureau?.toUpperCase()}
                        {selectedNegativeItem.amount && ` • ${formatCurrency(selectedNegativeItem.amount)}`}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Bureau to Dispute</label>
                      <select
                        defaultValue={selectedNegativeItem.bureau || 'transunion'}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                      >
                        <option value="transunion">TransUnion</option>
                        <option value="experian">Experian</option>
                        <option value="equifax">Equifax</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Dispute Reason</label>
                      <textarea
                        defaultValue={selectedNegativeItem.dispute_reason || `This ${formatItemType(selectedNegativeItem.item_type).toLowerCase()} is inaccurate and should be removed.`}
                        className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background mt-1"
                        placeholder="Explain why this item is inaccurate..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Dispute Type</label>
                      <select
                        defaultValue="standard"
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                      >
                        <option value="standard">Standard Dispute</option>
                        <option value="method_of_verification">Method of Verification</option>
                        <option value="direct_creditor">Direct to Creditor</option>
                        <option value="goodwill">Goodwill Letter</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => {
                      setShowDisputeModal(false);
                      setSelectedNegativeItem(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1" 
                    disabled={!selectedNegativeItem}
                    onClick={() => {
                      alert('Dispute creation will be implemented with full letter generation');
                      setShowDisputeModal(false);
                      setSelectedNegativeItem(null);
                    }}
                  >
                    Create Dispute
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

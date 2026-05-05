'use client';

import * as React from 'react';
import {
  FileText,
  Upload,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import type { CreditReport, CreditAccount } from './types';
import { appearsOnBureau } from './types';
import { formatCurrency } from '@/lib/format';

interface ReportsTabProps {
  clientId: string;
  creditReports: CreditReport[];
  creditAccounts: CreditAccount[];
  onDataChanged: () => void;
  onOpenUploadModal: () => void;
}

export function ReportsTab({
  creditReports,
  creditAccounts,
  onDataChanged,
  onOpenUploadModal,
}: ReportsTabProps) {
  const [analyzing, setAnalyzing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [pendingDeleteReportId, setPendingDeleteReportId] = React.useState<string | null>(null);

  const handleAnalyzeReport = async (reportId: string) => {
    setAnalyzing(reportId);
    try {
      const response = await fetch(`/api/admin/credit-reports/${reportId}/parse`, { method: 'POST' });
      if (response.ok) {
        onDataChanged();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing report:', error);
      toast.error('Analysis failed');
    } finally {
      setAnalyzing(null);
    }
  };

  const confirmDeleteReport = async () => {
    if (!pendingDeleteReportId) return;
    setDeleting(pendingDeleteReportId);
    try {
      const response = await fetch(`/api/admin/credit-reports/${pendingDeleteReportId}`, { method: 'DELETE' });
      if (response.ok) onDataChanged();
    } catch (error) {
      console.error('Error deleting report:', error);
    } finally {
      setDeleting(null);
      setPendingDeleteReportId(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Credit Reports</CardTitle>
            <CardDescription>{creditReports.length} report(s) uploaded</CardDescription>
          </CardHeader>
          <CardContent>
            {creditReports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No credit reports uploaded yet.</p>
                <Button className="mt-4" onClick={onOpenUploadModal}>
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
                      <Button variant="outline" size="sm" onClick={() => setPendingDeleteReportId(report.id)} disabled={deleting === report.id || analyzing === report.id} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-200">
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

        {creditAccounts.length > 0 && (
          <Card className="bg-card border border-border">
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
                          <div className="flex items-center gap-1">
                            {['transunion', 'experian', 'equifax'].map((bureau) => {
                              const onBureau = appearsOnBureau(account, bureau);
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

      <ConfirmDialog
        open={pendingDeleteReportId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteReportId(null); }}
        title="Delete Credit Report"
        description="Delete this credit report and all associated data?"
        confirmLabel="Delete"
        onConfirm={confirmDeleteReport}
        variant="danger"
      />
    </>
  );
}

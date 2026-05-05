export interface ClientDetail {
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

export interface CreditReport {
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

export interface CreditAnalysis {
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

export interface Dispute {
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

export interface CreditAccount {
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

export interface NegativeItem {
  id: string;
  item_type: string;
  creditor_name: string;
  original_creditor: string | null;
  amount: number | null;
  date_reported: string | null;
  bureau: string | null;
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

export interface ClientNote {
  id: string;
  client_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_at: string;
}

export interface ScoreHistory {
  id: string;
  score_transunion: number | null;
  score_experian: number | null;
  score_equifax: number | null;
  average_score: number | null;
  source: string;
  notes: string | null;
  recorded_at: string;
}

export interface ClientReadiness {
  has_portal_user: boolean;
  has_signed_agreement: boolean;
  has_credit_report: boolean;
  has_analyzed_report: boolean;
  has_case: boolean;
  has_disputes: boolean;
  unfinished_client_tasks: number;
  blocking_tasks: number;
  is_ready_for_round: boolean;
  at_risk?: boolean;
  waiting_on_client_days?: number | null;
}

export type ClientDisputeStatus =
  | 'not_started'
  | 'waiting_on_client'
  | 'with_bureaus'
  | 'analyzing_results'
  | 'completed';

export const DISPUTE_STATUS_LABELS: Record<ClientDisputeStatus, string> = {
  not_started: 'Not started',
  waiting_on_client: 'Waiting on client',
  with_bureaus: 'With bureaus',
  analyzing_results: 'Analyzing results',
  completed: 'Completed',
};

export const DISPUTE_STATUS_CLASSES: Record<ClientDisputeStatus, string> = {
  not_started: 'bg-muted text-muted-foreground border-border',
  waiting_on_client: 'bg-amber-500/10 text-amber-500 border-amber-500/40',
  with_bureaus: 'bg-blue-500/10 text-blue-500 border-blue-500/40',
  analyzing_results: 'bg-purple-500/10 text-purple-500 border-purple-500/40',
  completed: 'bg-green-500/10 text-green-500 border-green-500/40',
};

export function appearsOnBureau(
  item: { bureau: string | null; on_transunion?: boolean; on_experian?: boolean; on_equifax?: boolean; bureaus?: string[] },
  bureau: string,
): boolean {
  const bureauLower = bureau.toLowerCase();
  if (bureauLower === 'transunion' && item.on_transunion !== undefined) return item.on_transunion;
  if (bureauLower === 'experian' && item.on_experian !== undefined) return item.on_experian;
  if (bureauLower === 'equifax' && item.on_equifax !== undefined) return item.on_equifax;
  if (item.bureaus && item.bureaus.length > 0) return item.bureaus.includes(bureauLower);
  if (!item.bureau || item.bureau === 'combined') return true;
  return item.bureau.toLowerCase() === bureauLower;
}

export function deriveDisputeStatus(
  disputes: Dispute[],
  readiness: ClientReadiness | null,
): ClientDisputeStatus {
  if (!disputes || disputes.length === 0) {
    return readiness && !readiness.is_ready_for_round ? 'waiting_on_client' : 'not_started';
  }
  const sentOrInProgress = disputes.filter((d) => ['sent', 'in_progress'].includes(d.status));
  const unresolvedSent = sentOrInProgress.filter((d) => !d.outcome);
  if (unresolvedSent.length > 0) return 'with_bureaus';
  const resolved = disputes.filter((d) => d.status === 'resolved' || ['deleted', 'verified', 'updated'].includes(d.outcome ?? ''));
  if (resolved.length > 0 && (!readiness || !readiness.is_ready_for_round)) return 'analyzing_results';
  if (resolved.length > 0) return 'completed';
  return readiness && !readiness.is_ready_for_round ? 'waiting_on_client' : 'not_started';
}

export function getScoreColor(score: number | null) {
  if (!score) return 'text-muted-foreground';
  if (score >= 750) return 'text-green-500';
  if (score >= 700) return 'text-lime-500';
  if (score >= 650) return 'text-yellow-500';
  if (score >= 600) return 'text-orange-500';
  return 'text-red-500';
}

export function getRiskSeverityColor(severity: string) {
  switch (severity) {
    case 'severe': return 'text-red-500 bg-red-500/10';
    case 'high': return 'text-orange-500 bg-orange-500/10';
    case 'medium': return 'text-yellow-500 bg-yellow-500/10';
    case 'low': return 'text-green-500 bg-green-500/10';
    default: return 'text-muted-foreground bg-muted';
  }
}

export function isTaskOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === 'done') return false;
  return new Date(dueDate) < new Date();
}

export const statusOptions = ['pending', 'active', 'paused', 'completed', 'cancelled'];
export const bureauOptions = ['transunion', 'experian', 'equifax', 'combined'];

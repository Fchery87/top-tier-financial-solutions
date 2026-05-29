export interface AuditReportStatus {
  has_report: boolean;
  client_name?: string;
  report_date?: string;
  scores?: {
    transunion: number | null;
    experian: number | null;
    equifax: number | null;
  } | null;
}

export interface CaseUpdate {
  id: string;
  title: string;
  description: string | null;
  update_type: string;
  created_at: string;
}

export interface ClientCase {
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

export interface Document {
  id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface PortalDispute {
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

export interface DisputeStats {
  total: number;
  in_progress: number;
  deleted: number;
  awaiting: number;
}

export interface ScoreHistoryEntry {
  id: string;
  score_transunion: number | null;
  score_experian: number | null;
  score_equifax: number | null;
  average_score: number | null;
  recorded_at: string;
}

export interface ScoreSummary {
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

export interface PortalTask {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  is_blocking: boolean;
  created_at: string | null;
}

export interface LetterForApproval {
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

export interface PortalFeedbackEntry {
  id: string;
  context: string;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
}

export const phaseLabels: Record<string, string> = {
  initial_review: 'Initial Review',
  dispute_preparation: 'Dispute Preparation',
  disputes_sent: 'Disputes Sent',
  awaiting_response: 'Awaiting Response',
  follow_up: 'Follow Up',
  completed: 'Completed',
};

export const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/25',
  active: 'bg-secondary/10 text-secondary border-secondary/25',
  in_review: 'bg-secondary/10 text-secondary border-secondary/25',
  completed: 'bg-success/10 text-success border-success/25',
  closed: 'bg-muted text-muted-foreground border-border',
};

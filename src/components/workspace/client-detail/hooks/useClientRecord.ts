'use client';

import * as React from 'react';
import { z } from 'zod';
import type {
  ClientDetail,
  ClientReadiness,
  ClientNote,
  CreditAccount,
  CreditAnalysis,
  CreditReport,
  Dispute,
  NegativeItem,
  ScoreHistory,
  Task,
} from '../types';

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const optionalNullableString = z.string().nullable().optional();
const bureauFlags = {
  bureaus: z.array(z.string()).optional(),
  on_transunion: z.boolean().optional(),
  on_experian: z.boolean().optional(),
  on_equifax: z.boolean().optional(),
};

const clientSchema: z.ZodType<ClientDetail> = z.object({
  id: z.string(),
  user_id: nullableString,
  lead_id: nullableString,
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  phone: nullableString,
  status: z.string(),
  notes: nullableString,
  converted_at: nullableString,
  created_at: z.string(),
  user_name: nullableString,
});

const readinessSchema: z.ZodType<ClientReadiness> = z.object({
  has_portal_user: z.boolean(),
  has_signed_agreement: z.boolean(),
  has_credit_report: z.boolean(),
  has_analyzed_report: z.boolean(),
  has_case: z.boolean(),
  has_disputes: z.boolean(),
  unfinished_client_tasks: z.number().int().nonnegative(),
  blocking_tasks: z.number().int().nonnegative(),
  is_ready_for_round: z.boolean(),
  at_risk: z.boolean().optional(),
  waiting_on_client_days: z.number().int().nonnegative().nullable().optional(),
});

const creditReportSchema: z.ZodType<CreditReport> = z.object({
  id: z.string(),
  file_name: z.string(),
  file_type: z.string(),
  file_url: z.string(),
  file_size: z.number(),
  bureau: nullableString,
  report_date: nullableString,
  parse_status: z.string(),
  parser_review_status: optionalNullableString,
  uploaded_at: z.string(),
});

const creditAnalysisSchema: z.ZodType<CreditAnalysis> = z.object({
  id: z.string(),
  score_transunion: nullableNumber,
  score_experian: nullableNumber,
  score_equifax: nullableNumber,
  total_accounts: z.number(),
  open_accounts: z.number(),
  closed_accounts: z.number(),
  total_debt: z.number(),
  total_credit_limit: z.number(),
  utilization_percent: nullableNumber,
  derogatory_count: z.number(),
  collections_count: z.number(),
  late_payment_count: z.number(),
  inquiry_count: z.number(),
  created_at: z.string(),
  recommendations: z.array(z.string()).optional(),
});

const creditAccountSchema: z.ZodType<CreditAccount> = z.object({
  id: z.string(),
  creditor_name: z.string(),
  account_number: nullableString,
  account_type: nullableString,
  account_status: nullableString,
  balance: nullableNumber,
  credit_limit: nullableNumber,
  payment_status: nullableString,
  payment_history_grid: z.record(z.string(), z.record(z.string(), z.string())).nullable().optional(),
  date_opened: nullableString,
  bureau: nullableString,
  ...bureauFlags,
  transunion_date: optionalNullableString,
  experian_date: optionalNullableString,
  equifax_date: optionalNullableString,
  transunion_balance: nullableNumber.optional(),
  experian_balance: nullableNumber.optional(),
  equifax_balance: nullableNumber.optional(),
  is_negative: z.boolean(),
  risk_level: nullableString,
});

const negativeItemSchema: z.ZodType<NegativeItem> = z.object({
  id: z.string(),
  item_type: z.string(),
  creditor_name: z.string(),
  original_creditor: nullableString,
  amount: nullableNumber,
  date_reported: nullableString,
  bureau: nullableString,
  ...bureauFlags,
  transunion_date: optionalNullableString,
  experian_date: optionalNullableString,
  equifax_date: optionalNullableString,
  transunion_status: optionalNullableString,
  experian_status: optionalNullableString,
  equifax_status: optionalNullableString,
  risk_severity: z.string(),
  recommended_action: nullableString,
  dispute_reason: nullableString,
});

const disputeSchema: z.ZodType<Dispute> = z.object({
  id: z.string(),
  bureau: z.string(),
  dispute_reason: z.string(),
  dispute_type: z.string(),
  status: z.string(),
  round: z.number().int(),
  sent_at: nullableString,
  outcome: nullableString,
  created_at: z.string(),
});

const scoreHistorySchema: z.ZodType<ScoreHistory> = z.object({
  id: z.string(),
  score_transunion: nullableNumber,
  score_experian: nullableNumber,
  score_equifax: nullableNumber,
  average_score: nullableNumber,
  source: z.string(),
  notes: nullableString,
  recorded_at: z.string(),
});

const clientNoteSchema: z.ZodType<ClientNote> = z.object({
  id: z.string(),
  client_id: z.string(),
  author_id: nullableString,
  author_name: nullableString,
  content: z.string(),
  created_at: z.string(),
});

const taskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  client_id: nullableString,
  title: z.string(),
  description: nullableString,
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_date: nullableString,
  created_at: z.string(),
});

const clientSnapshotSchema = z.object({
  client: clientSchema,
  readiness: readinessSchema.nullable(),
  credit_reports: z.array(creditReportSchema),
  latest_analysis: creditAnalysisSchema.nullable(),
  credit_accounts: z.array(creditAccountSchema),
  negative_items: z.array(negativeItemSchema),
  negative_items_count: z.number().int().nonnegative(),
  disputes: z.array(disputeSchema),
  score_history: z.array(scoreHistorySchema),
});

const notesResponseSchema = z.object({ items: z.array(clientNoteSchema) });
const tasksResponseSchema = z.object({ items: z.array(taskSchema) });

export interface ClientRecordData {
  client: ClientDetail | null;
  creditReports: CreditReport[];
  latestAnalysis: CreditAnalysis | null;
  creditAccounts: CreditAccount[];
  negativeItems: NegativeItem[];
  negativeItemsCount: number;
  disputes: Dispute[];
  scoreHistory: ScoreHistory[];
  readiness: ClientReadiness | null;
  clientNotes: ClientNote[];
  clientTasks: Task[];
}

const initialData: ClientRecordData = {
  client: null,
  creditReports: [],
  latestAnalysis: null,
  creditAccounts: [],
  negativeItems: [],
  negativeItemsCount: 0,
  disputes: [],
  scoreHistory: [],
  readiness: null,
  clientNotes: [],
  clientTasks: [],
};

function toData(snapshot: z.infer<typeof clientSnapshotSchema>): ClientRecordData {
  return {
    client: snapshot.client,
    creditReports: snapshot.credit_reports,
    latestAnalysis: snapshot.latest_analysis,
    creditAccounts: snapshot.credit_accounts,
    negativeItems: snapshot.negative_items,
    negativeItemsCount: snapshot.negative_items_count,
    disputes: snapshot.disputes,
    scoreHistory: snapshot.score_history,
    readiness: snapshot.readiness,
    clientNotes: [],
    clientTasks: [],
  };
}

export function useClientRecord(clientId: string) {
  const [data, setData] = React.useState<ClientRecordData>(initialData);
  const [loading, setLoading] = React.useState(Boolean(clientId));
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const requestController = React.useRef<AbortController | null>(null);

  const cancelRequest = React.useCallback(() => {
    requestController.current?.abort();
    requestController.current = null;
  }, []);

  const refresh = React.useCallback(async () => {
    cancelRequest();

    if (!clientId) {
      setData(initialData);
      setLoading(false);
      setError(null);
      setNotFound(false);
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const [clientResult, notesResult, tasksResult] = await Promise.allSettled([
        fetch(`/api/workspace/clients/${clientId}`, { signal: controller.signal }),
        fetch(`/api/workspace/notes?client_id=${clientId}&limit=50`, { signal: controller.signal }),
        fetch(`/api/workspace/tasks?client_id=${clientId}&limit=50`, { signal: controller.signal }),
      ]);

      if (clientResult.status === 'rejected') {
        throw clientResult.reason;
      }

      const clientResponse = clientResult.value;

      if (clientResponse.status === 404) {
        if (!controller.signal.aborted) {
          setData(initialData);
          setNotFound(true);
        }
        return;
      }
      if (!clientResponse.ok) {
        throw new Error('Failed to load client record');
      }

      const snapshotResult = clientSnapshotSchema.safeParse(await clientResponse.json());
      if (!snapshotResult.success) {
        throw new Error('Invalid client record response');
      }

      const nextData = toData(snapshotResult.data);
      if (notesResult.status === 'fulfilled' && notesResult.value.ok) {
        const parsedNotes = notesResponseSchema.safeParse(await notesResult.value.json());
        if (parsedNotes.success) nextData.clientNotes = parsedNotes.data.items;
      }
      if (tasksResult.status === 'fulfilled' && tasksResult.value.ok) {
        const parsedTasks = tasksResponseSchema.safeParse(await tasksResult.value.json());
        if (parsedTasks.success) nextData.clientTasks = parsedTasks.data.items;
      }

      if (!controller.signal.aborted) {
        setData(nextData);
      }
    } catch (caught: unknown) {
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Failed to load client record');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [cancelRequest, clientId]);

  React.useEffect(() => {
    void refresh();
    return cancelRequest;
  }, [cancelRequest, refresh]);

  return { ...data, loading, error, notFound, refresh };
}

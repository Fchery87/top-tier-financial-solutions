import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { clientDocuments, clients, evidencePackets } from '@/db/schema';
import { buildLetterGenerationPayload } from '@/components/workspace/dispute-wizard/services/buildLetterGenerationPayload';
import type { LetterGenerationBuilderInput } from '@/components/workspace/dispute-wizard/types/letter-generation';
import type { InquiryItem, NegativeItem } from '@/components/workspace/dispute-wizard/types';

// Repro: the wizard cannot produce a high-risk letter. The server must derive
// each item's claim confirmation from evidence_packets rows, never from the body.

type Row = Record<string, unknown>;

interface FakeDb {
  select: (...args: unknown[]) => { from: (table: unknown) => unknown };
  update: (table: unknown) => { set: (values: Row) => unknown };
  insert: (table: unknown) => { values: (values: Row) => unknown };
  transaction: (callback: (tx: FakeDb) => Promise<unknown>) => Promise<unknown>;
}

const holder = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const generateMultiItemDisputeLetterMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: {
    select: (...args: unknown[]) => holder.db.select(...args),
    update: (table: unknown) => holder.db.update(table),
    insert: (table: unknown) => holder.db.insert(table),
    transaction: (callback: (tx: FakeDb) => Promise<unknown>) => holder.db.transaction(callback),
  },
}));
vi.mock('@/lib/admin-session', () => ({
  requireCapability: vi.fn().mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' }),
}));
vi.mock('@/lib/ai-letter-generator', () => ({
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
  generateMultiItemDisputeLetter: generateMultiItemDisputeLetterMock,
  DISPUTE_REASON_CODES: [],
}));
vi.mock('@/lib/letter-generation-library', () => ({
  selectLibraryForGeneration: vi.fn().mockResolvedValue({ chosen: null, score: 0, rationale: [], runnersUp: [] }),
}));
vi.mock('@/lib/parser-review-gate', () => ({
  requireLatestApprovedReportForClient: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/db-encryption', () => ({
  DECRYPTION_FAILED: '[decryption-failed]',
  decryptDisputeData: (data: unknown) => data,
  decryptClientData: (data: unknown) => data,
}));

/**
 * An in-memory db keyed by table. `where` filters are not evaluated, so every
 * row of a table is returned; the routes must still match rows by client and
 * item themselves. Writes are recorded.
 */
function createFakeDb(tables: Map<unknown, Row[]>) {
  const updates: { table: unknown; values: Row }[] = [];
  const inserts: { table: unknown; values: Row }[] = [];

  function chain<T>(result: () => T) {
    const query: Record<string, unknown> = {};
    for (const method of ['where', 'limit', 'orderBy', 'innerJoin', 'leftJoin', 'onConflictDoNothing', 'onConflictDoUpdate']) {
      query[method] = () => query;
    }
    query.returning = () => Promise.resolve(result());
    query.then = (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return query;
  }

  const db: FakeDb = {
    select: () => ({ from: (table: unknown) => chain(() => tables.get(table) ?? []) }),
    update: (table: unknown) => ({
      set: (values: Row) => {
        updates.push({ table, values });
        return chain(() => []);
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Row) => {
        inserts.push({ table, values });
        return chain(() => [values]);
      },
    }),
    transaction: async (callback) => callback(db),
  };

  return { db, updates, inserts };
}

const CLIENT_ROW = {
  id: 'client-1',
  userId: 'user-1',
  firstName: 'Jane',
  lastName: 'Sample',
  streetAddress: '100 Main St',
  city: 'Albany',
  state: 'NY',
  zipCode: '12207',
};

const tradeline: NegativeItem = {
  id: 'neg-1',
  creditor_name: 'Bank One',
  original_creditor: null,
  account_number: '1234',
  item_type: 'collection',
  amount: 500,
  date_reported: '2026-01-01',
  bureau: 'experian',
  bureaus: ['experian'],
  on_transunion: false,
  on_experian: true,
  on_equifax: false,
  risk_severity: 'high',
  recommended_action: 'dispute',
};

const secondTradeline: NegativeItem = { ...tradeline, id: 'neg-2', creditor_name: 'Card Co', account_number: '9876' };

const inquiry: InquiryItem = {
  id: 'inq-1',
  creditor_name: 'Inquiry Bank',
  bureau: 'experian',
  inquiry_date: '2026-03-01',
  inquiry_type: 'hard',
  is_past_fcra_limit: false,
  days_since_inquiry: 120,
};

function wizardInput(overrides: Partial<LetterGenerationBuilderInput> = {}): LetterGenerationBuilderInput {
  return {
    selectedClientId: 'client-1',
    negativeItems: [tradeline, secondTradeline],
    selectedItems: [],
    personalInfoItems: [],
    selectedPersonalItems: [],
    inquiryItems: [inquiry],
    selectedInquiryItems: [],
    generationMethod: 'ai',
    selectedReasonCodes: [],
    effectiveAnalyses: [],
    effectiveSummary: null,
    selectedMethodology: 'factual',
    selectedBureaus: ['experian'],
    targetRecipient: 'bureau',
    selectedDisputeType: 'standard',
    disputeRound: 1,
    customReason: '',
    combineItemsPerBureau: false,
    selectedEvidenceIds: [],
    requestManualReview: false,
    getInstructionText: () => 'This account does not belong to me.',
    hasItemInstruction: () => true,
    getItemReasonCode: () => 'not_mine',
    itemAppearsOnBureau: (item: NegativeItem, bureau: string) => (item.bureaus || []).includes(bureau),
    ...overrides,
  };
}

/** The body the wizard sends for an AI-mode letter about one inquiry. */
function inquiryRequestBody() {
  const plan = buildLetterGenerationPayload(wizardInput({ selectedInquiryItems: ['inq-1'] }));
  expect(plan.requests).toHaveLength(1);
  expect(plan.requests[0].body.reasonCodes).toContain('unauthorized_inquiry');
  return plan.requests[0].body;
}

/** The body the wizard sends for a template-mode `not_mine` letter about one tradeline. */
function notMineRequestBody(itemId = 'neg-1') {
  const plan = buildLetterGenerationPayload(wizardInput({ generationMethod: 'template', selectedItems: [itemId] }));
  expect(plan.requests).toHaveLength(1);
  expect(plan.requests[0].body.reasonCodes).toEqual(['not_mine']);
  return plan.requests[0].body;
}

const PORTAL_CONFIRMATION = {
  key: 'client_factual_claim_confirmed',
  confirmed: true,
  source: 'portal',
  text: 'I did not apply for this.',
  confirmed_at: '2026-10-01T00:00:00.000Z',
};

function packet(overrides: Row & { itemKind: string; itemId: string; claimType: string }): Row {
  return {
    id: `packet-${overrides.itemId}-${overrides.claimType}`,
    clientId: 'client-1',
    disputeId: null,
    documentIds: JSON.stringify(['doc-1']),
    confirmations: JSON.stringify([]),
    createdById: 'staff-1',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

const confirmed = (row: Row & { itemKind: string; itemId: string; claimType: string }) => packet({ ...row, confirmations: JSON.stringify([PORTAL_CONFIRMATION]) });

let fake: ReturnType<typeof createFakeDb>;

function seed(packets: Row[], documents: Row[] = []) {
  fake = createFakeDb(new Map<unknown, Row[]>([
    [clients, [CLIENT_ROW]],
    [evidencePackets, packets],
    [clientDocuments, documents],
  ]));
  holder.db = fake.db;
}

async function postGenerateLetter(body: unknown) {
  const { POST } = await import('@/app/api/workspace/disputes/generate-letter/route');
  const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/generate-letter', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

function expectNothingGenerated() {
  expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  expect(generateMultiItemDisputeLetterMock).not.toHaveBeenCalled();
  expect(fake.inserts).toEqual([]);
}

function packetLinks() {
  return fake.updates.filter(update => update.table === evidencePackets).map(update => update.values.disputeId);
}

describe('high-risk claims are gated by the client confirmation stored in evidence_packets', () => {
  beforeEach(() => {
    generateUniqueDisputeLetterMock.mockReset().mockResolvedValue({ letter: 'Generated single-item letter', source: 'ai' });
    generateMultiItemDisputeLetterMock.mockReset().mockResolvedValue({ letter: 'Generated combined letter', source: 'ai' });
  });

  describe('unauthorized_inquiry on an inquiry (AI mode wizard payload)', () => {
    it('refuses with 409 no_packet when the item has no packet', async () => {
      // Another client's confirmed packet for the same item id must not count.
      seed([confirmed({ itemKind: 'inquiry', itemId: 'inq-1', claimType: 'unauthorized_inquiry', clientId: 'client-2' })]);

      const result = await postGenerateLetter(inquiryRequestBody());

      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ code: 'HIGH_RISK_CONFIRMATION_REQUIRED' });
      expect(result.body.items).toEqual([{ itemId: 'inq-1', itemKind: 'inquiry', claimType: 'unauthorized_inquiry', state: 'no_packet' }]);
      expectNothingGenerated();
    }, 30000);

    it('refuses with 409 awaiting_client_confirmation while the client has not confirmed', async () => {
      seed([packet({ itemKind: 'inquiry', itemId: 'inq-1', claimType: 'unauthorized_inquiry' })]);

      const result = await postGenerateLetter(inquiryRequestBody());

      expect(result.status).toBe(409);
      expect(result.body.items).toEqual([{ itemId: 'inq-1', itemKind: 'inquiry', claimType: 'unauthorized_inquiry', state: 'awaiting_client_confirmation' }]);
      expectNothingGenerated();
    }, 30000);

    it('generates with a complete packet and links the packet to the new dispute', async () => {
      seed([confirmed({ itemKind: 'inquiry', itemId: 'inq-1', claimType: 'unauthorized_inquiry' })]);

      const result = await postGenerateLetter(inquiryRequestBody());

      expect({ status: result.status, error: result.body.error }).toEqual({ status: 200, error: undefined });
      expect(typeof result.body.dispute_id).toBe('string');
      expect(packetLinks()).toEqual([result.body.dispute_id]);
    }, 30000);

    it('ignores clientConfirmedOwnershipClaims in the body', async () => {
      seed([packet({ itemKind: 'inquiry', itemId: 'inq-1', claimType: 'unauthorized_inquiry' })]);

      const result = await postGenerateLetter({ ...inquiryRequestBody(), clientConfirmedOwnershipClaims: true });

      expect(result.status).toBe(409);
      expect(result.body.items).toEqual([{ itemId: 'inq-1', itemKind: 'inquiry', claimType: 'unauthorized_inquiry', state: 'awaiting_client_confirmation' }]);
      expectNothingGenerated();
    }, 30000);
  });

  describe('not_mine on a tradeline (template mode wizard payload)', () => {
    it('refuses with 409 no_packet when the item has no packet', async () => {
      // A complete packet for a different claim on the same item does not count.
      seed([confirmed({ itemKind: 'tradeline', itemId: 'neg-1', claimType: 'never_late' })]);

      const result = await postGenerateLetter(notMineRequestBody());

      expect(result.status).toBe(409);
      expect(result.body.items).toEqual([{ itemId: 'neg-1', itemKind: 'tradeline', claimType: 'not_mine', state: 'no_packet' }]);
      expectNothingGenerated();
    }, 30000);

    it('refuses with 409 awaiting_client_confirmation while the client has not confirmed', async () => {
      seed([packet({ itemKind: 'tradeline', itemId: 'neg-1', claimType: 'not_mine' })]);

      const result = await postGenerateLetter(notMineRequestBody());

      expect(result.status).toBe(409);
      expect(result.body.items).toEqual([{ itemId: 'neg-1', itemKind: 'tradeline', claimType: 'not_mine', state: 'awaiting_client_confirmation' }]);
      expectNothingGenerated();
    }, 30000);

    it('generates with a complete packet and links the packet to the new dispute', async () => {
      seed([confirmed({ itemKind: 'tradeline', itemId: 'neg-1', claimType: 'not_mine' })]);

      const result = await postGenerateLetter(notMineRequestBody());

      expect({ status: result.status, error: result.body.error }).toEqual({ status: 200, error: undefined });
      expect(packetLinks()).toEqual([result.body.dispute_id]);
    }, 30000);

    it('ignores clientConfirmedOwnershipClaims in the body', async () => {
      seed([]);

      const result = await postGenerateLetter({ ...notMineRequestBody(), clientConfirmedOwnershipClaims: true });

      expect(result.status).toBe(409);
      expect(result.body.items).toEqual([{ itemId: 'neg-1', itemKind: 'tradeline', claimType: 'not_mine', state: 'no_packet' }]);
      expectNothingGenerated();
    }, 30000);

    it('refuses a multi-item letter when one of its high-risk items is not confirmed', async () => {
      seed([confirmed({ itemKind: 'tradeline', itemId: 'neg-1', claimType: 'not_mine' })]);
      const first = notMineRequestBody('neg-1');
      const second = notMineRequestBody('neg-2');

      const result = await postGenerateLetter({
        ...first,
        combineItems: true,
        disputeItems: [...first.disputeItems, ...second.disputeItems],
      });

      expect(result.status).toBe(409);
      expect(result.body.items).toEqual([{ itemId: 'neg-2', itemKind: 'tradeline', claimType: 'not_mine', state: 'no_packet' }]);
      expectNothingGenerated();
    }, 30000);
  });

  describe('enclosures', () => {
    it('refuses evidence documents that belong to another client', async () => {
      seed([], [{ id: 'doc-foreign', userId: 'user-2', fileUrl: 'client-documents/user-2/evidence/id.pdf', fileType: 'id_document', fileName: 'id.pdf' }]);
      const plan = buildLetterGenerationPayload(wizardInput({
        generationMethod: 'template',
        selectedItems: ['neg-1'],
        getItemReasonCode: () => 'inaccurate_reporting',
        selectedEvidenceIds: ['doc-foreign'],
      }));

      const result = await postGenerateLetter(plan.requests[0].body);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe('Evidence documents must belong to the client');
      expectNothingGenerated();
    }, 30000);
  });
});

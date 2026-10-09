import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Repro: letter routes printed encrypted client names and no address. The
// route must decrypt the consumer identity, render it into the letter by code,
// and never send the address, date of birth or SSN to the provider.

const dbMock = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
const txMock = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), update: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const requireLatestApprovedReportForClientMock = vi.hoisted(() => vi.fn());
const selectLibraryForGenerationMock = vi.hoisted(() => vi.fn());
const getLLMConfigMock = vi.hoisted(() => vi.fn());
const generateLetterDraftMock = vi.hoisted(() => vi.fn());
const decryptClientDataMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/parser-review-gate', () => ({ requireLatestApprovedReportForClient: requireLatestApprovedReportForClientMock }));
vi.mock('@/lib/letter-generation-library', () => ({ selectLibraryForGeneration: selectLibraryForGenerationMock }));
vi.mock('@/lib/settings-service', () => ({ getLLMConfig: getLLMConfigMock }));
vi.mock('@/lib/letter-rendering/provider-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/letter-rendering/provider-adapter')>()),
  generateLetterDraft: generateLetterDraftMock,
}));
vi.mock('@/lib/db-encryption', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db-encryption')>()),
  decryptClientData: decryptClientDataMock,
}));

const ENCRYPTED_CLIENT = {
  id: 'client-1',
  firstName: 'v1:enc:Jane',
  lastName: 'v1:enc:Sample',
  streetAddress: 'v1:enc:100 Main St',
  city: 'v1:enc:Albany',
  state: 'v1:enc:NY',
  zipCode: 'v1:enc:12207',
  dateOfBirth: 'v1:enc:1985-03-07',
  ssnLast4: 'v1:enc:4321',
};

const MODEL_DRAFT = [
  'Jane Sample',
  'October 8, 2026',
  '',
  'Experian',
  'P.O. Box 4500',
  'Allen, TX 75013',
  '',
  'Re: Request for Investigation',
  '',
  'To Whom It May Concern:',
  '',
  'I am writing to request a reasonable investigation of the Example Bank account under the Fair Credit Reporting Act.',
  '',
  'Please verify the reported information and correct or delete anything that cannot be verified.',
  '',
  'Sincerely,',
  'Jane Sample',
].join('\n');

function decryptByPrefix(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    typeof value === 'string' && value.startsWith('v1:enc:') ? value.slice('v1:enc:'.length) : value,
  ]));
}

function mockClientRow(row: Record<string, unknown>) {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([row]) }),
    }),
  });
}

function insertedDisputeValues(): Record<string, unknown> | undefined {
  return txMock.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
}

async function postGenerateLetter(body: unknown) {
  const { POST } = await import('@/app/api/workspace/disputes/generate-letter/route');
  const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/generate-letter', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

const SINGLE_ITEM_BODY = {
  clientId: 'client-1',
  bureau: 'experian',
  reasonCodes: ['verification_required'],
  disputeItems: [{ id: 'neg-1', kind: 'tradeline', creditorName: 'Example Bank', accountNumber: '99887766', itemType: 'collection', dateReported: '2026-05-01' }],
};

describe('POST /api/workspace/disputes/generate-letter consumer identity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    requireLatestApprovedReportForClientMock.mockResolvedValue({ allowed: true });
    selectLibraryForGenerationMock.mockResolvedValue({ chosen: null, score: 0, rationale: [], runnersUp: [] });
    getLLMConfigMock.mockResolvedValue({ provider: 'custom', model: 'deepseek-flash', apiKey: 'test-key', apiProtocol: 'anthropic', apiEndpoint: 'https://api.deepseek.com/anthropic' });
    generateLetterDraftMock.mockResolvedValue(MODEL_DRAFT);
    decryptClientDataMock.mockImplementation(decryptByPrefix);
    txMock.insert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
    dbMock.transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    mockClientRow(ENCRYPTED_CLIENT);
  });

  it.each([
    ['single-item', SINGLE_ITEM_BODY],
    ['combined', { ...SINGLE_ITEM_BODY, combineItems: true }],
  ])('persists a %s letter with the decrypted name and address, and keeps PII out of the prompt', async (_label, body) => {
    const result = await postGenerateLetter(body);

    expect({ status: result.status, error: result.body.error }).toEqual({ status: 200, error: undefined });
    expect(result.body.generation_source).toBe('ai');
    expect(result.body.client_name).toBe('Jane Sample');

    const letter = insertedDisputeValues()?.letterContent as string;
    expect(letter.startsWith([
      'Jane Sample',
      '100 Main St',
      'Albany, NY 12207',
      'Date of Birth: 03/07/1985',
      'SSN (last 4): XXX-XX-4321',
    ].join('\n'))).toBe(true);
    expect(letter).toMatch(/Sincerely,\nJane Sample$/);
    expect(letter).not.toContain('v1:enc:');
    expect(result.body.letter_content).toBe(letter);

    const prompt = generateLetterDraftMock.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain('Jane Sample');
    for (const secret of ['100 Main St', 'Albany', '12207', '4321', '1985', 'v1:enc:']) {
      expect(prompt).not.toContain(secret);
    }
  }, 30000);

  it('refuses with 409 when the client has no address on file', async () => {
    mockClientRow({ ...ENCRYPTED_CLIENT, streetAddress: null, zipCode: '' });

    const result = await postGenerateLetter(SINGLE_ITEM_BODY);

    expect(result).toEqual({
      status: 409,
      body: {
        error: 'Client address is required before generating a letter',
        code: 'LETTER_IDENTITY_INCOMPLETE',
        missing: ['streetAddress', 'zip'],
      },
    });
    expect(generateLetterDraftMock).not.toHaveBeenCalled();
    expect(dbMock.transaction).not.toHaveBeenCalled();
  }, 30000);

  it('refuses with 409 when a client field cannot be decrypted', async () => {
    decryptClientDataMock.mockImplementation((data: Record<string, unknown>) => ({
      ...decryptByPrefix(data),
      lastName: '[decryption-failed]',
    }));

    const result = await postGenerateLetter(SINGLE_ITEM_BODY);

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ code: 'LETTER_IDENTITY_INCOMPLETE', missing: ['fullName'] });
    expect(generateLetterDraftMock).not.toHaveBeenCalled();
  }, 30000);
});

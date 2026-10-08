import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { FeePlan } from '@/lib/billing-facts';
import { queryChain } from '@/__tests__/fixtures/compliance-gate';

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
const getSessionMock = vi.hoisted(() => vi.fn());
const loadFeePlanMock = vi.hoisted(() => vi.fn());
const decryptClientDataMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/billing-facts', () => ({ loadFeePlan: loadFeePlanMock }));
vi.mock('@/lib/db-encryption', () => ({
  DECRYPTION_FAILED: '[decryption-failed]',
  decryptClientData: decryptClientDataMock,
}));

const template = {
  id: 'template-1',
  version: '2.0',
  content: '<p>{{client_name}} / {{client_email}}</p><div>{{service_package}}</div><p>{{client_signature}}</p>',
  requiredDisclosures: JSON.stringify(['fee_disclosure']),
};
const encryptedClient = { id: 'client-1', firstName: 'enc:first', lastName: 'enc:last', email: 'jo@example.com', phone: 'enc:phone' };
const feePlan: FeePlan = {
  billingProfileId: 'profile-1',
  feeConfigId: 'fee-1',
  name: 'Standard <Plus>',
  feeModel: 'flat_fee',
  amountCents: 50000,
  frequency: 'one_time',
  setupFeeCents: 0,
};

function request() {
  return new NextRequest('http://localhost/api/workspace/agreements', {
    method: 'POST',
    body: JSON.stringify({ type: 'agreement', clientId: 'client-1', templateId: 'template-1' }),
  });
}

describe('POST /api/workspace/agreements (send to client)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
    dbMock.select
      .mockReturnValueOnce(queryChain([template]))
      .mockReturnValueOnce(queryChain([encryptedClient]));
    decryptClientDataMock.mockReturnValue({ ...encryptedClient, firstName: 'Jo', lastName: "O'Neil", phone: '555-0100' });
  });

  it('refuses with 409 when the client has no fee plan', async () => {
    const { POST } = await import('@/app/api/workspace/agreements/route');
    loadFeePlanMock.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Set a fee plan on the client Billing tab before sending an agreement',
      code: 'FEE_PLAN_REQUIRED',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('decrypts the client, substitutes escaped fee terms and stores the same terms as the snapshot', async () => {
    const { POST } = await import('@/app/api/workspace/agreements/route');
    loadFeePlanMock.mockResolvedValue(feePlan);
    const agreementInsert = queryChain(undefined);
    const disclosureInsert = queryChain(undefined);
    dbMock.insert.mockReturnValueOnce(agreementInsert).mockReturnValueOnce(disclosureInsert);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(loadFeePlanMock).toHaveBeenCalledWith('client-1');
    expect(decryptClientDataMock).toHaveBeenCalledWith(encryptedClient);
    const values = agreementInsert.values.mock.calls[0][0] as { content: string; feeTermsSnapshot: string; status: string };
    const expectedTerms = [
      'Service package: Standard <Plus>',
      'Fee model: Flat fee',
      'Fee: $500.00 one time',
      'Setup fee: None',
      'No fee may be collected until the services have been fully performed. You will not be charged any fee until after services are rendered.',
    ].join('\n');
    expect(values.feeTermsSnapshot).toBe(expectedTerms);
    expect(values.status).toBe('pending');
    expect(values.content).toBe(
      '<p>Jo O&#39;Neil / jo@example.com</p><div>'
      + expectedTerms.split('\n').map((line) => `<p style="font-size: 12px; margin: 0 0 6px 0;">${line.replace('<Plus>', '&lt;Plus&gt;')}</p>`).join('')
      + '</div><p>{{client_signature}}</p>',
    );
    expect(values.content).not.toContain('enc:');
    expect(values.content).not.toContain('{{service_package}}');
  });

  it('refuses to render an agreement when client PII cannot be decrypted', async () => {
    const { POST } = await import('@/app/api/workspace/agreements/route');
    loadFeePlanMock.mockResolvedValue(feePlan);
    decryptClientDataMock.mockReturnValue({ ...encryptedClient, firstName: '[decryption-failed]', lastName: 'Neil', phone: null });

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'CLIENT_PII_UNREADABLE' });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

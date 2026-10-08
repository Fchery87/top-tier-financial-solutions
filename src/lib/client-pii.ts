export type ClientPiiInput = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  dateOfBirth: string | null;
  ssnLast4: string | null;
  notes: string | null;
};

export type ClientPiiField = keyof ClientPiiInput;

const FIELD_BY_KEY: Record<string, ClientPiiField> = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone: 'phone',
  street_address: 'streetAddress',
  city: 'city',
  state: 'state',
  zip_code: 'zipCode',
  date_of_birth: 'dateOfBirth',
  ssn_last_4: 'ssnLast4',
  notes: 'notes',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function presentString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseClientPii(
  body: unknown,
  mode: 'create' | 'update',
): { ok: true; value: Partial<ClientPiiInput> } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Client payload must be an object' };
  }

  const record = body as Record<string, unknown>;
  const value: Partial<ClientPiiInput> = {};

  for (const [key, field] of Object.entries(FIELD_BY_KEY)) {
    if (!(key in record)) continue;
    const parsed = presentString(record[key]);
    if (parsed === undefined) {
      return { ok: false, error: `${key} must be a string` };
    }
    value[field] = parsed;
  }

  if (mode === 'create') {
    if (!value.firstName || !value.lastName || !value.email) {
      return { ok: false, error: 'First name, last name, and email are required' };
    }
  }

  if (value.email !== undefined && value.email !== null && !EMAIL_PATTERN.test(value.email)) {
    return { ok: false, error: 'Email must be a valid address' };
  }

  if (value.ssnLast4 !== undefined && value.ssnLast4 !== null && !/^\d{4}$/.test(value.ssnLast4)) {
    return { ok: false, error: 'SSN last 4 must be exactly 4 digits' };
  }

  return { ok: true, value };
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  boundedJsonValue,
  boundedText,
  readFormData,
  readJsonBody,
  requiredFile,
  validationErrorResponse,
} from '@/lib/request-validation';

describe('request validation', () => {
  it('bounds required text and preserves valid text', () => {
    const schema = boundedText({ field: 'Name', maximumLength: 5 });

    expect(schema.safeParse('Ada').success).toBe(true);
    expect(schema.safeParse('     ').success).toBe(false);
    expect(schema.safeParse('Longer').success).toBe(false);
  });

  it('validates UUID, email, and enum schema values without coercion', () => {
    const schema = z.object({
      id: z.uuid(),
      email: z.email(),
      role: z.enum(['staff', 'admin']),
    }).strict();

    expect(schema.safeParse({
      id: '18d15db0-3dde-43dd-9c76-319b9bba0304',
      email: 'operator@example.com',
      role: 'staff',
    }).success).toBe(true);
    expect(schema.safeParse({
      id: 'not-a-uuid',
      email: 'not-an-email',
      role: 'owner',
    }).success).toBe(false);
  });

  it('bounds recursive JSON values', () => {
    const schema = boundedJsonValue();

    expect(schema.safeParse({
      summary: 'within limits',
      items: [true, 1, null],
    }).success).toBe(true);
    expect(schema.safeParse('x'.repeat(5_001)).success).toBe(false);
    expect(schema.safeParse(Array.from({ length: 101 }, () => 1)).success).toBe(false);
    expect(schema.safeParse(Object.fromEntries(Array.from({ length: 101 }, (_, index) => [String(index), index]))).success).toBe(false);
    expect(schema.safeParse({ one: { two: { three: { four: { five: { six: true } } } } } }).success).toBe(false);
    expect(schema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(schema.safeParse(new Date()).success).toBe(false);
  });

  it('distinguishes malformed JSON from schema-invalid JSON', async () => {
    const schema = z.object({ name: boundedText({ field: 'Name', maximumLength: 20 }) }).strict();
    const malformed = await readJsonBody(
      new NextRequest('http://localhost/api/example', {
        method: 'POST',
        body: '{',
        headers: { 'content-type': 'application/json' },
      }),
      schema,
    );
    const invalid = await readJsonBody(
      new NextRequest('http://localhost/api/example', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
        headers: { 'content-type': 'application/json' },
      }),
      schema,
    );
    const valid = await readJsonBody(
      new NextRequest('http://localhost/api/example', {
        method: 'POST',
        body: JSON.stringify({ name: 'Ada' }),
        headers: { 'content-type': 'application/json' },
      }),
      schema,
    );

    expect(malformed.kind).toBe('malformed_json');
    expect(invalid.kind).toBe('invalid_payload');
    if (invalid.kind === 'invalid_payload') {
      expect(invalid.issues).not.toHaveLength(0);
    }
    expect(valid).toEqual({ kind: 'valid', data: { name: 'Ada' } });
  });

  it('reads FormData and only accepts an actual file for required file fields', async () => {
    const form = new FormData();
    const file = new File(['evidence'], 'evidence.pdf', { type: 'application/pdf' });
    form.set('file', file);

    const formRequest = {
      formData: async () => form,
    } satisfies Pick<Request, 'formData'>;
    const parsedForm = await readFormData(formRequest);
    const validFile = requiredFile(form, 'file');

    expect(parsedForm.kind).toBe('valid');
    expect(validFile).toEqual({ kind: 'valid', data: file });

    form.set('file', 'not-a-file');
    expect(requiredFile(form, 'file')).toEqual({ kind: 'invalid_file' });
  });

  it('creates a non-sensitive 400 response for malformed and invalid payloads', async () => {
    const malformedResponse = validationErrorResponse({ kind: 'malformed_json' });
    const invalidResponse = validationErrorResponse({ kind: 'invalid_payload', issues: [] });

    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.json()).toEqual({ error: 'Invalid request payload' });
    expect(await invalidResponse.json()).toEqual({ error: 'Invalid request payload' });
  });
});

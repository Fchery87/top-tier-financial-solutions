import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';

const MAXIMUM_JSON_DEPTH = 5;
const MAXIMUM_JSON_ARRAY_ENTRIES = 100;
const MAXIMUM_JSON_RECORD_KEYS = 100;
const MAXIMUM_JSON_STRING_LENGTH = 5_000;

type BoundedTextOptions = {
  field: string;
  maximumLength: number;
};

export type BoundedJsonValue =
  | string
  | number
  | boolean
  | null
  | BoundedJsonValue[]
  | { [key: string]: BoundedJsonValue };

type JsonBodyResult<TData> =
  | { kind: 'valid'; data: TData }
  | { kind: 'malformed_json' }
  | { kind: 'invalid_payload' };

type FormDataResult =
  | { kind: 'valid'; data: FormData }
  | { kind: 'malformed_form_data' };

type RequiredFileResult =
  | { kind: 'valid'; data: File }
  | { kind: 'invalid_file' };

type InvalidPayloadResult = Exclude<JsonBodyResult<never>, { kind: 'valid' }>;
type FormDataRequest = Pick<Request, 'formData'>;

export function boundedText({ field, maximumLength }: BoundedTextOptions) {
  return z
    .string({ error: `${field} must be text` })
    .trim()
    .min(1, `${field} is required`)
    .max(maximumLength, `${field} is too long`);
}

export function boundedJsonValue() {
  return z.custom<BoundedJsonValue>().superRefine((value, context) => {
    validateJsonValue({ value, depth: 0, context });
  });
}

export async function readJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<JsonBodyResult<z.output<TSchema>>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { kind: 'malformed_json' };
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return { kind: 'invalid_payload' };
  }

  return { kind: 'valid', data: parsed.data };
}

export async function readFormData(request: FormDataRequest): Promise<FormDataResult> {
  try {
    return { kind: 'valid', data: await request.formData() };
  } catch {
    return { kind: 'malformed_form_data' };
  }
}

export function requiredFile(formData: FormData, fieldName: string): RequiredFileResult {
  const entry = formData.get(fieldName);

  if (typeof File !== 'undefined' && entry instanceof File) {
    return { kind: 'valid', data: entry };
  }

  return { kind: 'invalid_file' };
}

export function validationErrorResponse(_result: InvalidPayloadResult) {
  return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
}

function validateJsonValue({
  value,
  depth,
  context,
}: {
  value: unknown;
  depth: number;
  context: z.RefinementCtx;
}): void {
  if (depth > MAXIMUM_JSON_DEPTH) {
    addJsonIssue(context, 'JSON value is nested too deeply');
    return;
  }

  if (value === null || typeof value === 'boolean') {
    return;
  }

  if (typeof value === 'string') {
    if (value.length > MAXIMUM_JSON_STRING_LENGTH) {
      addJsonIssue(context, 'JSON text value is too long');
    }
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      addJsonIssue(context, 'JSON number must be finite');
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > MAXIMUM_JSON_ARRAY_ENTRIES) {
      addJsonIssue(context, 'JSON array has too many entries');
      return;
    }

    for (const entry of value) {
      validateJsonValue({ value: entry, depth: depth + 1, context });
    }
    return;
  }

  if (isPlainRecord(value)) {
    const entries = Object.entries(value);

    if (entries.length > MAXIMUM_JSON_RECORD_KEYS) {
      addJsonIssue(context, 'JSON object has too many keys');
      return;
    }

    for (const [key, entry] of entries) {
      if (key.length > MAXIMUM_JSON_STRING_LENGTH) {
        addJsonIssue(context, 'JSON object key is too long');
      }
      validateJsonValue({ value: entry, depth: depth + 1, context });
    }
    return;
  }

  addJsonIssue(context, 'Value is not JSON-compatible');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addJsonIssue(context: z.RefinementCtx, message: string): void {
  context.addIssue({ code: 'custom', message });
}

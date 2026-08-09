import 'server-only';

import pino from 'pino';

type ServerLogLevel = 'info' | 'warn' | 'error';
type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ServerLogEvent {
  level: ServerLogLevel;
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  error?: {
    name: string;
  };
  metadata?: { [key: string]: JsonValue };
}

export interface ServerLogEventInput {
  level: ServerLogLevel;
  event: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

type ServerLogSink = (event: ServerLogEvent) => void;

const SENSITIVE_KEY = /email|phone|address|ssn|content|prompt|letter|html|url|cookie|token|secret/i;
const EMAIL_VALUE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_VALUE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
const SSN_VALUE = /\b\d{3}-?\d{2}-?\d{4}\b/g;

const logger = pino({
  base: undefined,
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

let testSink: ServerLogSink | undefined;

export function setServerLogSinkForTests(sink: ServerLogSink | undefined): void {
  testSink = sink;
}

export function logServerEvent(input: ServerLogEventInput): void {
  const event: ServerLogEvent = {
    level: input.level,
    event: input.event,
  };

  addStringField(event, 'requestId', input.requestId);
  addStringField(event, 'route', input.route);
  addStringField(event, 'method', input.method);
  addNumberField(event, 'status', input.status);
  addStringField(event, 'actorUserId', input.actorUserId);
  addStringField(event, 'resourceType', input.resourceType);
  addStringField(event, 'resourceId', input.resourceId);

  if (input.error !== undefined) {
    event.error = normalizeError(input.error);
  }

  const metadata = sanitizeMetadata(input.metadata);
  if (metadata !== undefined) {
    event.metadata = metadata;
  }

  if (testSink) {
    testSink(event);
    return;
  }

  logger[event.level](event);
}

function addStringField<K extends keyof Pick<
  ServerLogEvent,
  'actorUserId' | 'method' | 'requestId' | 'resourceId' | 'resourceType' | 'route'
>>(event: ServerLogEvent, key: K, value: string | undefined): void {
  if (value !== undefined) {
    event[key] = value;
  }
}

function addNumberField(event: ServerLogEvent, key: 'status', value: number | undefined): void {
  if (value !== undefined && Number.isFinite(value)) {
    event[key] = value;
  }
}

function normalizeError(error: unknown): { name: string } {
  if (error instanceof Error && error.name) {
    return { name: error.name };
  }

  return { name: 'UnknownError' };
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): { [key: string]: JsonValue } | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const sanitized = sanitizeObject(metadata);
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeObject(value: Record<string, unknown>): { [key: string]: JsonValue } {
  const sanitized: { [key: string]: JsonValue } = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }

    const safeValue = sanitizeValue(nestedValue);
    if (safeValue !== undefined) {
      sanitized[key] = safeValue;
    }
  }

  return sanitized;
}

function sanitizeValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    return redactInlineSensitiveValues(value);
  }

  if (Array.isArray(value)) {
    const sanitized: JsonValue[] = [];

    for (const item of value) {
      const safeItem = sanitizeValue(item);
      if (safeItem !== undefined) {
        sanitized.push(safeItem);
      }
    }

    return sanitized;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isRecord(value)) {
    return sanitizeObject(value);
  }

  return undefined;
}

function redactInlineSensitiveValues(value: string): string {
  return value
    .replace(EMAIL_VALUE, '[REDACTED]')
    .replace(URL_VALUE, '[REDACTED]')
    .replace(SSN_VALUE, '[REDACTED]');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

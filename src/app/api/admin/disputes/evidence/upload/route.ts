import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientCases, clientDocuments, clients } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { uploadLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { uploadToR2 } from '@/lib/r2-storage';
import { logServerEvent } from '@/lib/server-logger';
import { isUploadedFile, readFormData } from '@/lib/request-validation';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 20;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/html',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_DOCUMENT_TYPES = new Set([
  'id_document',
  'proof_of_address',
  'police_report',
  'ftc_identity_theft_report',
  'bank_statement',
  'payment_receipt',
  'correspondence',
  'credit_report',
  'dispute_letter',
  'other',
]);

type FormTextResult =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'valid'; value: string };

type FilesResult =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'too_many' }
  | { kind: 'valid'; files: File[] };

function readText(formData: FormData, name: string): FormTextResult {
  const value = formData.get(name);
  if (value === null || (typeof value === 'string' && !value.trim())) {
    return { kind: 'missing' };
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', value: value.trim() };
}

function readFirstText(formData: FormData, names: string[]): FormTextResult {
  for (const name of names) {
    if (formData.has(name)) {
      return readText(formData, name);
    }
  }
  return { kind: 'missing' };
}

function readFiles(formData: FormData): FilesResult {
  const singleFile = formData.get('file');
  const files = formData.getAll('files');
  const candidates = singleFile === null ? files : [singleFile, ...files];
  if (candidates.length === 0) {
    return { kind: 'missing' };
  }
  if (candidates.length > MAX_FILES_PER_UPLOAD) {
    return { kind: 'too_many' };
  }
  if (candidates.some((candidate) => !isUploadedFile(candidate))) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', files: candidates.filter(isUploadedFile) };
}

async function postHandler(request: NextRequest) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parsedForm = await readFormData(request);
    if (parsedForm.kind !== 'valid') {
      return NextResponse.json({ error: 'Invalid upload form' }, { status: 400 });
    }
    const clientIdResult = readFirstText(parsedForm.data, ['client_id', 'clientId']);
    if (clientIdResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Client ID must be text' }, { status: 400 });
    }
    if (clientIdResult.kind === 'missing') {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }
    const clientId = clientIdResult.value;
    if (clientId.length > 128) {
      return NextResponse.json({ error: 'Client ID is too long' }, { status: 400 });
    }

    const fileTypeResult = readFirstText(parsedForm.data, ['file_type', 'fileType']);
    if (fileTypeResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Document type must be text' }, { status: 400 });
    }
    const fileType = fileTypeResult.kind === 'valid' ? fileTypeResult.value : 'other';
    if (fileType.length > 50) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    if (!ALLOWED_DOCUMENT_TYPES.has(fileType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const notesResult = readText(parsedForm.data, 'notes');
    if (notesResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Notes must be text' }, { status: 400 });
    }
    const notes = notesResult.kind === 'valid' ? notesResult.value : null;
    if (notes !== null && notes.length > 5_000) {
      return NextResponse.json({ error: 'Notes are too long' }, { status: 400 });
    }

    const filesResult = readFiles(parsedForm.data);
    if (filesResult.kind === 'too_many') {
      return NextResponse.json({ error: 'A maximum of 20 files may be uploaded at once' }, { status: 400 });
    }
    if (filesResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Each evidence field must contain a file' }, { status: 400 });
    }
    if (filesResult.kind === 'missing') {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 });
    }
    const files = filesResult.files;

    if (files.some((file) => file.name.trim().length === 0 || file.name.length > 255)) {
      return NextResponse.json({ error: 'Invalid document metadata' }, { status: 400 });
    }

    const invalidFile = files.find((file) => !ALLOWED_MIME_TYPES.has(file.type) || file.size > MAX_FILE_SIZE);
    if (invalidFile) {
      return NextResponse.json({
        error: !ALLOWED_MIME_TYPES.has(invalidFile.type)
          ? 'Invalid file type. Allowed: PDF, HTML, TXT, images, Word documents.'
          : 'File too large. Maximum size is 10MB.',
      }, { status: 400 });
    }

    const [client] = await db
      .select({ id: clients.id, userId: clients.userId })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client?.userId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const clientUserId = client.userId;

    const [clientCase] = await db
      .select({ id: clientCases.id })
      .from(clientCases)
      .where(eq(clientCases.userId, clientUserId))
      .limit(1);

    if (!clientCase) {
      return NextResponse.json({ error: 'Client needs an active case before evidence can be uploaded' }, { status: 409 });
    }

    const now = new Date();
    const documents = await Promise.all(files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadToR2(
        buffer,
        file.name,
        file.type,
        `client-documents/${clientUserId}/evidence`,
      );
      const id = randomUUID();

      await db.insert(clientDocuments).values({
        id,
        caseId: clientCase.id,
        userId: clientUserId,
        fileName: file.name,
        fileType,
        fileUrl: uploaded.key,
        fileSize: uploaded.size,
        uploadedBy: 'admin',
        notes: notes ?? undefined,
        createdAt: now,
      });

      return {
        id,
        client_id: clientId,
        file_name: file.name,
        file_type: fileType,
        file_url: uploaded.key,
        file_size: uploaded.size,
        uploaded_by: 'admin',
        notes,
        created_at: now.toISOString(),
      };
    }));

    return NextResponse.json({
      documents,
      ...(documents.length === 1 ? documents[0] : {}),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.evidence.upload.error', error: error });
    return NextResponse.json({ error: 'Failed to upload evidence documents' }, { status: 500 });
  }
}

export const POST = rateLimited(uploadLimiter)(postHandler);

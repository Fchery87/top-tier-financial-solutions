import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientCases, clientDocuments, clients } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { uploadLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { uploadToR2 } from '@/lib/r2-storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
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

function readText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value !== 'string'
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && typeof value.size === 'number'
    && typeof value.arrayBuffer === 'function';
}

function readFiles(formData: FormData): File[] {
  const singleFile = formData.get('file');
  const files = formData.getAll('files');
  const candidates = singleFile === null ? files : [singleFile, ...files];
  return candidates.filter(isUploadedFile);
}

async function postHandler(request: NextRequest) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const clientId = readText(formData, 'client_id') ?? readText(formData, 'clientId');
    const fileType = readText(formData, 'file_type') ?? readText(formData, 'fileType') ?? 'other';
    const notes = readText(formData, 'notes');
    const files = readFiles(formData);

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    if (!ALLOWED_DOCUMENT_TYPES.has(fileType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 });
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
    console.error('Error uploading dispute evidence:', error);
    return NextResponse.json({ error: 'Failed to upload evidence documents' }, { status: 500 });
  }
}

export const POST = rateLimited(uploadLimiter)(postHandler);

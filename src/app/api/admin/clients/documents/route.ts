import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientIdentityDocuments, clients } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { uploadToR2 } from '@/lib/r2-storage';
import { logServerEvent } from '@/lib/server-logger';
import { readFormData, requiredFile } from '@/lib/request-validation';
import { z } from 'zod';

const identityDocumentTypeSchema = z.enum([
  'government_id',
  'ssn_card',
  'proof_of_address',
  'credit_report',
  'other',
]);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type FormTextResult =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'valid'; value: string };

function formText(formData: FormData, name: string): FormTextResult {
  const value = formData.get(name);
  if (value === null) {
    return { kind: 'missing' };
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', value: value.trim() };
}

export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('clients:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const parsedForm = await readFormData(request);
    if (parsedForm.kind !== 'valid') {
      return NextResponse.json({ error: 'Invalid upload form' }, { status: 400 });
    }
    const fileResult = requiredFile(parsedForm.data, 'file');
    if (fileResult.kind !== 'valid') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const file = fileResult.data;

    const clientIdResult = formText(parsedForm.data, 'client_id');
    if (clientIdResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Client ID must be text' }, { status: 400 });
    }
    if (clientIdResult.kind === 'missing' || !clientIdResult.value) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }
    const clientId = clientIdResult.value;
    if (clientId.length > 128) {
      return NextResponse.json({ error: 'Client ID is too long' }, { status: 400 });
    }

    const documentTypeResult = formText(parsedForm.data, 'document_type');
    if (documentTypeResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Document type must be text' }, { status: 400 });
    }
    if (documentTypeResult.kind === 'missing' || !documentTypeResult.value) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 });
    }
    const documentType = identityDocumentTypeSchema.safeParse(documentTypeResult.value);

    if (!documentType.success) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const notesResult = formText(parsedForm.data, 'notes');
    if (notesResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Notes must be text' }, { status: 400 });
    }
    const notes = notesResult.kind === 'valid' ? notesResult.value : null;
    if (notes !== null && notes.length > 5_000) {
      return NextResponse.json({ error: 'Notes are too long' }, { status: 400 });
    }
    if (file.name.trim().length === 0 || file.name.length > 255) {
      return NextResponse.json({ error: 'Invalid document metadata' }, { status: 400 });
    }

    // Verify client exists
    const [clientExists] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!clientExists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Validate file type (images and PDFs only for identity documents)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF.' }, { status: 400 });
    }

    // Validate file size (5MB max for identity documents)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    // Upload to R2
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToR2(
      fileBuffer,
      file.name,
      file.type,
      `client-documents/${clientId}/${documentType}`
    );

    // Create database record
    const id = randomUUID();
    const now = new Date();

    await db.insert(clientIdentityDocuments).values({
      id,
      clientId,
      documentType: documentType.data,
      fileName: file.name,
      fileUrl: uploadResult.key,
      fileSize: uploadResult.size,
      mimeType: file.type,
      uploadedById: adminUser.id,
      notes: notes || null,
      createdAt: now,
    });

    return NextResponse.json({
      id,
      file_name: file.name,
      document_type: documentType.data,
      file_size: uploadResult.size,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.clients.documents.error', error: error });
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}

// GET - List documents for a client
export async function GET(request: NextRequest) {
  const adminUser = await requireCapability('clients:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  try {
    const documents = await db
      .select()
      .from(clientIdentityDocuments)
      .where(eq(clientIdentityDocuments.clientId, clientId));

    return NextResponse.json({
      items: documents.map((doc) => ({
        id: doc.id,
        client_id: doc.clientId,
        document_type: doc.documentType,
        file_name: doc.fileName,
        file_url: doc.fileUrl,
        file_size: doc.fileSize,
        mime_type: doc.mimeType,
        notes: doc.notes,
        created_at: doc.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.clients.documents.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

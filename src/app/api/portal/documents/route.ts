import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientDocuments, clientCases } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { logServerEvent } from '@/lib/server-logger';
import { readJsonBody } from '@/lib/request-validation';
import { z } from 'zod';

const MAX_PORTAL_DOCUMENT_SIZE = 10 * 1024 * 1024;
const portalDocumentTypeSchema = z.enum([
  'identity_document',
  'id_document',
  'proof_of_address',
  'credit_report',
  'dispute_letter',
  'correspondence',
  'other',
]);
const portalDocumentRegistrationSchema = z.object({
  case_id: z.string().trim().min(1).max(128).optional(),
  file_name: z.string().trim().min(1).max(255).optional(),
  file_type: portalDocumentTypeSchema.optional(),
  file_url: z.string().trim().min(1).max(2_048).optional(),
  storage_key: z.string().trim().min(1).max(1_024).optional(),
  file_size: z.number().int().min(0).max(MAX_PORTAL_DOCUMENT_SIZE).optional(),
  notes: z.string().trim().max(5_000).nullable().optional(),
}).strict();

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const caseId = searchParams.get('case_id');

  try {
    let documents;
    if (caseId) {
      // Verify user owns this case
      const caseOwner = await db
        .select({ userId: clientCases.userId })
        .from(clientCases)
        .where(eq(clientCases.id, caseId))
        .limit(1);

      if (caseOwner.length === 0 || caseOwner[0].userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      documents = await db
        .select()
        .from(clientDocuments)
        .where(eq(clientDocuments.caseId, caseId))
        .orderBy(desc(clientDocuments.createdAt));
    } else {
      documents = await db
        .select()
        .from(clientDocuments)
        .where(eq(clientDocuments.userId, user.id))
        .orderBy(desc(clientDocuments.createdAt));
    }

    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        case_id: d.caseId,
        file_name: d.fileName,
        file_type: d.fileType,
        file_url: d.fileUrl,
        file_size: d.fileSize,
        uploaded_by: d.uploadedBy,
        notes: d.notes,
        created_at: d.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.portal.documents.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = await readJsonBody(request, portalDocumentRegistrationSchema);
    if (parsed.kind !== 'valid') {
      return NextResponse.json({ error: 'Invalid document registration' }, { status: 400 });
    }

    const { case_id, file_name, file_type, file_url, storage_key, file_size, notes } = parsed.data;

    if (file_url && !storage_key) {
      return NextResponse.json({ error: 'Use a controlled portal upload key, not an arbitrary file URL' }, { status: 400 });
    }

    if (!case_id || !file_name || !file_type || !storage_key || file_size === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expectedPrefix = `portal-documents/${user.id}/`;
    if (typeof storage_key !== 'string' || !storage_key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Storage key does not belong to authenticated client' }, { status: 403 });
    }

    // Verify user owns this case
    const caseOwner = await db
      .select({ userId: clientCases.userId })
      .from(clientCases)
      .where(eq(clientCases.id, case_id))
      .limit(1);

    if (caseOwner.length === 0 || caseOwner[0].userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(clientDocuments).values({
      id,
      caseId: case_id,
      userId: user.id,
      fileName: file_name,
      fileType: file_type,
      fileUrl: storage_key,
      fileSize: file_size,
      uploadedBy: 'client',
      notes,
      createdAt: now,
    });

    return NextResponse.json({
      id,
      case_id,
      file_name,
      file_type,
      file_url: storage_key,
      file_size,
      uploaded_by: 'client',
      notes,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.portal.documents.error', error: error });
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

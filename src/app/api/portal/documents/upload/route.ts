import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientDocuments, clientCases, clients, tasks } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { and, eq, ilike, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { uploadToR2 } from '@/lib/r2-storage';
import { uploadLimiter } from '@/lib/rate-limit';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { logServerEvent } from '@/lib/server-logger';
import { readFormData, requiredFile } from '@/lib/request-validation';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'identity_document',
  'id_document',
  'proof_of_address',
  'credit_report',
  'dispute_letter',
  'correspondence',
  'other',
]);
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

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

async function postHandler(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const fileTypeEntry = parsedForm.data.get('file_type');
    if (fileTypeEntry !== null && typeof fileTypeEntry !== 'string') {
      return NextResponse.json({ error: 'Document type must be text' }, { status: 400 });
    }
    const fileType = fileTypeEntry?.trim() || 'other';
    if (!ALLOWED_DOCUMENT_TYPES.has(fileType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const notesEntry = parsedForm.data.get('notes');
    if (notesEntry !== null && typeof notesEntry !== 'string') {
      return NextResponse.json({ error: 'Notes must be text' }, { status: 400 });
    }
    const notes = notesEntry?.trim() || '';
    if (notes.length > 5_000 || file.name.trim().length === 0 || file.name.length > 255) {
      return NextResponse.json({ error: 'Invalid document metadata' }, { status: 400 });
    }

    // Validate file type (allow common document types)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: PDF, HTML, TXT, images, Word documents.' 
      }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Find the user's client record and case (if exists)
    const [clientRecord] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!clientRecord) {
      return NextResponse.json({ 
        error: 'No active case found. Please contact support.' 
      }, { status: 400 });
    }

    const [clientCase] = await db
      .select()
      .from(clientCases)
      .where(eq(clientCases.userId, user.id))
      .limit(1);

    if (!clientCase) {
      return NextResponse.json({
        error: 'No active case found. Please contact support.',
      }, { status: 400 });
    }

    // Upload to R2
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToR2(
      fileBuffer,
      file.name,
      file.type,
      `client-documents/${user.id}`
    );

    // Create database record
    const id = randomUUID();
    const now = new Date();

    await db.insert(clientDocuments).values({
      id,
      caseId: clientCase.id,
      userId: user.id,
      fileName: file.name,
      fileType: fileType,
      fileUrl: uploadResult.key,
      fileSize: uploadResult.size,
      uploadedBy: 'client',
      notes: notes || null,
      createdAt: now,
    });

    // Automatically create an internal review task and complete any matching client-facing upload tasks
    try {
      const clientId = clientRecord.id;

      // Create an internal task for the team to review this document
      const humanType =
        fileType === 'credit_report'
          ? 'credit report'
          : fileType === 'id_document'
            ? 'ID document'
            : fileType === 'dispute_letter'
              ? 'dispute letter'
              : fileType === 'correspondence'
                ? 'correspondence'
                : 'document';

      const reviewTaskId = randomUUID();

      await db.insert(tasks).values({
        id: reviewTaskId,
        clientId,
        assigneeId: null,
        createdById: null,
        title: `Review client ${humanType}`,
        description: `Automatically created when the client uploaded ${file.name}.`,
        status: 'todo',
        priority: fileType === 'id_document' ? 'high' : 'medium',
        dueDate: null,
        completedAt: null,
        visibleToClient: false,
        isBlocking: false,
        createdAt: now,
        updatedAt: now,
      });

      // Auto-complete any open client-facing "upload" tasks matching this file type
      const uploadTitlePatterns: string[] = [];
      if (fileType === 'credit_report') {
        uploadTitlePatterns.push('%credit report%');
      } else if (fileType === 'id_document') {
        uploadTitlePatterns.push('%id document%', '%photo id%', '%government id%');
      }

      if (uploadTitlePatterns.length > 0) {
        const statusNotDone = or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress'),
          eq(tasks.status, 'review'),
        );

        const titleCondition = or(
          ...uploadTitlePatterns.map((pattern) => ilike(tasks.title, pattern)),
        );

        await db
          .update(tasks)
          .set({ status: 'done', completedAt: now, updatedAt: now })
          .where(
            and(
              eq(tasks.clientId, clientId),
              eq(tasks.visibleToClient, true),
              statusNotDone,
              titleCondition,
            ),
          );
      }
    } catch (taskError) {
      // Task automation should never block document upload
      logServerEvent({ level: 'error', event: 'server.app.api.portal.documents.upload.error', error: taskError });
    }

    return NextResponse.json({
      id,
      file_name: file.name,
      file_type: fileType,
      file_url: uploadResult.key,
      file_size: uploadResult.size,
      uploaded_by: 'client',
      notes,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.portal.documents.upload.error', error: error });
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to upload document' 
    }, { status: 500 });
  }
}

export const POST = rateLimited(uploadLimiter)(postHandler);

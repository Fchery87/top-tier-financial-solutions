import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientDocuments, clientCases, clients } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { uploadToR2 } from '@/lib/r2-storage';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('file_type') as string || 'other';
    const notes = formData.get('notes') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (allow common document types)
    const allowedTypes = [
      'application/pdf',
      'text/html',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: PDF, HTML, TXT, images, Word documents.' 
      }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Find the user's client case (if exists)
    const [clientCase] = await db
      .select()
      .from(clientCases)
      .where(eq(clientCases.userId, user.id))
      .limit(1);

    // If no client case, check if they have a client record
    if (!clientCase) {
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
      caseId: clientCase?.id || '', // Use empty string if no case (schema might require it)
      userId: user.id,
      fileName: file.name,
      fileType: fileType,
      fileUrl: uploadResult.key,
      fileSize: uploadResult.size,
      uploadedBy: 'client',
      notes: notes || null,
      createdAt: now,
    });

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
    console.error('Error uploading document:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to upload document' 
    }, { status: 500 });
  }
}

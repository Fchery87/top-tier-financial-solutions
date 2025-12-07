import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientIdentityDocuments, clients } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { uploadToR2 } from '@/lib/r2-storage';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) {
    return null;
  }
  
  return session.user;
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('client_id') as string;
    const documentType = formData.get('document_type') as string;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 });
    }

    // Validate document type
    const validTypes = ['government_id', 'ssn_card', 'proof_of_address', 'credit_report', 'other'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF.' }, { status: 400 });
    }

    // Validate file size (5MB max for identity documents)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
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
      documentType: documentType as 'government_id' | 'ssn_card' | 'proof_of_address' | 'credit_report' | 'other',
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
      document_type: documentType,
      file_size: uploadResult.size,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading client document:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}

// GET - List documents for a client
export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    console.error('Error fetching client documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

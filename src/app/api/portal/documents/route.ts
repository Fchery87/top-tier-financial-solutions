import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientDocuments, clientCases } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { case_id, file_name, file_type, file_url, file_size, notes } = body;

    if (!case_id || !file_name || !file_url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      fileUrl: file_url,
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
      file_url,
      file_size,
      uploaded_by: 'client',
      notes,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

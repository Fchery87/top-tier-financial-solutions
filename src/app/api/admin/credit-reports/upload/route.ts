import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { creditReports, clients } from '@/db/schema';
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
    const bureau = formData.get('bureau') as string || 'combined';
    const reportDateStr = formData.get('report_date') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
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

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/html', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload PDF, HTML, or TXT.' }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Determine file type for DB
    let fileType = 'pdf';
    if (file.type === 'text/html') fileType = 'html';
    if (file.type === 'text/plain') fileType = 'txt';

    // Upload to R2
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToR2(
      fileBuffer,
      file.name,
      file.type,
      `credit-reports/${clientId}`
    );

    // Create database record
    const id = randomUUID();
    const now = new Date();
    const reportDate = reportDateStr ? new Date(reportDateStr) : null;

    await db.insert(creditReports).values({
      id,
      clientId,
      fileName: file.name,
      fileType,
      fileUrl: uploadResult.key, // Store the R2 key, not the full URL
      fileSize: uploadResult.size,
      bureau,
      reportDate,
      parseStatus: 'pending',
      uploadedAt: now,
      createdAt: now,
    });

    return NextResponse.json({
      id,
      file_name: file.name,
      file_type: fileType,
      file_size: uploadResult.size,
      bureau,
      parse_status: 'pending',
      uploaded_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading credit report:', error);
    return NextResponse.json({ error: 'Failed to upload credit report' }, { status: 500 });
  }
}

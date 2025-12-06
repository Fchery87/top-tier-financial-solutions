import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { messageAttachments, messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { uploadToR2, getSignedDownloadUrl, deleteFromR2 } from '@/lib/r2-storage';

// POST - Upload attachment to a message
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const messageId = formData.get('message_id') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Verify message exists
    const [message] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Upload to R2
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToR2(
      fileBuffer,
      file.name,
      file.type,
      'message-attachments'
    );

    // Save attachment record to database
    const attachmentId = crypto.randomUUID();
    await db.insert(messageAttachments).values({
      id: attachmentId,
      messageId,
      fileName: file.name,
      fileUrl: uploadResult.key, // Store R2 key
      fileSize: uploadResult.size,
      fileType: file.type,
    });

    return NextResponse.json({
      id: attachmentId,
      file_name: file.name,
      file_size: uploadResult.size,
      file_type: file.type,
      message: 'Attachment uploaded successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

// GET - Get signed download URL for attachment
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('id');

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 });
    }

    // Get attachment
    const [attachment] = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.id, attachmentId))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Generate signed download URL (valid for 1 hour)
    const downloadUrl = await getSignedDownloadUrl(attachment.fileUrl, 3600);

    return NextResponse.json({
      id: attachment.id,
      file_name: attachment.fileName,
      file_type: attachment.fileType,
      file_size: attachment.fileSize,
      download_url: downloadUrl,
    });
  } catch (error) {
    console.error('Error getting attachment URL:', error);
    return NextResponse.json({ error: 'Failed to get attachment URL' }, { status: 500 });
  }
}

// DELETE - Delete attachment
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('id');

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 });
    }

    // Get attachment
    const [attachment] = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.id, attachmentId))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Delete from R2
    try {
      await deleteFromR2(attachment.fileUrl);
    } catch (r2Error) {
      console.error('Error deleting from R2:', r2Error);
      // Continue with database deletion even if R2 delete fails
    }

    // Delete from database
    await db.delete(messageAttachments).where(eq(messageAttachments.id, attachmentId));

    return NextResponse.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientAgreements, disclosureAcknowledgments, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { uploadToR2 } from '@/lib/r2-storage';

// Helper to calculate business days
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  return result;
}

// POST - Sign an agreement (client-facing, but can be used by admin on behalf of client)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agreementId, signatureData, signatureType, disclosureAcknowledgments: disclosures } = body;

    if (!agreementId || !signatureData) {
      return NextResponse.json({ error: 'Agreement ID and signature data are required' }, { status: 400 });
    }

    // Get the agreement
    const [agreement] = await db
      .select()
      .from(clientAgreements)
      .where(eq(clientAgreements.id, agreementId))
      .limit(1);

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    if (agreement.status === 'signed') {
      return NextResponse.json({ error: 'Agreement is already signed' }, { status: 400 });
    }

    if (agreement.status === 'cancelled' || agreement.status === 'expired') {
      return NextResponse.json({ error: 'Agreement is no longer valid' }, { status: 400 });
    }

    // Check if agreement has expired
    if (agreement.expiresAt && new Date(agreement.expiresAt) < new Date()) {
      await db
        .update(clientAgreements)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(clientAgreements.id, agreementId));
      return NextResponse.json({ error: 'Agreement has expired' }, { status: 400 });
    }

    // Verify all required disclosures are acknowledged
    const requiredDisclosures = await db
      .select()
      .from(disclosureAcknowledgments)
      .where(eq(disclosureAcknowledgments.agreementId, agreementId));

    if (disclosures && Array.isArray(disclosures)) {
      // Update disclosure acknowledgments
      for (const disclosure of disclosures) {
        await db
          .update(disclosureAcknowledgments)
          .set({
            acknowledged: true,
            acknowledgedAt: new Date(),
            acknowledgerIpAddress: request.headers.get('x-forwarded-for') || 'unknown',
          })
          .where(and(
            eq(disclosureAcknowledgments.agreementId, agreementId),
            eq(disclosureAcknowledgments.id, disclosure.id)
          ));
      }
    }

    // Check all disclosures are now acknowledged
    const unacknowledged = await db
      .select()
      .from(disclosureAcknowledgments)
      .where(and(
        eq(disclosureAcknowledgments.agreementId, agreementId),
        eq(disclosureAcknowledgments.acknowledged, false)
      ));

    if (unacknowledged.length > 0) {
      return NextResponse.json({ 
        error: 'All disclosures must be acknowledged before signing',
        unacknowledged: unacknowledged.map(d => d.disclosureType),
      }, { status: 400 });
    }

    // Get client info for the signed document
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, agreement.clientId))
      .limit(1);

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    const signedAt = new Date();
    const cancellationDeadline = addBusinessDays(signedAt, 3); // CROA requires 3 business days

    // Create signed document HTML with signature
    const signedContent = `
      ${agreement.content}
      <div style="margin-top: 40px; padding: 20px; border-top: 2px solid #333;">
        <h3>Electronic Signature</h3>
        <p><strong>Signed by:</strong> ${client?.firstName} ${client?.lastName}</p>
        <p><strong>Date:</strong> ${signedAt.toLocaleString()}</p>
        <p><strong>Signature Type:</strong> ${signatureType || 'electronic'}</p>
        ${signatureType === 'drawn' ? `<img src="${signatureData}" alt="Signature" style="max-width: 300px; border: 1px solid #ccc;" />` : `<p><strong>Typed Signature:</strong> ${signatureData}</p>`}
        <p style="font-size: 10px; color: #666; margin-top: 20px;">
          IP Address: ${ipAddress}<br/>
          User Agent: ${userAgent}<br/>
          Cancellation Deadline: ${cancellationDeadline.toLocaleString()}
        </p>
      </div>
    `;

    // Store signed document to R2 for record-keeping
    const signedDocBuffer = Buffer.from(signedContent, 'utf-8');
    const uploadResult = await uploadToR2(
      signedDocBuffer,
      `agreement-${agreementId}-signed.html`,
      'text/html',
      'signed-agreements'
    );

    // Update agreement status
    await db
      .update(clientAgreements)
      .set({
        status: 'signed',
        content: signedContent,
        signedAt,
        signatureData: signatureType === 'drawn' ? uploadResult.key : signatureData, // Store R2 key for drawn signatures
        signatureType: signatureType || 'typed',
        signerIpAddress: ipAddress,
        signerUserAgent: userAgent,
        cancellationDeadline,
        updatedAt: new Date(),
      })
      .where(eq(clientAgreements.id, agreementId));

    return NextResponse.json({
      message: 'Agreement signed successfully',
      signed_at: signedAt.toISOString(),
      cancellation_deadline: cancellationDeadline.toISOString(),
      document_url: uploadResult.key,
    });
  } catch (error) {
    console.error('Error signing agreement:', error);
    return NextResponse.json({ error: 'Failed to sign agreement' }, { status: 500 });
  }
}

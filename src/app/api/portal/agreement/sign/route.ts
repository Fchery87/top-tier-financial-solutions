import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientAgreements, disclosureAcknowledgments, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Calculate business days (excludes weekends)
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  return result;
}

// POST - Sign an agreement (client-facing)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      agreementId, 
      signatureData, 
      signatureType, 
      initials,
      disclosureAcknowledgments: disclosures 
    } = body;

    if (!agreementId || !signatureData) {
      return NextResponse.json({ 
        error: 'Agreement ID and signature are required' 
      }, { status: 400 });
    }

    // Find the client record for this user
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, session.user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    // Get the agreement and verify it belongs to this client
    const [agreement] = await db
      .select()
      .from(clientAgreements)
      .where(
        and(
          eq(clientAgreements.id, agreementId),
          eq(clientAgreements.clientId, client.id)
        )
      )
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

    // Update disclosure acknowledgments
    if (disclosures && Array.isArray(disclosures)) {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
      
      for (const disclosure of disclosures) {
        if (disclosure.acknowledged) {
          await db
            .update(disclosureAcknowledgments)
            .set({
              acknowledged: true,
              acknowledgedAt: new Date(),
              acknowledgerIpAddress: ipAddress,
            })
            .where(
              and(
                eq(disclosureAcknowledgments.agreementId, agreementId),
                eq(disclosureAcknowledgments.id, disclosure.id)
              )
            );
        }
      }
    }

    // Verify all disclosures are acknowledged
    const unacknowledged = await db
      .select()
      .from(disclosureAcknowledgments)
      .where(
        and(
          eq(disclosureAcknowledgments.agreementId, agreementId),
          eq(disclosureAcknowledgments.acknowledged, false)
        )
      );

    if (unacknowledged.length > 0) {
      return NextResponse.json({
        error: 'All disclosures must be acknowledged before signing',
        unacknowledged: unacknowledged.map(d => d.disclosureType),
      }, { status: 400 });
    }

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    const signedAt = new Date();
    const cancellationDeadline = addBusinessDays(signedAt, 3); // CROA requires 3 business days

    // Update content with initials filled in
    let signedContent = agreement.content;
    if (initials && typeof initials === 'object') {
      Object.entries(initials).forEach(([field, value]) => {
        const placeholder = `{{${field}}}`;
        signedContent = signedContent.replace(
          new RegExp(placeholder, 'g'),
          `<span style="display: inline-block; padding: 2px 8px; background: #d4edda; border: 1px solid #28a745; border-radius: 3px; font-weight: bold;">${value}</span>`
        );
      });
    }

    // Add signature block
    const signatureBlock = `
      <div style="margin-top: 40px; padding: 20px; border-top: 2px solid #1a365d; background: #f8f9fa;">
        <h3 style="color: #1a365d; margin-top: 0;">ELECTRONIC SIGNATURE VERIFICATION</h3>
        <table style="width: 100%; font-size: 12px;">
          <tr>
            <td style="padding: 5px 0;"><strong>Signed By:</strong></td>
            <td>${client.firstName} ${client.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Email:</strong></td>
            <td>${client.email}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Date/Time:</strong></td>
            <td>${signedAt.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Signature Type:</strong></td>
            <td>${signatureType === 'drawn' ? 'Handwritten (Digital)' : 'Typed'}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>IP Address:</strong></td>
            <td>${ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Cancellation Deadline:</strong></td>
            <td style="color: #dc3545; font-weight: bold;">${cancellationDeadline.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
        </table>
        ${signatureType === 'drawn' 
          ? `<div style="margin-top: 15px;"><strong>Signature:</strong><br/><img src="${signatureData}" alt="Client Signature" style="max-width: 300px; border: 1px solid #ccc; margin-top: 5px;" /></div>`
          : `<div style="margin-top: 15px;"><strong>Typed Signature:</strong><br/><span style="font-family: 'Brush Script MT', cursive; font-size: 28px; color: #1a365d;">${signatureData}</span></div>`
        }
        <p style="font-size: 10px; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px;">
          This document was electronically signed in accordance with the U.S. Electronic Signatures in Global and National Commerce (ESIGN) Act.
          User Agent: ${userAgent}
        </p>
      </div>
    `;

    // Replace client signature placeholder and append verification block
    signedContent = signedContent.replace(
      '{{client_signature}}',
      signatureType === 'drawn' 
        ? `<img src="${signatureData}" alt="Signature" style="max-width: 200px;" />`
        : `<span style="font-family: 'Brush Script MT', cursive; font-size: 24px;">${signatureData}</span>`
    );
    signedContent += signatureBlock;

    // Update agreement
    await db
      .update(clientAgreements)
      .set({
        status: 'signed',
        content: signedContent,
        signedAt,
        signatureData: signatureType === 'typed' ? signatureData : 'drawn_signature',
        signatureType,
        signerIpAddress: ipAddress,
        signerUserAgent: userAgent,
        cancellationDeadline,
        updatedAt: new Date(),
      })
      .where(eq(clientAgreements.id, agreementId));

    return NextResponse.json({
      success: true,
      message: 'Agreement signed successfully',
      signed_at: signedAt.toISOString(),
      cancellation_deadline: cancellationDeadline.toISOString(),
    });
  } catch (error) {
    console.error('Error signing agreement:', error);
    return NextResponse.json({ error: 'Failed to sign agreement' }, { status: 500 });
  }
}

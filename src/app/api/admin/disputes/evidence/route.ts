import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { clientDocuments, clients, clientCases } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { getEvidenceRequirements } from '@/lib/dispute-evidence';

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

// GET /api/admin/disputes/evidence?clientId=xxx&documentTypes=id_document,proof_of_address
// Returns client documents filtered by optional document types
export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const documentTypesParam = searchParams.get('documentTypes');
  const reasonCodesParam = searchParams.get('reasonCodes');

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  try {
    // Get the client to find their user ID and cases
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get client's cases to find their documents
    const cases = await db
      .select()
      .from(clientCases)
      .where(client.userId ? eq(clientCases.userId, client.userId) : eq(clientCases.id, ''));

    const caseIds = cases.map(c => c.id);

    // Fetch documents - either from cases or by user ID
    type DocumentRow = typeof clientDocuments.$inferSelect;
    let documents: DocumentRow[] = [];
    
    if (caseIds.length > 0) {
      documents = await db
        .select()
        .from(clientDocuments)
        .where(inArray(clientDocuments.caseId, caseIds))
        .orderBy(desc(clientDocuments.createdAt));
    } else if (client.userId) {
      documents = await db
        .select()
        .from(clientDocuments)
        .where(eq(clientDocuments.userId, client.userId))
        .orderBy(desc(clientDocuments.createdAt));
    }

    // Parse document types filter
    const filterTypes: string[] = documentTypesParam 
      ? documentTypesParam.split(',').map(t => t.trim())
      : [];

    // Filter by document types if specified
    let filteredDocuments = documents;
    if (filterTypes.length > 0) {
      filteredDocuments = documents.filter(doc => 
        doc.fileType && filterTypes.includes(doc.fileType)
      );
    }

    // Get evidence requirements if reason codes provided
    let evidenceRequirements = null;
    if (reasonCodesParam) {
      const reasonCodes = reasonCodesParam.split(',').map(c => c.trim());
      evidenceRequirements = getEvidenceRequirements(reasonCodes);
    }

    return NextResponse.json({
      documents: filteredDocuments.map(doc => ({
        id: doc.id,
        file_name: doc.fileName,
        file_type: doc.fileType,
        file_url: doc.fileUrl,
        file_size: doc.fileSize,
        uploaded_by: doc.uploadedBy,
        notes: doc.notes,
        created_at: doc.createdAt?.toISOString(),
      })),
      total: filteredDocuments.length,
      evidence_requirements: evidenceRequirements,
      available_document_types: [
        { code: 'id_document', label: 'Government ID (Driver\'s License, Passport, etc.)' },
        { code: 'proof_of_address', label: 'Proof of Address (Utility Bill, Bank Statement)' },
        { code: 'police_report', label: 'Police Report' },
        { code: 'ftc_identity_theft_report', label: 'FTC Identity Theft Report' },
        { code: 'bank_statement', label: 'Bank Statement' },
        { code: 'payment_receipt', label: 'Payment Receipt or Confirmation' },
        { code: 'correspondence', label: 'Creditor/Bureau Correspondence' },
        { code: 'credit_report', label: 'Credit Report' },
        { code: 'dispute_letter', label: 'Previous Dispute Letter' },
        { code: 'other', label: 'Other Supporting Document' },
      ],
    });
  } catch (error) {
    console.error('Error fetching evidence documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evidence documents' },
      { status: 500 }
    );
  }
}

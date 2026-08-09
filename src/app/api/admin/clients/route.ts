import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, consultationRequests, user } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { desc, asc, count, eq, or, ilike, and } from 'drizzle-orm';
import { triggerAutomation } from '@/lib/email-service';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { sensitiveLimiter } from '@/lib/rate-limit';
import { encryptClientData, decryptClientData } from '@/lib/db-encryption';
import { randomUUID } from 'crypto';
import { logServerEvent } from '@/lib/server-logger';
import { readJsonBody, validationErrorResponse } from '@/lib/request-validation';
import { z } from 'zod';

const clientCreateSchema = z.object({
  first_name: z.string().trim().max(200).optional(),
  last_name: z.string().trim().max(200).optional(),
  email: z.string().trim().max(320).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(5_000).nullable().optional(),
  lead_id: z.uuid().nullable().optional(),
  user_id: z.string().trim().min(1).max(128).nullable().optional(),
  street_address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  zip_code: z.string().trim().max(20).nullable().optional(),
  date_of_birth: z.iso.date().nullable().optional(),
  ssn_last_4: z.string().trim().max(50).nullable().optional(),
}).strict();

async function getHandler(request: NextRequest) {
  const adminUser = await requireCapability('clients:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status');
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(clients.firstName, `%${search}%`),
          ilike(clients.lastName, `%${search}%`),
          ilike(clients.email, `%${search}%`),
          ilike(clients.phone, `%${search}%`)
        )
      );
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(clients.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    const sortColumn = sortBy === 'name' ? clients.firstName 
      : sortBy === 'email' ? clients.email
      : sortBy === 'status' ? clients.status
      : sortBy === 'converted_at' ? clients.convertedAt
      : clients.createdAt;
    
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: clients.id,
          userId: clients.userId,
          leadId: clients.leadId,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
          streetAddress: clients.streetAddress,
          city: clients.city,
          state: clients.state,
          zipCode: clients.zipCode,
          dateOfBirth: clients.dateOfBirth,
          ssnLast4: clients.ssnLast4,
          status: clients.status,
          notes: clients.notes,
          convertedAt: clients.convertedAt,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
          userName: user.name,
        })
        .from(clients)
        .leftJoin(user, eq(clients.userId, user.id))
        .where(whereClause)
        .orderBy(orderDirection(sortColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(clients).where(whereClause),
    ]);

    return NextResponse.json({
      items: items.map((c) => {
        // Decrypt client data
        const decrypted = decryptClientData({
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          streetAddress: c.streetAddress,
          city: c.city,
          state: c.state,
          zipCode: c.zipCode,
          dateOfBirth: c.dateOfBirth,
          ssnLast4: c.ssnLast4,
        });

        return {
          id: c.id,
          user_id: c.userId,
          lead_id: c.leadId,
          first_name: decrypted.firstName,
          last_name: decrypted.lastName,
          email: c.email,
          phone: decrypted.phone,
          street_address: decrypted.streetAddress,
          city: decrypted.city,
          state: decrypted.state,
          zip_code: decrypted.zipCode,
          status: c.status,
          notes: c.notes,
          converted_at: c.convertedAt?.toISOString(),
          created_at: c.createdAt?.toISOString(),
          updated_at: c.updatedAt?.toISOString(),
          user_name: c.userName,
        };
      }),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.clients.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

async function postHandler(request: NextRequest) {
  const adminUser = await requireCapability('clients:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const parsed = await readJsonBody(request, clientCreateSchema);
    if (parsed.kind !== 'valid') {
      return validationErrorResponse(parsed);
    }

    const { 
      first_name, 
      last_name, 
      email, 
      phone, 
      notes, 
      lead_id, 
      user_id,
      // New fields
      street_address,
      city,
      state,
      zip_code,
      date_of_birth,
      ssn_last_4
    } = parsed.data;

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    if (!z.email().safeParse(email).success) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    // Validate SSN last 4 if provided (must be exactly 4 digits)
    if (ssn_last_4 && !/^\d{4}$/.test(ssn_last_4)) {
      return NextResponse.json({ error: 'SSN last 4 must be exactly 4 digits' }, { status: 400 });
    }

    const now = new Date();

    // Encrypt PII fields before inserting
    const encrypted = encryptClientData({
      firstName: first_name,
      lastName: last_name,
      phone: phone || null,
      streetAddress: street_address || null,
      city: city || null,
      state: state || null,
      zipCode: zip_code || null,
      dateOfBirth: date_of_birth || null,
      ssnLast4: ssn_last_4 || null,
    });

    const [createdClient] = await db.insert(clients).values({
      id: randomUUID(),
      userId: user_id || null,
      leadId: lead_id || null,
      firstName: encrypted.firstName,
      lastName: encrypted.lastName,
      email,
      phone: encrypted.phone,
      streetAddress: encrypted.streetAddress,
      city: encrypted.city,
      state: encrypted.state,
      zipCode: encrypted.zipCode,
      dateOfBirth: encrypted.dateOfBirth,
      ssnLast4: encrypted.ssnLast4,
      status: 'active',
      notes: notes || null,
      convertedAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: clients.id });

    // If converting from a lead, update the lead status
    if (lead_id) {
      await db
        .update(consultationRequests)
        .set({ status: 'archived', updatedAt: now }) // Mark as archived when converted to client
        .where(eq(consultationRequests.id, lead_id));
    }

    // Send welcome email to new client
    try {
      await triggerAutomation('welcome', createdClient.id, {
        client_name: `${first_name} ${last_name}`,
        client_first_name: first_name,
        client_email: email,
      });
    } catch (emailError) {
      // Log but don't fail the request
      logServerEvent({ level: 'error', event: 'server.app.api.admin.clients.error', error: emailError });
    }

    return NextResponse.json({
      id: createdClient.id,
      first_name: first_name,
      last_name: last_name,
      email,
      phone: phone || null,
      status: 'active',
      notes,
      lead_id,
      user_id,
      converted_at: now.toISOString(),
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.clients.error', error: error });
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}

// Export rate-limited handlers
export const GET = rateLimited(sensitiveLimiter)(getHandler);
export const POST = rateLimited(sensitiveLimiter)(postHandler);

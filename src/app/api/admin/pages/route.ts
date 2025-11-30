import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { pages } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, count } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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

export async function GET(request: NextRequest) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const [items, totalResult] = await Promise.all([
      db.select().from(pages).orderBy(desc(pages.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(pages),
    ]);

    return NextResponse.json({
      items: items.map(p => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        hero_headline: p.heroHeadline,
        hero_subheadline: p.heroSubheadline,
        main_content_json: p.mainContentJson,
        cta_text: p.ctaText,
        cta_link: p.ctaLink,
        meta_title: p.metaTitle,
        meta_description: p.metaDescription,
        is_published: p.isPublished,
        created_at: p.createdAt?.toISOString(),
        updated_at: p.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();

    await db.insert(pages).values({
      id,
      slug: body.slug,
      title: body.title,
      heroHeadline: body.hero_headline,
      heroSubheadline: body.hero_subheadline,
      mainContentJson: body.main_content_json,
      ctaText: body.cta_text,
      ctaLink: body.cta_link,
      metaTitle: body.meta_title,
      metaDescription: body.meta_description,
      isPublished: body.is_published ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      slug: body.slug,
      title: body.title,
      hero_headline: body.hero_headline,
      hero_subheadline: body.hero_subheadline,
      main_content_json: body.main_content_json,
      cta_text: body.cta_text,
      cta_link: body.cta_link,
      meta_title: body.meta_title,
      meta_description: body.meta_description,
      is_published: body.is_published ?? false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating page:', error);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}

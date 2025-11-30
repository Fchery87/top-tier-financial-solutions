import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { pages } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq } from 'drizzle-orm';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.hero_headline !== undefined) updateData.heroHeadline = body.hero_headline;
    if (body.hero_subheadline !== undefined) updateData.heroSubheadline = body.hero_subheadline;
    if (body.main_content_json !== undefined) updateData.mainContentJson = body.main_content_json;
    if (body.cta_text !== undefined) updateData.ctaText = body.cta_text;
    if (body.cta_link !== undefined) updateData.ctaLink = body.cta_link;
    if (body.meta_title !== undefined) updateData.metaTitle = body.meta_title;
    if (body.meta_description !== undefined) updateData.metaDescription = body.meta_description;
    if (body.is_published !== undefined) updateData.isPublished = body.is_published;

    await db.update(pages).set(updateData).where(eq(pages.id, id));

    const [updated] = await db.select().from(pages).where(eq(pages.id, id));

    if (!updated) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      hero_headline: updated.heroHeadline,
      hero_subheadline: updated.heroSubheadline,
      main_content_json: updated.mainContentJson,
      cta_text: updated.ctaText,
      cta_link: updated.ctaLink,
      meta_title: updated.metaTitle,
      meta_description: updated.metaDescription,
      is_published: updated.isPublished,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating page:', error);
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [existing] = await db.select().from(pages).where(eq(pages.id, id));
    
    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    await db.delete(pages).where(eq(pages.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}

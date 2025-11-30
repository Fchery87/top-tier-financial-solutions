import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { blogPosts } from '@/db/schema';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const posts = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    
    if (posts.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const p = posts[0];
    return NextResponse.json({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      featured_image: p.featuredImage,
      category_id: p.categoryId,
      author_id: p.authorId,
      meta_title: p.metaTitle,
      meta_description: p.metaDescription,
      is_published: p.isPublished,
      is_featured: p.isFeatured,
      published_at: p.publishedAt?.toISOString(),
      created_at: p.createdAt?.toISOString(),
      updated_at: p.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return NextResponse.json({ error: 'Failed to fetch blog post' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const now = new Date();

    // Check if post exists
    const existing = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // If publishing for first time, set publishedAt
    const wasPublished = existing[0].isPublished;
    const isNowPublished = body.is_published ?? existing[0].isPublished;
    const publishedAt = !wasPublished && isNowPublished ? now : existing[0].publishedAt;

    await db.update(blogPosts).set({
      title: body.title ?? existing[0].title,
      slug: body.slug ?? existing[0].slug,
      excerpt: body.excerpt ?? existing[0].excerpt,
      content: body.content ?? existing[0].content,
      featuredImage: body.featured_image ?? existing[0].featuredImage,
      categoryId: body.category_id ?? existing[0].categoryId,
      metaTitle: body.meta_title ?? existing[0].metaTitle,
      metaDescription: body.meta_description ?? existing[0].metaDescription,
      isPublished: body.is_published ?? existing[0].isPublished,
      isFeatured: body.is_featured ?? existing[0].isFeatured,
      publishedAt,
      updatedAt: now,
    }).where(eq(blogPosts.id, id));

    return NextResponse.json({ success: true, updated_at: now.toISOString() });
  } catch (error) {
    console.error('Error updating blog post:', error);
    return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { blogPosts, blogCategories, user } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { desc, count, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { logServerEvent } from '@/lib/server-logger';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function GET(request: NextRequest) {
  const adminUser = await requireCapability('content:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          content: blogPosts.content,
          featuredImage: blogPosts.featuredImage,
          categoryId: blogPosts.categoryId,
          categoryName: blogCategories.name,
          authorId: blogPosts.authorId,
          authorName: user.name,
          metaTitle: blogPosts.metaTitle,
          metaDescription: blogPosts.metaDescription,
          isPublished: blogPosts.isPublished,
          isFeatured: blogPosts.isFeatured,
          publishedAt: blogPosts.publishedAt,
          createdAt: blogPosts.createdAt,
          updatedAt: blogPosts.updatedAt,
        })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
        .leftJoin(user, eq(blogPosts.authorId, user.id))
        .orderBy(desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(blogPosts),
    ]);

    return NextResponse.json({
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        content: p.content,
        featured_image: p.featuredImage,
        category_id: p.categoryId,
        category_name: p.categoryName,
        author_id: p.authorId,
        author_name: p.authorName,
        meta_title: p.metaTitle,
        meta_description: p.metaDescription,
        is_published: p.isPublished,
        is_featured: p.isFeatured,
        published_at: p.publishedAt?.toISOString(),
        created_at: p.createdAt?.toISOString(),
        updated_at: p.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.blog.posts.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('content:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();
    const slug = body.slug || slugify(body.title);

    await db.insert(blogPosts).values({
      id,
      title: body.title,
      slug,
      excerpt: body.excerpt,
      content: body.content,
      featuredImage: body.featured_image,
      categoryId: body.category_id || null,
      authorId: adminUser.id,
      metaTitle: body.meta_title,
      metaDescription: body.meta_description,
      isPublished: body.is_published ?? false,
      isFeatured: body.is_featured ?? false,
      publishedAt: body.is_published ? now : null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      title: body.title,
      slug,
      is_published: body.is_published ?? false,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.blog.posts.error', error: error });
    return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
  }
}

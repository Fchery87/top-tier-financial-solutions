import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { blogPosts, blogCategories, user } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const _category = searchParams.get('category');
  const offset = (page - 1) * limit;

  try {
    const query = db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        featuredImage: blogPosts.featuredImage,
        categoryId: blogPosts.categoryId,
        categoryName: blogCategories.name,
        categorySlug: blogCategories.slug,
        authorName: user.name,
        publishedAt: blogPosts.publishedAt,
        isFeatured: blogPosts.isFeatured,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .leftJoin(user, eq(blogPosts.authorId, user.id))
      .where(eq(blogPosts.isPublished, true))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);

    const posts = await query;

    // Get categories for filtering
    const categories = await db.select().from(blogCategories).orderBy(blogCategories.orderIndex);

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        featured_image: p.featuredImage,
        category: p.categoryName ? { name: p.categoryName, slug: p.categorySlug } : null,
        author_name: p.authorName,
        published_at: p.publishedAt?.toISOString(),
        is_featured: p.isFeatured,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

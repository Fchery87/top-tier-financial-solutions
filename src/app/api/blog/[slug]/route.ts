import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { blogPosts, blogCategories, user } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        content: blogPosts.content,
        featuredImage: blogPosts.featuredImage,
        categoryId: blogPosts.categoryId,
        categoryName: blogCategories.name,
        categorySlug: blogCategories.slug,
        authorName: user.name,
        metaTitle: blogPosts.metaTitle,
        metaDescription: blogPosts.metaDescription,
        publishedAt: blogPosts.publishedAt,
        isPublished: blogPosts.isPublished,
      })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .leftJoin(user, eq(blogPosts.authorId, user.id))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)))
      .limit(1);

    if (posts.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const p = posts[0];
    return NextResponse.json({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      featured_image: p.featuredImage,
      category: p.categoryName ? { name: p.categoryName, slug: p.categorySlug } : null,
      author_name: p.authorName,
      meta_title: p.metaTitle,
      meta_description: p.metaDescription,
      published_at: p.publishedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}

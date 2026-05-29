import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Calendar, User, Tag, ArrowRight, Sparkles } from 'lucide-react';
import { FadeIn, SlideUp } from '@/components/ui/Motion';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { sanitizeHtml } from '@/lib/safe-html';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  category: { name: string; slug: string } | null;
  author_name: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/blog/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  
  if (!post) {
    return { title: 'Post Not Found' };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="platform-shell flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="absolute inset-0 rule-grid opacity-25" />
        <div className="absolute inset-x-0 top-0 h-px bg-secondary/35" />

        <div className="container relative z-10 mx-auto max-w-4xl px-4 md:px-6">
          <FadeIn>
            <Link 
              href="/blog" 
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </FadeIn>

          <SlideUp delay={0.1}>
            {post.category && (
              <span className="mb-6 inline-flex items-center gap-2 rounded-md border border-secondary/25 bg-accent/70 px-3 py-2 text-sm font-medium text-secondary">
                <Tag className="w-4 h-4" />
                {post.category.name}
              </span>
            )}
          </SlideUp>

          <SlideUp delay={0.2}>
            <h1 className="mb-6 font-display text-4xl font-medium leading-[0.98] tracking-[-0.05em] text-foreground md:text-5xl lg:text-6xl">
              {post.title}
            </h1>
          </SlideUp>

          <SlideUp delay={0.3}>
            <div className="flex flex-wrap items-center gap-6 border-t border-border/80 pt-5 text-sm text-muted-foreground">
              {post.author_name && (
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {post.author_name}
                </span>
              )}
              {post.published_at && (
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(post.published_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </SlideUp>
        </div>
      </section>

      {/* Content */}
      <section className="bg-background py-12 md:py-16">
        <div className="container mx-auto max-w-4xl px-4 md:px-6">
          <FadeIn>
            <article className="surface-document max-w-none rounded-lg px-6 py-8 md:px-10 md:py-12">
              <div 
                className="text-[1.02rem] leading-8 text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content).replace(/\n/g, '<br />') }}
              />
            </article>
          </FadeIn>

          {/* Newsletter Signup */}
          <SlideUp delay={0.2} className="mt-16">
            <NewsletterSignup 
              title="Stay Informed"
              description="Get the latest credit tips and financial insights delivered to your inbox."
              source="blog"
            />
          </SlideUp>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-[#100E0C] py-24 md:py-32">
        <div className="absolute inset-0 rule-grid opacity-[0.08]" />
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-secondary/40" />
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <SlideUp>
            <h2 className="mb-6 font-display text-3xl font-medium tracking-[-0.04em] text-white md:text-5xl">
              Need <span className="text-secondary">Expert Help</span>?
            </h2>
          </SlideUp>
          <SlideUp delay={0.2}>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-10">
              Our credit repair specialists are ready to help you take control of your financial future.
            </p>
          </SlideUp>
          <SlideUp delay={0.4}>
            <Button asChild size="lg" className="h-12 rounded-md bg-secondary px-8 text-secondary-foreground hover:bg-secondary/90">
              <Link href="/contact" className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Book Free Consultation
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </SlideUp>
        </div>
      </section>
    </div>
  );
}

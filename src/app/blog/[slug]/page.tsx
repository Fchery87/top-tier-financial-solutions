import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Calendar, User, Tag, ArrowRight, Sparkles } from 'lucide-react';
import { FadeIn, SlideUp } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay, AuroraBackground, ParticleField } from '@/components/ui/AnimatedBackground';
import { NewsletterSignup } from '@/components/NewsletterSignup';

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
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden">
        <GradientOrbs className="opacity-50" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background z-[1]" />

        <div className="container relative z-10 mx-auto px-4 md:px-6 max-w-4xl">
          <FadeIn>
            <Link 
              href="/blog" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-secondary transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </FadeIn>

          <SlideUp delay={0.1}>
            {post.category && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 text-secondary text-sm font-medium mb-6">
                <Tag className="w-4 h-4" />
                {post.category.name}
              </span>
            )}
          </SlideUp>

          <SlideUp delay={0.2}>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6 text-foreground leading-tight">
              {post.title}
            </h1>
          </SlideUp>

          <SlideUp delay={0.3}>
            <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
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
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <FadeIn>
            <article className="prose prose-lg prose-invert max-w-none">
              <div 
                className="text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
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
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <AuroraBackground className="opacity-60" />
        <ParticleField count={15} className="opacity-40" />
        <NoiseOverlay opacity={0.03} />
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <SlideUp>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6 text-white">
              Need <span className="text-gradient-gold">Expert Help</span>?
            </h2>
          </SlideUp>
          <SlideUp delay={0.2}>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-10">
              Our credit repair specialists are ready to help you take control of your financial future.
            </p>
          </SlideUp>
          <SlideUp delay={0.4}>
            <Button asChild size="lg" className="h-14 px-10 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full">
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

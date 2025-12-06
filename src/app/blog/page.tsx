import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Calendar, User, BookOpen, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem, ScaleIn } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay, AuroraBackground, ParticleField } from '@/components/ui/AnimatedBackground';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  category: { name: string; slug: string } | null;
  author_name: string | null;
  published_at: string | null;
  is_featured: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

async function getBlogPosts(): Promise<{ posts: BlogPost[]; categories: Category[] }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/blog?limit=12`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return { posts: [], categories: [] };
  }
}

export default async function BlogPage() {
  const { posts, categories: _categories } = await getBlogPosts();
  const featuredPosts = posts.filter((p) => p.is_featured);
  const regularPosts = posts.filter((p) => !p.is_featured);

  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Credit Education"
        title="Financial"
        titleHighlight="Insights"
        description="Expert advice, tips, and resources to help you understand credit repair and build a stronger financial future."
        variant="dramatic"
      />

      {/* Featured Posts */}
      {featuredPosts.length > 0 && (
        <section className="py-16 bg-background relative overflow-hidden">
          <GradientOrbs className="opacity-30" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <FadeIn className="mb-10">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                Featured <span className="text-gradient-gold">Articles</span>
              </h2>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredPosts.slice(0, 2).map((post, i) => (
                <ScaleIn key={post.id} delay={i * 0.1}>
                  <Link href={`/blog/${post.slug}`}>
                    <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-300 overflow-hidden group">
                      {post.featured_image && (
                        <div className="aspect-video bg-muted/30 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
                        </div>
                      )}
                      <CardContent className="p-6">
                        {post.category && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-medium mb-4">
                            {post.category.name}
                          </span>
                        )}
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-foreground mb-3 group-hover:text-secondary transition-colors">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-muted-foreground line-clamp-2 mb-4">{post.excerpt}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {post.author_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {post.author_name}
                            </span>
                          )}
                          {post.published_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(post.published_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </ScaleIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Posts */}
      <section className="py-16 md:py-24 bg-background relative overflow-hidden">
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-8 h-8 text-secondary" />
              </div>
              <h2 className="text-2xl font-serif font-bold mb-4 text-foreground">Coming Soon</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                We&apos;re working on creating valuable content to help you on your credit repair journey. Check back soon!
              </p>
              <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Link href="/contact">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Expert Help Now
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <FadeIn className="mb-10">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                  Latest <span className="text-gradient-gold">Articles</span>
                </h2>
              </FadeIn>

              <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(regularPosts.length > 0 ? regularPosts : posts).map((post, _i) => (
                  <StaggerItem key={post.id}>
                    <Link href={`/blog/${post.slug}`}>
                      <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-300 group">
                        <CardContent className="p-6">
                          {post.category && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium mb-4">
                              {post.category.name}
                            </span>
                          )}
                          <h3 className="text-lg font-serif font-bold text-foreground mb-3 group-hover:text-secondary transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{post.excerpt}</p>
                          )}
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            {post.published_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(post.published_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-secondary group-hover:translate-x-1 transition-transform">
                              Read More <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </>
          )}
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6 text-white">
              Ready to Start Your <span className="text-gradient-gold">Journey</span>?
            </h2>
          </SlideUp>
          <SlideUp delay={0.2}>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
              Don&apos;t just read about credit repair - take action. Book a free consultation today.
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

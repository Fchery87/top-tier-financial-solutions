import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Star, Shield, TrendingUp, Users, ArrowRight, CheckCircle, Sparkles, ChevronRight, Zap, Award } from 'lucide-react';
import { getTestimonials, Testimonial } from '@/lib/api';
import { FadeIn, SlideUp, SlideIn, StaggerContainer, StaggerItem, ScaleIn, BlurIn, TiltCard, GlowCard, MagneticHover } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, ParticleField, NoiseOverlay, AuroraBackground } from '@/components/ui/AnimatedBackground';

const fallbackTestimonials = [
  {
    id: '1',
    author_name: "Sarah Jenkins",
    author_location: "New York, NY",
    quote: "Top Tier Financial Solutions changed my life. I was able to buy my first home after they helped me clean up my credit report. The process was seamless and transparent.",
  },
  {
    id: '2',
    author_name: "Michael Torres",
    author_location: "Miami, FL",
    quote: "Professional, transparent, and effective. They explained everything clearly and got results faster than I expected. My score jumped 80 points in just three months.",
  },
  {
    id: '3',
    author_name: "Jessica Reynolds",
    author_location: "Chicago, IL",
    quote: "I was skeptical at first, but the team at Top Tier proved me wrong. My score went up 100 points in 4 months! I highly recommend their services to anyone struggling with credit.",
  }
];

export default async function Home() {
  let testimonials: Testimonial[] = [];
  
  try {
    testimonials = await getTestimonials();
  } catch {
    // Use fallback testimonials if API fails
  }
  
  const displayTestimonials = testimonials.length > 0 ? testimonials : fallbackTestimonials;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Hero Section - Dramatic & Captivating */}
      <section className="relative min-h-screen flex items-center justify-center pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden">
        {/* Animated Background Elements */}
        <GradientOrbs />
        <AnimatedGrid />
        <ParticleField count={25} />
        <NoiseOverlay opacity={0.02} />
        
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background z-[1]" />

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center max-w-6xl mx-auto">
            {/* Badge with glow effect */}
            <BlurIn duration={0.8} className="mb-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md group-hover:bg-secondary/30 transition-colors" />
                <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-background/80 backdrop-blur-sm border border-secondary/30 text-foreground text-sm font-medium uppercase tracking-widest">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                  </span>
                  Premium Financial Restoration
                  <Sparkles className="w-4 h-4 text-secondary" />
                </div>
              </div>
            </BlurIn>
            
            {/* Main Headline with dramatic styling */}
            <SlideUp delay={0.2} className="mb-8">
              <h1 className="text-5xl md:text-7xl lg:text-[6rem] xl:text-[7rem] font-serif font-bold tracking-tight leading-[0.95]">
                <span className="block text-foreground">Wealth is a</span>
                <span className="block text-gradient-gold italic my-2">Mindset</span>
                <span className="block text-foreground">Credit is the</span>
                <span className="block text-gradient-gold italic">Key</span>
              </h1>
            </SlideUp>
            
            {/* Decorative line */}
            <SlideUp delay={0.35}>
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-secondary/50" />
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-secondary/50" />
              </div>
            </SlideUp>
            
            {/* Subheadline */}
            <SlideUp delay={0.4} className="mb-12 max-w-2xl">
              <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground font-light leading-relaxed">
                We don&apos;t just repair credit; we <span className="text-foreground font-medium">architect financial futures</span>. Join the elite circle who have reclaimed their power.
              </p>
            </SlideUp>
            
            {/* CTA Buttons with premium styling */}
            <SlideUp delay={0.6} className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
              <MagneticHover strength={0.15}>
                <Button asChild size="lg" className="h-16 px-12 text-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full shadow-[0_0_40px_-10px_rgba(198,168,124,0.6)] transition-all duration-500 hover:shadow-[0_0_60px_-10px_rgba(198,168,124,0.8)] hover:scale-105 btn-premium">
                  <Link href="/contact" className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5" />
                    Start Your Transformation
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </Button>
              </MagneticHover>
              <MagneticHover strength={0.15}>
                <Button asChild variant="outline" size="lg" className="h-16 px-12 text-lg border-border/50 bg-background/50 hover:bg-secondary/10 hover:border-secondary/50 rounded-full backdrop-blur-sm transition-all duration-500">
                  <Link href="/how-it-works" className="flex items-center gap-3">
                    How We Work
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
              </MagneticHover>
            </SlideUp>
            
            {/* Floating trust indicators */}
            <SlideUp delay={0.8} className="mt-16">
              <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
                {[
                  { icon: Shield, text: "100% Compliant" },
                  { icon: Award, text: "2,500+ Success Stories" },
                  { icon: Zap, text: "Results in 30 Days" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 backdrop-blur-sm border border-border/30">
                    <item.icon className="w-4 h-4 text-secondary" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </SlideUp>
          </div>
        </div>
        
        {/* Bottom fade gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-[2]" />
      </section>

      {/* Stats / Trust Section - Elevated Design */}
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <div className="absolute inset-0 bg-dot-pattern opacity-30" />
        
        <div className="container relative z-10 mx-auto px-4">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { label: "Credit Score Avg Increase", value: "100+", suffix: "pts" },
              { label: "Negative Items Removed", value: "15k+", suffix: "" },
              { label: "Satisfied Clients", value: "2,500+", suffix: "" },
              { label: "Success Rate", value: "98", suffix: "%" },
            ].map((stat, i) => (
              <StaggerItem key={i}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-secondary/5 rounded-2xl blur-xl group-hover:bg-secondary/10 transition-colors duration-500" />
                  <div className="relative flex flex-col items-center text-center p-6 md:p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 group-hover:border-secondary/30 transition-all duration-500">
                    <span className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gradient-gold mb-2">
                      {stat.value}<span className="text-secondary/70">{stat.suffix}</span>
                    </span>
                    <span className="text-xs md:text-sm uppercase tracking-widest text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Features / Value Proposition - Premium Design */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <GradientOrbs className="opacity-50" />
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-start">
            <div className="lg:w-2/5 lg:sticky lg:top-32">
              <SlideIn direction="left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-foreground/80 text-sm font-medium mb-6">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  Why Choose Us
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 text-foreground leading-[1.1]">
                  Precision.<br />
                  Expertise.<br />
                  <span className="text-gradient-gold">Results.</span>
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-10">
                  Our methodology goes beyond dispute letters. We use a multi-faceted legal approach to challenge inaccuracies and verify every piece of data on your report.
                </p>
                <ul className="space-y-5">
                  {[
                    "Advanced Dispute Tactics",
                    "24/7 Client Portal Access",
                    "Personalized Credit Coaching",
                    "Debt Settlement Negotiation"
                  ].map((item, i) => (
                    <SlideUp key={i} delay={i * 0.1}>
                      <li className="flex items-center gap-4 text-foreground group">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                          <CheckCircle className="w-5 h-5 text-secondary" />
                        </div>
                        <span className="font-medium">{item}</span>
                      </li>
                    </SlideUp>
                  ))}
                </ul>
              </SlideIn>
            </div>
            
            <div className="lg:w-3/5">
              <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StaggerItem className="md:col-span-2">
                  <TiltCard>
                    <Card className="h-full p-8 md:p-10 bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-secondary/10 group overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-secondary/10 transition-colors duration-500" />
                      <div className="relative z-10">
                        <div className="mb-6 p-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary flex items-center justify-center group-hover:from-secondary group-hover:to-secondary/80 group-hover:text-white transition-all duration-500 shadow-lg">
                          <Shield className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4 text-foreground">Legally Compliant Protection</h3>
                        <p className="text-muted-foreground leading-relaxed text-lg">
                          We operate strictly within the bounds of the FCRA, CROA, and FDCPA. Your restoration is built on a solid legal foundation, ensuring permanent and compliant results.
                        </p>
                      </div>
                    </Card>
                  </TiltCard>
                </StaggerItem>
                <StaggerItem>
                  <TiltCard>
                    <Card className="h-full p-8 bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-secondary/10 group overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/5 rounded-full blur-2xl group-hover:bg-secondary/10 transition-colors duration-500" />
                      <div className="relative z-10">
                        <div className="mb-6 p-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary flex items-center justify-center group-hover:from-secondary group-hover:to-secondary/80 group-hover:text-white transition-all duration-500 shadow-lg">
                          <TrendingUp className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-serif font-bold mb-3 text-foreground">Data-Driven Strategy</h3>
                        <p className="text-muted-foreground leading-relaxed">
                          Our algorithms identify the most impactful negative items to challenge first, maximizing your score improvement quickly.
                        </p>
                      </div>
                    </Card>
                  </TiltCard>
                </StaggerItem>
                <StaggerItem>
                  <TiltCard>
                    <Card className="h-full p-8 bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-secondary/10 group overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/5 rounded-full blur-2xl group-hover:bg-secondary/10 transition-colors duration-500" />
                      <div className="relative z-10">
                        <div className="mb-6 p-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary flex items-center justify-center group-hover:from-secondary group-hover:to-secondary/80 group-hover:text-white transition-all duration-500 shadow-lg">
                          <Users className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-serif font-bold mb-3 text-foreground">Dedicated Specialist</h3>
                        <p className="text-muted-foreground leading-relaxed">
                          You&apos;re not just a number. Get a direct line to a dedicated specialist who knows your case inside and out.
                        </p>
                      </div>
                    </Card>
                  </TiltCard>
                </StaggerItem>
              </StaggerContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Premium Glass Design */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        <AnimatedGrid className="opacity-20" />
        <GradientOrbs className="opacity-30" />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-foreground/80 text-sm font-medium mb-6">
              <Star className="w-4 h-4 text-secondary fill-secondary" />
              Client Success Stories
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">
              Real People, <span className="text-gradient-gold">Real Results</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Join thousands of clients who have successfully restored their credit and reclaimed their financial opportunities.
            </p>
          </FadeIn>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {displayTestimonials.map((testimonial, i) => (
              <ScaleIn key={testimonial.id} delay={i * 0.15}>
                <GlowCard className="h-full">
                  <Card className="h-full p-8 border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden group hover:border-secondary/30 transition-all duration-500">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-secondary/10 to-transparent rounded-bl-full -mr-10 -mt-10 group-hover:from-secondary/20 transition-colors duration-500" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-secondary/5 to-transparent rounded-tr-full -ml-8 -mb-8" />
                    
                    <div className="relative z-10">
                      {/* Star rating */}
                      <div className="flex gap-1 mb-6">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className="h-5 w-5 fill-secondary text-secondary drop-shadow-[0_0_3px_rgba(198,168,124,0.5)]" />
                        ))}
                      </div>
                      
                      {/* Quote */}
                      <blockquote className="text-lg text-foreground/90 font-light leading-relaxed mb-8 relative">
                        <span className="text-5xl text-secondary/20 font-serif absolute -top-4 -left-2">&ldquo;</span>
                        <span className="relative z-10">{testimonial.quote}</span>
                      </blockquote>
                      
                      {/* Author */}
                      <div className="flex items-center gap-4 pt-6 border-t border-border/50">
                        <div className="relative">
                          <div className="absolute inset-0 bg-secondary/30 rounded-full blur-md" />
                          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold font-serif text-lg shadow-lg">
                            {testimonial.author_name.charAt(0)}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{testimonial.author_name}</p>
                          {testimonial.author_location && (
                            <p className="text-sm text-muted-foreground">{testimonial.author_location}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </GlowCard>
              </ScaleIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Dramatic Finale */}
      <section className="py-32 md:py-40 relative overflow-hidden">
        {/* Multi-layered background */}
        <div className="absolute inset-0 bg-primary" />
        <AuroraBackground className="opacity-60" />
        <ParticleField count={20} className="opacity-40" />
        <NoiseOverlay opacity={0.03} />
        
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[150px] animate-breathe" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[120px] animate-breathe" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <BlurIn duration={1}>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4 text-secondary" />
              Limited Availability
            </div>
          </BlurIn>
          
          <SlideUp delay={0.2}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-8 text-white leading-[1.1]">
              Your Legacy Begins<br />
              <span className="text-gradient-gold">Today</span>.
            </h2>
          </SlideUp>
          
          <SlideUp delay={0.4}>
            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              Don&apos;t let past mistakes define your future. Take the first step towards financial freedom with a free, no-obligation consultation.
            </p>
          </SlideUp>
          
          <SlideUp delay={0.6}>
            <MagneticHover strength={0.2}>
              <Button asChild size="lg" className="h-16 md:h-20 px-12 md:px-16 text-lg md:text-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full shadow-[0_0_60px_rgba(198,168,124,0.4)] hover:shadow-[0_0_80px_rgba(198,168,124,0.6)] transition-all duration-500 hover:scale-105 btn-premium">
                <Link href="/contact" className="flex items-center gap-4">
                  <Sparkles className="w-6 h-6" />
                  Book Your Free Strategy Call
                  <ArrowRight className="w-6 h-6" />
                </Link>
              </Button>
            </MagneticHover>
          </SlideUp>
          
          {/* Trust badges */}
          <SlideUp delay={0.8}>
            <div className="flex flex-wrap justify-center gap-6 mt-16 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-secondary" />
                <span>100% Confidential</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-secondary" />
                <span>No Obligation</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-secondary" />
                <span>Results Guaranteed</span>
              </div>
            </div>
          </SlideUp>
        </div>
      </section>
    </div>
  );
}

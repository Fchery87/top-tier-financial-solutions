import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Search, FileText, TrendingUp, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { FadeIn, SlideUp, SlideIn, StaggerContainer, StaggerItem, ScaleIn, TiltCard } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay, AuroraBackground, ParticleField } from '@/components/ui/AnimatedBackground';

export default function HowItWorksPage() {
  const steps = [
    {
      icon: Search,
      step: "01",
      title: "Analysis & Onboarding",
      description: "We start by pulling your credit reports from all three bureaus. Our team analyzes them line-by-line to identify negative items that can be disputed."
    },
    {
      icon: FileText,
      step: "02",
      title: "Dispute & Challenge",
      description: "We create custom dispute letters citing specific consumer protection laws. We send these to the credit bureaus and creditors on your behalf."
    },
    {
      icon: TrendingUp,
      step: "03",
      title: "Monitor & Optimize",
      description: "We track the results of our disputes. As items are removed, you'll see changes in your credit report. We continue optimizing until you reach your goals."
    }
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Our Process"
        title="How It"
        titleHighlight="Works"
        description="Our proven three-step process is designed to be transparent, effective, and hassle-free. Here is what you can expect when you work with us."
        variant="dramatic"
      />

      {/* Steps Section */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <GradientOrbs className="opacity-40" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent -translate-y-1/2" />
          
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <StaggerItem key={index}>
                <ScaleIn delay={index * 0.2}>
                  <TiltCard>
                    <Card className="h-full p-8 md:p-10 bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-500 group relative overflow-hidden text-center">
                      <div className="absolute top-4 right-4 text-6xl md:text-7xl font-serif font-bold text-secondary/10 group-hover:text-secondary/20 transition-colors">
                        {step.step}
                      </div>
                      <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors duration-500" />
                      
                      <div className="relative z-10">
                        <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary to-secondary/70 text-primary flex items-center justify-center shadow-lg shadow-secondary/30 group-hover:shadow-secondary/50 transition-shadow">
                          <step.icon className="h-10 w-10" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold mb-4 text-foreground">{step.title}</h3>
                        <p className="text-muted-foreground leading-relaxed text-lg">
                          {step.description}
                        </p>
                      </div>
                    </Card>
                  </TiltCard>
                </ScaleIn>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        <GradientOrbs className="opacity-30" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <SlideIn direction="left">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-secondary/10 border border-secondary/20 text-foreground text-sm font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                  </span>
                  Why Top Tier
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-[1.1]">
                  Why Choose <span className="text-gradient-gold">Top Tier</span>?
                </h2>
                <ul className="space-y-5">
                  {[
                    "No hidden fees or long-term contracts",
                    "24/7 access to your client portal",
                    "Money-back guarantee policy",
                    "Dedicated case manager for every client"
                  ].map((item, i) => (
                    <SlideUp key={i} delay={i * 0.1}>
                      <li className="flex items-center gap-4 text-foreground group">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                          <CheckCircle className="w-5 h-5 text-secondary" />
                        </div>
                        <span className="font-medium text-lg">{item}</span>
                      </li>
                    </SlideUp>
                  ))}
                </ul>
                <SlideUp delay={0.5}>
                  <Button asChild size="lg" className="h-14 px-10 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full shadow-lg shadow-secondary/30 hover:shadow-secondary/50 transition-all hover:scale-105">
                    <Link href="/contact" className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5" />
                      Start Your Journey
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Button>
                </SlideUp>
              </div>
            </SlideIn>
            
            <SlideIn direction="right">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-secondary/20 to-secondary/5 rounded-3xl blur-3xl animate-breathe" />
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 shadow-2xl group">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
                </div>
              </div>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 md:py-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <AuroraBackground className="opacity-60" />
        <ParticleField count={15} className="opacity-40" />
        <NoiseOverlay opacity={0.03} />
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px] animate-breathe" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <SlideUp>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-8 text-white leading-[1.1]">
              Ready to <span className="text-gradient-gold">Transform</span> Your Credit?
            </h2>
          </SlideUp>
          <SlideUp delay={0.2}>
            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 font-light">
              Take the first step towards financial freedom today.
            </p>
          </SlideUp>
          <SlideUp delay={0.4}>
            <Button asChild size="lg" className="h-16 md:h-20 px-12 md:px-16 text-lg md:text-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full shadow-[0_0_60px_rgba(198,168,124,0.4)] hover:shadow-[0_0_80px_rgba(198,168,124,0.6)] transition-all duration-500 hover:scale-105 btn-premium">
              <Link href="/contact" className="flex items-center gap-4">
                <Sparkles className="w-6 h-6" />
                Book Free Consultation
                <ArrowRight className="w-6 h-6" />
              </Link>
            </Button>
          </SlideUp>
        </div>
      </section>
    </div>
  );
}

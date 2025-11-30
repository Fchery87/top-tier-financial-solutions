import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Check, FileSearch, FileText, TrendingUp, GraduationCap, ArrowRight, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem, GlowCard, TiltCard, ScaleIn } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay, AuroraBackground, ParticleField } from '@/components/ui/AnimatedBackground';

const services = [
  {
    icon: FileSearch,
    title: "Credit Report Analysis",
    description: "A comprehensive review of your credit reports from all three major bureaus (Equifax, Experian, TransUnion) to identify inaccuracies.",
    features: ["Detailed line-by-line analysis", "Identification of negative items", "Strategy development", "Risk assessment"]
  },
  {
    icon: FileText,
    title: "Dispute Processing",
    description: "We prepare and send custom dispute letters to credit bureaus and creditors on your behalf to challenge unverifiable information.",
    features: ["Customized dispute letters", "Bureau communication", "Creditor interventions", "Legal compliance"]
  },
  {
    icon: TrendingUp,
    title: "Score Tracking & Monitoring",
    description: "Stay updated on your progress with regular updates and score monitoring throughout the repair process.",
    features: ["Monthly progress reports", "Score change alerts", "Portal access", "Real-time updates"]
  },
  {
    icon: GraduationCap,
    title: "Credit Education",
    description: "Learn how to build and maintain a healthy credit profile with our educational resources and personalized advice.",
    features: ["Budgeting tips", "Credit building strategies", "Debt management advice", "Long-term planning"]
  }
];

export default function ServicesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        badge="What We Offer"
        title="Our Premium"
        titleHighlight="Services"
        description="Comprehensive credit repair solutions designed to help you improve your credit score and achieve financial stability."
        variant="dramatic"
      />

      {/* Services Grid - Premium Design */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <GradientOrbs className="opacity-40" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {services.map((service, index) => (
              <StaggerItem key={index}>
                <ScaleIn delay={index * 0.1}>
                  <TiltCard>
                    <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-500 overflow-hidden group relative">
                      {/* Decorative glow */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors duration-500" />
                      
                      <div className="p-8 md:p-10 relative z-10">
                        <div className="flex items-start gap-6">
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary group-hover:from-secondary group-hover:to-secondary/80 group-hover:text-white transition-all duration-500 flex-shrink-0 shadow-lg">
                            <service.icon className="w-8 h-8" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4 text-foreground">{service.title}</h3>
                            <p className="text-muted-foreground leading-relaxed text-lg">{service.description}</p>
                          </div>
                        </div>
                        <ul className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-border/50">
                          {service.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-3 text-foreground/80">
                              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/30 transition-colors">
                                <Check className="w-3.5 h-3.5 text-secondary" />
                              </div>
                              <span className="font-medium">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  </TiltCard>
                </ScaleIn>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Process Preview - Premium Design */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        <GradientOrbs className="opacity-30" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-5xl mx-auto text-center">
            <FadeIn>
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-secondary/10 border border-secondary/20 text-foreground text-sm font-medium mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                </span>
                Simple Process
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">
                How It <span className="text-gradient-gold">Works</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-16 max-w-2xl mx-auto">
                Our streamlined process makes credit repair simple and stress-free.
              </p>
            </FadeIn>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "01", title: "Free Consultation", desc: "We analyze your credit situation" },
                { step: "02", title: "Custom Strategy", desc: "We create a personalized plan" },
                { step: "03", title: "Execute & Monitor", desc: "We dispute and track results" },
              ].map((item, index) => (
                <ScaleIn key={index} delay={index * 0.15}>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-secondary/5 rounded-2xl blur-xl group-hover:bg-secondary/10 transition-colors duration-500" />
                    <Card className="relative p-8 bg-card/80 backdrop-blur-sm border-border/50 group-hover:border-secondary/50 transition-all duration-500 overflow-hidden">
                      <div className="text-6xl md:text-7xl font-serif font-bold text-secondary/10 group-hover:text-secondary/20 transition-colors absolute top-4 right-4">
                        {item.step}
                      </div>
                      <div className="relative z-10 text-left pt-8">
                        <h3 className="text-2xl font-serif font-bold text-foreground mb-3">{item.title}</h3>
                        <p className="text-muted-foreground text-lg">{item.desc}</p>
                      </div>
                    </Card>
                  </div>
                </ScaleIn>
              ))}
            </div>
            
            <SlideUp delay={0.5} className="mt-14">
              <Button asChild size="lg" variant="outline" className="h-14 rounded-full px-10 border-border/50 hover:border-secondary/50 hover:bg-secondary/10 transition-all duration-500">
                <Link href="/how-it-works" className="flex items-center gap-3">
                  Learn More About Our Process 
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </SlideUp>
          </div>
        </div>
      </section>

      {/* CTA Section - Dramatic Finale */}
      <section className="py-32 md:py-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <AuroraBackground className="opacity-60" />
        <ParticleField count={15} className="opacity-40" />
        <NoiseOverlay opacity={0.03} />
        
        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px] animate-breathe" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/15 rounded-full blur-[120px] animate-breathe" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <SlideUp>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4 text-secondary" />
              Expert Guidance
            </div>
          </SlideUp>
          
          <SlideUp delay={0.2}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-8 text-white leading-[1.1]">
              Not Sure What You <span className="text-gradient-gold">Need</span>?
            </h2>
          </SlideUp>
          
          <SlideUp delay={0.4}>
            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 font-light">
              Schedule a free consultation with one of our specialists to discuss your specific situation.
            </p>
          </SlideUp>
          
          <SlideUp delay={0.6}>
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

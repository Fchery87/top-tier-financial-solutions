import { Users, Target, ShieldCheck, Award, Heart, Zap, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { FadeIn, SlideUp, SlideIn, StaggerContainer, StaggerItem, GlowCard, TiltCard, ScaleIn } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';
import { Card } from '@/components/ui/Card';

const values = [
  {
    icon: Users,
    title: "Client-Centric Approach",
    description: "We believe that every client's situation is unique. That's why we tailor our dispute strategies to your specific credit report."
  },
  {
    icon: Target,
    title: "Results-Driven",
    description: "Our primary goal is to get you results. We work tirelessly to remove inaccurate, unverifiable, and erroneous items from your report."
  },
  {
    icon: ShieldCheck,
    title: "Full Compliance",
    description: "We operate with strict adherence to the Credit Repair Organizations Act (CROA) and all relevant state and federal laws."
  },
  {
    icon: Award,
    title: "Excellence",
    description: "We hold ourselves to the highest standards in the industry, constantly improving our methods and staying ahead of regulations."
  },
  {
    icon: Heart,
    title: "Empathy",
    description: "We understand the stress of financial challenges. Our team approaches every case with compassion and understanding."
  },
  {
    icon: Zap,
    title: "Efficiency",
    description: "Time is valuable. We work swiftly and effectively to get you the results you need as quickly as possible."
  }
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Our Story"
        title="About Top Tier"
        titleHighlight="Financial"
        description="We are a team of dedicated credit repair specialists committed to helping you achieve your financial goals through personalized, legal, and effective strategies."
        variant="dramatic"
      />

      {/* Values Grid - Premium Design */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <GradientOrbs className="opacity-40" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-foreground/80 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              What We Stand For
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">
              Our Core <span className="text-gradient-gold">Values</span>
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl">
              These principles guide everything we do and define who we are as a company.
            </p>
          </FadeIn>
          
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {values.map((value, index) => (
              <StaggerItem key={index}>
                <ScaleIn delay={index * 0.1}>
                  <TiltCard>
                    <Card className="h-full p-8 bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all duration-500 group overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-2xl group-hover:bg-secondary/10 transition-colors duration-500" />
                      <div className="relative z-10">
                        <div className="mb-6 p-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary flex items-center justify-center group-hover:from-secondary group-hover:to-secondary/80 group-hover:text-white transition-all duration-500 shadow-lg">
                          <value.icon className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-serif font-bold mb-3 text-foreground">{value.title}</h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {value.description}
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

      {/* Mission Section - Premium Design */}
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
                  Our Mission
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-[1.1]">
                  Empowering Your <span className="text-gradient-gold">Financial Future</span>
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                  Our mission is to empower individuals and families to take control of their financial future. We understand that a low credit score can be a significant barrier to achieving your dreams, whether it&apos;s buying a home, starting a business, or simply having peace of mind.
                </p>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                  We strive to provide transparent, educational, and effective credit repair services that not only improve your score but also give you the knowledge to maintain it.
                </p>
                <div className="grid grid-cols-2 gap-8 pt-8">
                  {[
                    { value: "98%", label: "Success Rate" },
                    { value: "2,500+", label: "Happy Clients" }
                  ].map((stat, i) => (
                    <div key={i} className="relative group">
                      <div className="absolute inset-0 bg-secondary/5 rounded-xl blur-lg group-hover:bg-secondary/10 transition-colors" />
                      <div className="relative p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
                        <div className="text-4xl md:text-5xl font-serif font-bold text-gradient-gold mb-2">{stat.value}</div>
                        <div className="text-sm uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SlideIn>
            
            <SlideIn direction="right">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-secondary/20 to-secondary/5 rounded-3xl blur-3xl animate-breathe" />
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 shadow-2xl group">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1632&q=80')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <p className="text-xl text-white/90 font-serif italic">
                      &quot;Building financial freedom, one credit score at a time.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* Why Choose Us - Timeline Section */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <SlideUp className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-foreground/80 text-sm font-medium mb-6">
                <Award className="w-4 h-4 text-secondary" />
                Our Journey
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">
                Why Families <span className="text-gradient-gold">Trust Us</span>
              </h2>
              <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                We&apos;ve helped thousands of families achieve their financial dreams through dedication and expertise.
              </p>
            </SlideUp>
            
            <div className="relative">
              {/* Animated timeline line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px hidden md:block">
                <div className="h-full bg-gradient-to-b from-secondary via-secondary/50 to-transparent" />
              </div>
              
              {[
                { year: "Founded", title: "Started with a Vision", description: "We began with a simple mission: help people understand and improve their credit.", icon: Target },
                { year: "Growing", title: "Expanded Our Team", description: "Built a team of certified credit specialists and legal experts.", icon: Users },
                { year: "Today", title: "Industry Leaders", description: "Now serving thousands of clients with a 98% success rate.", icon: Award },
              ].map((item, index) => (
                <ScaleIn key={index} delay={index * 0.2}>
                  <div className={`flex flex-col md:flex-row items-center gap-8 mb-16 last:mb-0 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                    <div className={`flex-1 ${index % 2 === 1 ? 'md:text-right' : ''}`}>
                      <Card className="p-8 bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all duration-500 group">
                        <div className={`flex items-center gap-4 mb-4 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                          <div className="p-3 rounded-xl bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white transition-all duration-300">
                            <item.icon className="w-6 h-6" />
                          </div>
                          <div className="px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-bold">
                            {item.year}
                          </div>
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-foreground mb-3">{item.title}</h3>
                        <p className="text-muted-foreground text-lg">{item.description}</p>
                      </Card>
                    </div>
                    
                    {/* Timeline dot */}
                    <div className="relative hidden md:block">
                      <div className="absolute inset-0 bg-secondary/30 rounded-full blur-md animate-pulse" />
                      <div className="relative w-5 h-5 rounded-full bg-gradient-to-br from-secondary to-secondary/70 shadow-lg shadow-secondary/50" />
                    </div>
                    
                    <div className="flex-1 hidden md:block" />
                  </div>
                </ScaleIn>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

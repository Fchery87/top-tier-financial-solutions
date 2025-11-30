import { Accordion } from '@/components/ui/Accordion';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { getFAQs } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { FadeIn, SlideUp } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay, AuroraBackground, ParticleField } from '@/components/ui/AnimatedBackground';
import { Sparkles, ArrowRight, HelpCircle } from 'lucide-react';

const fallbackFaqs = [
  {
    title: "How long does the credit repair process take?",
    content: "Every credit report is different. While some clients see results in as little as 30-45 days, a comprehensive repair process typically takes 3 to 6 months. We work as quickly as possible to dispute inaccurate items."
  },
  {
    title: "Is credit repair legal?",
    content: "Yes, absolutely. You have the right under the Fair Credit Reporting Act (FCRA) to dispute inaccurate, unverifiable, or obsolete information on your credit report. We help you exercise those rights effectively."
  },
  {
    title: "Can you guarantee a specific credit score increase?",
    content: "No reputable credit repair company can guarantee a specific score increase or the removal of specific items, as this depends on the credit bureaus and creditors. However, we guarantee to work diligently on your behalf and offer a money-back policy if we cannot remove any questionable items."
  },
  {
    title: "What items can be removed from my credit report?",
    content: "We can help dispute any item that is inaccurate, unfair, or unsubstantiated. This includes late payments, collections, charge-offs, bankruptcies, repossessions, foreclosures, judgments, and hard inquiries."
  },
  {
    title: "Will using a credit repair service hurt my credit score?",
    content: "Disputing items does not hurt your score. In fact, removing negative items is the fastest way to improve it. However, closing old accounts (which we generally advise against unless necessary) can sometimes have a temporary negative impact."
  }
];

export default async function FAQPage() {
  let faqs = fallbackFaqs;
  
  try {
    const apiFaqs = await getFAQs();
    if (apiFaqs.length > 0) {
      faqs = apiFaqs.map(f => ({
        title: f.question,
        content: f.answer
      }));
    }
  } catch {
    // Use fallback FAQs if API fails
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Help Center"
        title="Frequently Asked"
        titleHighlight="Questions"
        description="Got questions? We have answers. If you don't see your question here, feel free to contact us."
      />

      {/* FAQ Section */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden">
        <GradientOrbs className="opacity-30" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <FadeIn className="max-w-4xl mx-auto">
            <Accordion items={faqs} />
          </FadeIn>
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
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-8">
              <HelpCircle className="w-4 h-4 text-secondary" />
              Need More Help?
            </div>
          </SlideUp>
          <SlideUp delay={0.2}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-8 text-white leading-[1.1]">
              Still Have <span className="text-gradient-gold">Questions</span>?
            </h2>
          </SlideUp>
          <SlideUp delay={0.4}>
            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 font-light">
              Our team is here to help. Reach out and get personalized answers.
            </p>
          </SlideUp>
          <SlideUp delay={0.6}>
            <Button asChild size="lg" className="h-16 md:h-20 px-12 md:px-16 text-lg md:text-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full shadow-[0_0_60px_rgba(198,168,124,0.4)] hover:shadow-[0_0_80px_rgba(198,168,124,0.6)] transition-all duration-500 hover:scale-105 btn-premium">
              <Link href="/contact" className="flex items-center gap-4">
                <Sparkles className="w-6 h-6" />
                Contact Us
                <ArrowRight className="w-6 h-6" />
              </Link>
            </Button>
          </SlideUp>
        </div>
      </section>
    </div>
  );
}

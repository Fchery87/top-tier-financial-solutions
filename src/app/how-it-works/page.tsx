import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Search, FileText, TrendingUp, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const steps = [
  {
    icon: Search,
    step: '01',
    title: 'Analysis & Onboarding',
    description:
      'We start by pulling your credit reports from all three bureaus. Our team analyzes them line-by-line to identify negative items that can lawfully be disputed.',
    details: [
      'CROA disclosures and agreement first',
      'Identity and address documents verified',
      'Three-bureau line-by-line comparison',
      'Dispute candidates ranked by evidence',
    ],
  },
  {
    icon: FileText,
    step: '02',
    title: 'Dispute & Challenge',
    description:
      'We prepare custom dispute letters citing specific consumer protection laws, sent to credit bureaus and creditors on your behalf — only after every policy gate clears.',
    details: [
      'Reason codes tied to FCRA provisions',
      'Evidence attached to every claim',
      'Your written confirmation before sending',
      'Certified tracking on every letter',
    ],
  },
  {
    icon: TrendingUp,
    step: '03',
    title: 'Monitor & Optimize',
    description:
      'We track every bureau response against its statutory clock. As items are corrected or removed, we plan the next compliant cycle until your reports are accurate.',
    details: [
      '30-day FCRA response clock tracked',
      'Outcomes logged item by item',
      'Portal updates in real time',
      'Next cycle planned from results',
    ],
  },
];

const assurances = [
  'No hidden fees or long-term contracts',
  '24/7 access to your client portal',
  'Cancellation rights honored in writing',
  'Dedicated case manager for every client',
];

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Our Process"
        title="Three steps."
        titleHighlight="Fully documented."
        description="Our process is designed to be transparent, effective, and hassle-free. Here is exactly what happens when you work with us — and what the law requires at each step."
        variant="dramatic"
      />

      {/* Steps — deep dive */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="space-y-px overflow-hidden rounded-xl border border-border bg-border">
            {steps.map((step) => (
              <article key={step.step} className="grid gap-8 bg-card p-7 md:grid-cols-[auto_1fr_1fr] md:gap-12 md:p-10">
                <div className="flex items-start gap-5 md:block">
                  <p className="font-editorial text-5xl leading-none text-secondary/70 md:text-6xl">{step.step}</p>
                  <step.icon className="mt-1 h-6 w-6 text-secondary md:mt-6" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{step.title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{step.description}</p>
                </div>
                <ul className="grid content-start gap-3 border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-10">
                  {step.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2.5 text-sm leading-6 text-foreground">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-secondary" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why Top Tier */}
      <section className="border-y border-border bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
                Why Top Tier
              </p>
              <h2 className="font-editorial mt-5 text-4xl leading-[1.1] text-foreground md:text-5xl">
                The fine print, <em>up front.</em>
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-muted-foreground">
                Credit repair is a regulated service. We treat the regulations as a feature —
                everything we commit to is in writing before any work begins.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/contact" className="gap-2">
                  Start Your Journey
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {assurances.map((item) => (
                <li key={item} className="flex items-center gap-3.5 bg-card p-6">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-secondary" />
                  <span className="text-sm font-medium leading-6 text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="surface-ink relative overflow-hidden rounded-2xl px-7 py-14 text-center md:px-14 md:py-20">
            <div className="absolute inset-0 rule-grid-ink" aria-hidden />
            <div className="absolute inset-0 brass-glow" aria-hidden />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-editorial text-4xl leading-[1.08] text-ink-foreground md:text-5xl">
                Ready to work <em>your case?</em>
              </h2>
              <p className="mt-5 leading-7 text-ink-muted">
                Take the first step toward accurate credit reporting today. Free consultation,
                no upfront fees.
              </p>
              <Link
                href="/contact"
                className="group/cta mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink-foreground px-7 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5),0_1px_3px_hsl(0_0%_0%/0.4)] transition-[background-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-white active:scale-[0.97]"
              >
                Book Free Consultation
                <ArrowUpRight className="h-4 w-4 transition-transform duration-[160ms] ease-[var(--ease-out)] group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getTestimonials, Testimonial } from '@/lib/api';

const fallbackTestimonials = [
  {
    id: '1',
    author_name: 'Sarah J.',
    author_location: 'Client',
    quote: 'The team made the process clear. I always knew what documents were needed, what was being reviewed, and what the next step was.',
  },
  {
    id: '2',
    author_name: 'Michael T.',
    author_location: 'Client',
    quote: 'Top Tier helped me understand my reports and kept every action organized. The portal made a stressful process feel manageable.',
  },
  {
    id: '3',
    author_name: 'Jessica R.',
    author_location: 'Client',
    quote: 'I appreciated the transparency. They explained what could be disputed, what needed evidence, and what could not be promised.',
  },
];

const trustMarkers = [
  { label: 'CROA/FCRA-aware workflow', icon: Scale },
  { label: 'No upfront-fee positioning', icon: ShieldCheck },
  { label: 'Secure client collaboration', icon: LockKeyhole },
];

const platformPillars = [
  {
    title: 'Prospect to onboarding',
    description: 'Consultation, qualification, agreements, disclosures, identity documents, and cancellation-window tracking stay connected from the first interaction.',
    icon: Users,
  },
  {
    title: 'Report analysis to dispute policy',
    description: 'Credit report imports become structured accounts, negative items, bureau discrepancies, FCRA timing issues, and evidence-backed dispute candidates.',
    icon: BarChart3,
  },
  {
    title: 'Controlled AI letter rendering',
    description: 'AI renders approved dispute inputs into polished letters after policy checks, reason codes, evidence requirements, and client confirmations are resolved.',
    icon: Sparkles,
  },
  {
    title: 'Services-rendered billing readiness',
    description: 'Billing support is tied to documented services-rendered events, agreement state, compliance gates, and audit logs instead of premature charging.',
    icon: FileCheck2,
  },
];

const journey = [
  'Strategy call and lead qualification',
  'Agreement, disclosures, consent, and documents',
  'Credit report import and bureau comparison',
  'Policy-approved dispute cycle and letter approval',
  'Response review, progress tracking, and next-cycle planning',
];

export default async function Home() {
  let testimonials: Testimonial[] = [];

  try {
    testimonials = await getTestimonials();
  } catch {
    // Fallback keeps the page useful when public content APIs are unavailable.
  }

  const displayTestimonials = testimonials.length > 0 ? testimonials : fallbackTestimonials;

  return (
    <div className="platform-shell overflow-hidden">
      <section className="relative min-h-screen pt-32 pb-20 md:pt-40 md:pb-24">
        <div className="absolute inset-0 rule-grid opacity-35" />
        <div className="container relative mx-auto px-4 md:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-4xl">
              <div className="mb-8 inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-secondary" />
                Premium credit repair operations, built around compliance gates
              </div>

              <h1 className="font-display text-6xl leading-[0.9] tracking-[-0.05em] text-foreground md:text-8xl lg:text-[7.8rem]">
                Wealth is a mindset.
                <span className="block text-secondary">Credit is the key.</span>
              </h1>

              <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                Top Tier Financial Solutions pairs a premium client experience with the operational controls credit repair work requires: onboarding, report analysis, dispute cycles, letter approvals, response tracking, and billing readiness in one system.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/contact" className="gap-2">
                    Book a Strategy Call
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/how-it-works" className="gap-2">
                    See the Process
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {trustMarkers.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="surface-panel rounded-lg p-4 text-sm text-muted-foreground">
                      <Icon className="mb-3 h-5 w-5 text-secondary" />
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="surface-panel relative rounded-xl p-4 md:p-6">
              <div className="surface-document rounded-lg p-5 md:p-7">
                <div className="flex items-start justify-between border-b border-border/70 pb-5">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Client Case File</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">Restoration Plan</h2>
                  </div>
                  <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">Active</span>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    ['Agreement signed', 'CROA disclosures acknowledged'],
                    ['Documents verified', 'Identity and proof of address uploaded'],
                    ['Report analyzed', 'Negative items and discrepancies extracted'],
                    ['Policy checks ready', 'Evidence and confirmation gates visible'],
                  ].map(([title, detail]) => (
                    <div key={title} className="flex gap-3 rounded-md border border-border/70 bg-background/40 p-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border/70 pt-5">
                  {[
                    ['12', 'Items reviewed'],
                    ['3', 'Bureaus compared'],
                    ['0', 'Upfront fees'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <p className="text-2xl font-semibold tracking-tight">{value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-background/70 py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-secondary">One connected platform</p>
              <h2 className="mt-4 font-display text-4xl leading-tight tracking-[-0.03em] md:text-5xl">
                Public trust, client clarity, and internal control share one design language.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {platformPillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <Card key={pillar.title} className="p-6">
                    <Icon className="h-5 w-5 text-secondary" />
                    <h3 className="mt-5 text-lg font-semibold">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-secondary">Guided restoration journey</p>
              <h2 className="mt-4 font-display text-4xl leading-tight tracking-[-0.03em] md:text-5xl">
                A clear path from consultation to dispute-cycle review.
              </h2>
              <p className="mt-5 text-muted-foreground leading-7">
                The experience is designed to reduce uncertainty for clients while giving staff the controls needed for regulated credit repair work.
              </p>
              <Button asChild variant="outline" className="mt-8">
                <Link href="/services" className="gap-2">Explore Services <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>

            <div className="surface-panel rounded-xl p-3">
              <ol className="divide-y divide-border/70 overflow-hidden rounded-lg bg-card/60">
                {journey.map((step, index) => (
                  <li key={step} className="grid grid-cols-[3rem_1fr] gap-4 p-5 md:p-6">
                    <span className="font-mono text-sm text-secondary">0{index + 1}</span>
                    <div>
                      <h3 className="font-semibold">{step}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {index === 0 && 'Prospects get a clear entry point before any case work begins.'}
                        {index === 1 && 'Legal acknowledgments and required documents become visible readiness gates.'}
                        {index === 2 && 'Reports are parsed into accounts, negative items, profile issues, and bureau-level differences.'}
                        {index === 3 && 'Letters are generated only from approved claims, reason codes, and evidence state.'}
                        {index === 4 && 'Staff review outcomes, track progress, and decide the next compliant action.'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/35 py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-secondary">Client confidence</p>
              <h2 className="mt-3 font-display text-4xl tracking-[-0.03em] md:text-5xl">Transparent by design.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Individual outcomes vary. The platform is designed to clarify rights, responsibilities, evidence needs, and workflow status rather than promise a specific score result.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {displayTestimonials.slice(0, 3).map((testimonial) => (
              <Card key={testimonial.id} className="p-6">
                <p className="text-sm leading-7 text-foreground">“{testimonial.quote}”</p>
                <div className="mt-6 border-t border-border/70 pt-4">
                  <p className="text-sm font-semibold">{testimonial.author_name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.author_location}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="surface-panel grid gap-8 rounded-xl p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div>
              <h2 className="font-display text-4xl tracking-[-0.03em] md:text-5xl">Start with a strategy call.</h2>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                Learn what can be reviewed, what documentation may be needed, and how Top Tier structures compliant credit repair support.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/contact" className="gap-2">Book Consultation <ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

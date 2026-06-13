import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

const marqueeItems = [
  'CROA disclosures',
  'FCRA §611 disputes',
  'Three-bureau analysis',
  'Evidence-backed claims',
  'Document encryption',
  'Audit logging',
  'No upfront fees',
  'Cancellation rights honored',
];

const pillars = [
  {
    index: '01',
    title: 'Onboarding with gates, not gaps',
    description:
      'Consultation, qualification, agreements, disclosures, identity documents, and cancellation-window tracking stay connected from the first interaction — nothing proceeds until the law says it can.',
  },
  {
    index: '02',
    title: 'Reports become structured cases',
    description:
      'Credit report imports are parsed into accounts, negative items, bureau discrepancies, and FCRA timing issues — every dispute candidate backed by evidence, not guesswork.',
  },
  {
    index: '03',
    title: 'AI letters, policy-checked first',
    description:
      'AI renders approved dispute inputs into polished letters only after reason codes, evidence requirements, and client confirmations are resolved. The machine drafts; the policy decides.',
  },
  {
    index: '04',
    title: 'Billing tied to work performed',
    description:
      'Charges attach to documented services-rendered events, agreement state, and audit logs — never to promises. Compliance is the billing model, not a disclaimer.',
  },
];

const journey = [
  {
    step: 'Strategy call and lead qualification',
    detail: 'Prospects get a clear entry point before any case work begins.',
  },
  {
    step: 'Agreement, disclosures, consent, and documents',
    detail: 'Legal acknowledgments and required documents become visible readiness gates.',
  },
  {
    step: 'Credit report import and bureau comparison',
    detail: 'Reports are parsed into accounts, negative items, and bureau-level differences.',
  },
  {
    step: 'Policy-approved dispute cycle and letter approval',
    detail: 'Letters are generated only from approved claims, reason codes, and evidence state.',
  },
  {
    step: 'Response review, progress tracking, and next-cycle planning',
    detail: 'Staff review outcomes, track progress, and decide the next compliant action.',
  },
];

const heroChecklist = [
  ['Agreement signed', 'CROA disclosures acknowledged'],
  ['Documents verified', 'Identity and proof of address on file'],
  ['Report analyzed', '12 negative items, 4 discrepancies extracted'],
  ['Letters queued', '3 disputes awaiting client confirmation'],
] as const;

const heroDisputes = [
  { bureau: 'Experian', item: 'Collection · Account #4421', status: 'In review', tone: 'text-brass' },
  { bureau: 'Equifax', item: 'Late payment · Account #1187', status: 'Letter sent', tone: 'text-ink-muted' },
  { bureau: 'TransUnion', item: 'Inquiry · Unverified', status: 'Removed', tone: 'text-up' },
] as const;

export default async function Home() {
  let testimonials: Testimonial[] = [];

  try {
    testimonials = await getTestimonials();
  } catch {
    // Fallback keeps the page useful when public content APIs are unavailable.
  }

  const displayTestimonials = testimonials.length > 0 ? testimonials : fallbackTestimonials;

  return (
    <div className="platform-shell">
      {/* ── Hero — ink, editorial, with live case file ── */}
      <section className="surface-ink relative overflow-hidden">
        <div className="absolute inset-0 rule-grid-ink" aria-hidden />
        <div className="absolute inset-0 brass-glow" aria-hidden />

        <div className="container relative mx-auto px-4 pt-32 pb-16 md:px-6 md:pt-40 md:pb-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-brass">
                Compliance-first credit repair
              </p>

              <h1 className="font-editorial mt-6 text-5xl leading-[1.04] text-ink-foreground md:text-7xl text-balance">
                Bad credit isn&rsquo;t a verdict.
                <br />
                It&rsquo;s a <em>case to be worked.</em>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-ink-muted md:text-lg">
                One operating system for the entire practice — onboarding, report analysis,
                dispute cycles, letter approvals, and outcome tracking — with the compliance
                controls regulated credit repair demands.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contact"
                  className="group/cta inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink-foreground px-7 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5),0_1px_3px_hsl(0_0%_0%/0.4)] transition-[background-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-white active:scale-[0.97]"
                >
                  Book a Strategy Call
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-[160ms] ease-[var(--ease-out)] group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-ink-border bg-ink-raised px-7 text-[15px] font-medium text-ink-foreground transition-[border-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:border-brass/40 active:scale-[0.97]"
                >
                  See the Process
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-ink-border pt-7">
                {[
                  ['3', 'Bureaus compared'],
                  ['30d', 'FCRA response clock'],
                  ['$0', 'Charged upfront'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink-foreground">
                      {value}
                    </dd>
                    <p className="mt-1 text-xs leading-4 text-ink-muted">{label}</p>
                  </div>
                ))}
              </dl>
            </div>

            {/* Case-file visualization */}
            <div className="relative" aria-hidden>
              <div className="surface-ink-raised rounded-xl p-5 shadow-[0_24px_64px_-24px_hsl(0_0%_0%/0.6)] md:p-6">
                <div className="flex items-start justify-between border-b border-ink-border pb-4">
                  <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-ink-muted">
                      Client case file
                    </p>
                    <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-ink-foreground">
                      Restoration Plan
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-border bg-ink px-2.5 py-1 text-[11px] font-medium text-ink-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                    Cycle 2 active
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-5">
                  {/* Score arc */}
                  <svg viewBox="0 0 120 120" className="h-28 w-28">
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke="hsl(var(--ink-border))" strokeWidth="7"
                      strokeDasharray="235 314" strokeLinecap="round"
                      transform="rotate(130 60 60)"
                    />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke="hsl(var(--brass))" strokeWidth="7"
                      strokeDasharray="156 314" strokeLinecap="round"
                      transform="rotate(130 60 60)"
                      className="animate-arc"
                      style={{ ['--arc-length' as string]: '156', ['--arc-offset' as string]: '0' }}
                    />
                    <text
                      x="60" y="58" textAnchor="middle"
                      className="fill-[hsl(var(--ink-foreground))] font-mono text-[26px] font-semibold"
                    >
                      668
                    </text>
                    <text
                      x="60" y="76" textAnchor="middle"
                      className="fill-[hsl(var(--up))] font-mono text-[11px] font-medium"
                    >
                      ▲ 41 pts
                    </text>
                  </svg>

                  <div className="space-y-1">
                    {heroChecklist.map(([title, detail]) => (
                      <div key={title} className="flex gap-2.5 rounded-md px-2 py-1.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-foreground">{title}</p>
                          <p className="truncate text-[11px] text-ink-muted">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-ink-border">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-ink-border bg-ink px-3 py-2">
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
                      Active disputes
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-ink-muted">3 of 12</p>
                  </div>
                  {heroDisputes.map((d) => (
                    <div
                      key={d.item}
                      className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 border-b border-ink-border/60 px-3 py-2.5 last:border-0"
                    >
                      <span className="font-mono text-[11px] text-ink-muted">{d.bureau}</span>
                      <span className="truncate text-[13px] text-ink-foreground">{d.item}</span>
                      <span className={`font-mono text-[11px] font-medium ${d.tone}`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating compliance chip */}
              <div className="surface-ink-raised absolute -bottom-5 -left-3 hidden rounded-lg px-4 py-3 shadow-[0_16px_40px_-16px_hsl(0_0%_0%/0.7)] md:block">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-brass">
                  Policy gate
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink-foreground">
                  Letter blocked — evidence missing
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust marquee */}
        <div className="relative border-t border-ink-border py-5">
          <div className="marquee-mask overflow-hidden">
            <div className="animate-marquee flex w-max gap-10 pr-10">
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="flex items-center gap-3 whitespace-nowrap font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted"
                >
                  <span className="h-1 w-1 rounded-full bg-brass/60" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The system — editorial numbered pillars ── */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-14 max-w-3xl md:mb-18">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
              One connected platform
            </p>
            <h2 className="font-editorial mt-5 text-4xl leading-[1.1] text-foreground md:text-6xl">
              Most credit repair runs on spreadsheets and hope.
              <em> This doesn&rsquo;t.</em>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
            {pillars.map((pillar) => (
              <article key={pillar.index} className="group bg-card p-7 transition-colors duration-[200ms] ease-[var(--ease-out)] hover:bg-muted/40 md:p-9">
                <p className="font-editorial text-4xl text-secondary/70 transition-colors duration-[200ms] ease-[var(--ease-out)] group-hover:text-secondary md:text-5xl">
                  {pillar.index}
                </p>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground md:text-xl">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-[15px] md:leading-7">
                  {pillar.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Process rail ── */}
      <section className="border-y border-border bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
                Guided restoration journey
              </p>
              <h2 className="font-editorial mt-5 text-4xl leading-[1.1] text-foreground md:text-5xl">
                A clear path from consultation to <em>closed dispute.</em>
              </h2>
              <p className="mt-6 max-w-md leading-7 text-muted-foreground">
                The experience reduces uncertainty for clients while giving staff the controls
                that regulated credit repair work requires.
              </p>
              <Button asChild variant="outline" className="mt-8">
                <Link href="/services" className="gap-2">
                  Explore Services <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <ol className="relative space-y-0 border-l border-border pl-8 md:pl-10">
              {journey.map((item, index) => (
                <li key={item.step} className="relative pb-10 last:pb-0">
                  <span className="absolute -left-8 top-1 flex h-[15px] w-[15px] items-center justify-center md:-left-10">
                    <span className="absolute h-[15px] w-[15px] -translate-x-1/2 rounded-full border border-secondary/40 bg-background" />
                    <span className="absolute h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-secondary" />
                  </span>
                  <p className="font-mono text-xs font-medium tracking-[0.16em] text-secondary">
                    STEP 0{index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {item.step}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Testimonials — editorial pull quotes ── */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
                Client confidence
              </p>
              <h2 className="font-editorial mt-4 text-4xl leading-[1.1] text-foreground md:text-5xl">
                Transparent <em>by design.</em>
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Individual outcomes vary. The platform clarifies rights, evidence needs, and
              workflow status — it never promises a score.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {displayTestimonials.slice(0, 3).map((testimonial) => (
              <figure key={testimonial.id} className="flex flex-col justify-between bg-card p-7 md:p-8">
                <blockquote>
                  <span className="font-editorial text-4xl leading-none text-secondary/50">&ldquo;</span>
                  <p className="mt-2 text-[15px] leading-7 text-foreground">{testimonial.quote}</p>
                </blockquote>
                <figcaption className="mt-7 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground">{testimonial.author_name}</p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {testimonial.author_location}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA — ink panel ── */}
      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="surface-ink relative overflow-hidden rounded-2xl px-7 py-14 md:px-14 md:py-20">
            <div className="absolute inset-0 rule-grid-ink" aria-hidden />
            <div className="absolute inset-0 brass-glow" aria-hidden />
            <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="font-editorial text-4xl leading-[1.08] text-ink-foreground md:text-6xl">
                  Start with a <em>strategy call.</em>
                </h2>
                <p className="mt-5 max-w-xl leading-7 text-ink-muted">
                  Learn what can be reviewed, what documentation may be needed, and how Top Tier
                  structures compliant credit repair support. No fees until services are rendered.
                </p>
              </div>
              <Link
                href="/contact"
                className="group/cta inline-flex h-12 items-center justify-center gap-2 self-start rounded-lg bg-ink-foreground px-7 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5),0_1px_3px_hsl(0_0%_0%/0.4)] transition-[background-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-white active:scale-[0.97] md:self-center"
              >
                Book Consultation
                <ArrowUpRight className="h-4 w-4 transition-transform duration-[160ms] ease-[var(--ease-out)] group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

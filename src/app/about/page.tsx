import { Users, Target, ShieldCheck, Award, Heart, Zap } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { SlideUp } from '@/components/ui/Motion';

const values = [
  {
    icon: Users,
    title: 'Client-centric approach',
    description:
      "Every credit report tells a different story. Dispute strategies are tailored to your specific accounts, history, and goals — never templated.",
  },
  {
    icon: Target,
    title: 'Results through process',
    description:
      'We pursue inaccurate, unverifiable, and erroneous items methodically — every claim documented, every cycle tracked to its outcome.',
  },
  {
    icon: ShieldCheck,
    title: 'Full compliance',
    description:
      'We operate in strict adherence to the Credit Repair Organizations Act (CROA), the FCRA, and all relevant state and federal laws.',
  },
  {
    icon: Award,
    title: 'Excellence',
    description:
      'We hold ourselves to the highest standard in the industry — constantly refining methods and staying ahead of regulation.',
  },
  {
    icon: Heart,
    title: 'Empathy',
    description:
      'Financial stress is human. Every case gets approached with compassion, plain language, and zero judgment.',
  },
  {
    icon: Zap,
    title: 'Efficiency',
    description:
      'Statutory clocks matter. We work each dispute cycle promptly so no FCRA response window is ever wasted.',
  },
];

const principles = [
  {
    label: 'The vision',
    title: 'Started with a simple conviction',
    description:
      'People deserve to understand their own credit. We began by making reports legible — accounts, items, and rights explained in plain language.',
  },
  {
    label: 'The practice',
    title: 'Built around documentation',
    description:
      'A team of credit specialists working one disciplined system: agreements before action, evidence before claims, records of everything.',
  },
  {
    label: 'The standard',
    title: 'Transparency over promises',
    description:
      'We will never promise a score. We promise clear status, honest assessment of what can be disputed, and work you can verify.',
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Our Story"
        title="Credit repair,"
        titleHighlight="practiced properly."
        description="A team of dedicated credit repair specialists helping you pursue accurate credit reporting through personalized, lawful, and documented strategies."
        variant="dramatic"
      />

      {/* Values */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-14 max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
              What we stand for
            </p>
            <h2 className="font-editorial mt-5 text-4xl leading-[1.1] text-foreground md:text-5xl">
              Principles that guide <em>every case.</em>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value) => (
              <article
                key={value.title}
                className="group bg-card p-7 transition-colors duration-[200ms] ease-[var(--ease-out)] hover:bg-muted/40 md:p-8"
              >
                <value.icon className="h-5 w-5 text-secondary" strokeWidth={1.75} />
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{value.title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{value.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Mission — ink panel */}
      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="surface-ink relative overflow-hidden rounded-2xl px-7 py-14 md:px-14 md:py-18">
            <div className="absolute inset-0 rule-grid-ink" aria-hidden />
            <div className="absolute inset-0 brass-glow" aria-hidden />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-brass">
                  Our mission
                </p>
                <h2 className="font-editorial mt-5 text-4xl leading-[1.08] text-ink-foreground md:text-5xl">
                  A low score shouldn&rsquo;t decide <em>who gets a future.</em>
                </h2>
                <p className="mt-6 max-w-xl leading-7 text-ink-muted">
                  A credit score can stand between a family and a home, a founder and a business,
                  a person and peace of mind. Our mission is to make sure that what stands there
                  is at least <span className="text-ink-foreground">accurate</span> — and to give
                  you the understanding to keep it that way.
                </p>
              </div>
              <blockquote className="border-l-2 border-brass/50 pl-6">
                <p className="font-editorial text-2xl leading-snug text-ink-foreground md:text-3xl">
                  &ldquo;Building financial freedom, <em>one accurate report at a time.</em>&rdquo;
                </p>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="border-t border-border bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <SlideUp className="mb-14 max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
              Why families trust us
            </p>
            <h2 className="font-editorial mt-5 text-4xl leading-[1.1] text-foreground md:text-5xl">
              Built on discipline, <em>not promises.</em>
            </h2>
          </SlideUp>

          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {principles.map((item, index) => (
              <article key={item.title} className="bg-card p-7 md:p-9">
                <div className="flex items-baseline justify-between">
                  <p className="font-editorial text-4xl text-secondary/70">0{index + 1}</p>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    {item.label}
                  </p>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

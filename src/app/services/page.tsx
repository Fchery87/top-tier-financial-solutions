import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import {
  Check,
  FileSearch,
  FileText,
  TrendingUp,
  GraduationCap,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/db/client';
import { services as servicesTable } from '@/db/schema';
import { asc } from 'drizzle-orm';

interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
}

const fallbackServices = [
  {
    icon: FileSearch,
    title: 'Credit Report Analysis',
    description:
      'A comprehensive review of your credit reports from all three major bureaus (Equifax, Experian, TransUnion) to identify inaccuracies.',
    features: ['Detailed line-by-line analysis', 'Identification of negative items', 'Strategy development', 'Risk assessment'],
  },
  {
    icon: FileText,
    title: 'Dispute Processing',
    description:
      'We prepare and send custom dispute letters to credit bureaus and creditors on your behalf to challenge unverifiable information.',
    features: ['Customized dispute letters', 'Bureau communication', 'Creditor interventions', 'Legal compliance'],
  },
  {
    icon: TrendingUp,
    title: 'Score Tracking & Monitoring',
    description:
      'Stay updated on your progress with regular updates and score monitoring throughout the repair process.',
    features: ['Monthly progress reports', 'Score change alerts', 'Portal access', 'Real-time updates'],
  },
  {
    icon: GraduationCap,
    title: 'Credit Education',
    description:
      'Learn how to build and maintain a healthy credit profile with our educational resources and personalized advice.',
    features: ['Budgeting tips', 'Credit building strategies', 'Debt management advice', 'Long-term planning'],
  },
];

const iconMap: Record<number, typeof FileSearch> = {
  0: FileSearch,
  1: FileText,
  2: TrendingUp,
  3: GraduationCap,
};

const processSteps = [
  { step: '01', title: 'Free consultation', desc: 'We review your credit situation and explain what can lawfully be disputed.' },
  { step: '02', title: 'Custom strategy', desc: 'A personalized plan built from your reports — accounts, items, and evidence needs.' },
  { step: '03', title: 'Execute & monitor', desc: 'We work each dispute cycle and track every bureau response to its outcome.' },
];

async function getServices(): Promise<ServiceData[]> {
  try {
    const items = await db.select().from(servicesTable).orderBy(asc(servicesTable.orderIndex));
    return items.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      order_index: s.orderIndex ?? 0,
    }));
  } catch {
    return [];
  }
}

export default async function ServicesPage() {
  const dbServices = await getServices();
  const useDynamicServices = dbServices.length > 0;

  const services = useDynamicServices
    ? dbServices.map((s, index) => ({
        icon: iconMap[index % 4] || Briefcase,
        title: s.name,
        description: s.description || '',
        features: [] as string[],
      }))
    : fallbackServices;

  return (
    <div className="flex flex-col">
      <PageHeader
        badge="What We Offer"
        title="Services built for"
        titleHighlight="accurate reporting."
        description="Comprehensive credit repair support — analysis, disputes, monitoring, and education — delivered through one documented, compliant process."
        variant="dramatic"
      />

      {/* Services */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
            {services.map((service, index) => (
              <article
                key={service.title}
                className="group bg-card p-7 transition-colors duration-[200ms] ease-[var(--ease-out)] hover:bg-muted/40 md:p-10"
              >
                <div className="flex items-start justify-between">
                  <service.icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
                  <span className="font-editorial text-3xl text-secondary/40 transition-colors duration-[200ms] ease-[var(--ease-out)] group-hover:text-secondary/70">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {service.title}
                </h3>
                <p className="mt-3 leading-7 text-muted-foreground">{service.description}</p>
                {service.features && service.features.length > 0 && (
                  <ul className="mt-7 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5 text-sm text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-secondary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process preview */}
      <section className="border-y border-border bg-muted/30 py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
                Simple process
              </p>
              <h2 className="font-editorial mt-4 text-4xl leading-[1.1] text-foreground md:text-5xl">
                How it <em>works.</em>
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/how-it-works" className="gap-2">
                The full process <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {processSteps.map((item) => (
              <li key={item.step} className="bg-card p-7 md:p-9">
                <p className="font-editorial text-4xl text-secondary/70 md:text-5xl">{item.step}</p>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </li>
            ))}
          </ol>
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
                Not sure what you need? <em>Ask us.</em>
              </h2>
              <p className="mt-5 leading-7 text-ink-muted">
                Schedule a free consultation with a specialist to discuss your specific situation —
                no obligation, no upfront fees.
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

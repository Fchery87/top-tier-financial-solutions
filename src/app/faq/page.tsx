import { Accordion } from '@/components/ui/Accordion';
import Link from 'next/link';
import { getFAQs } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { ArrowUpRight } from 'lucide-react';

const fallbackFaqs = [
  {
    title: 'How long does the credit repair process take?',
    content:
      'Every credit report is different. While some clients see results in as little as 30-45 days, a comprehensive repair process typically takes 3 to 6 months. We work as quickly as possible to dispute inaccurate items.',
  },
  {
    title: 'Is credit repair legal?',
    content:
      'Yes, absolutely. You have the right under the Fair Credit Reporting Act (FCRA) to dispute inaccurate, unverifiable, or obsolete information on your credit report. We help you exercise those rights effectively.',
  },
  {
    title: 'Can you guarantee a specific credit score increase?',
    content:
      'No reputable credit repair company can guarantee a specific score increase or the removal of specific items, as this depends on the credit bureaus and creditors. However, we guarantee to work diligently on your behalf and offer a money-back policy if we cannot remove any questionable items.',
  },
  {
    title: 'What items can be removed from my credit report?',
    content:
      'We can help dispute any item that is inaccurate, unfair, or unsubstantiated. This includes late payments, collections, charge-offs, bankruptcies, repossessions, foreclosures, judgments, and hard inquiries.',
  },
  {
    title: 'Will using a credit repair service hurt my credit score?',
    content:
      'Disputing items does not hurt your score. In fact, removing negative items is the fastest way to improve it. However, closing old accounts (which we generally advise against unless necessary) can sometimes have a temporary negative impact.',
  },
];

export default async function FAQPage() {
  let faqs = fallbackFaqs;

  try {
    const apiFaqs = await getFAQs();
    if (apiFaqs.length > 0) {
      faqs = apiFaqs.map(f => ({
        title: f.question,
        content: f.answer,
      }));
    }
  } catch {
    // Use fallback FAQs if API fails
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        badge="Help Center"
        title="Questions,"
        titleHighlight="answered honestly."
        description="Straight answers about credit repair, your rights, and what to expect. If you don't see your question here, ask us directly."
      />

      {/* FAQ */}
      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl">
            <Accordion items={faqs} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="surface-ink relative overflow-hidden rounded-2xl px-7 py-14 text-center md:px-14 md:py-20">
            <div className="absolute inset-0 rule-grid-ink" aria-hidden />
            <div className="absolute inset-0 brass-glow" aria-hidden />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-editorial text-4xl leading-[1.08] text-ink-foreground md:text-5xl">
                Still have <em>questions?</em>
              </h2>
              <p className="mt-5 leading-7 text-ink-muted">
                Our team is here to help. Reach out and get personalized answers about your situation.
              </p>
              <Link
                href="/contact"
                className="group/cta mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink-foreground px-7 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5),0_1px_3px_hsl(0_0%_0%/0.4)] transition-[background-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-white active:scale-[0.97]"
              >
                Contact Us
                <ArrowUpRight className="h-4 w-4 transition-transform duration-[160ms] ease-[var(--ease-out)] group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

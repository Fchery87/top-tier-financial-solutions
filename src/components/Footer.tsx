import Link from 'next/link';
import { Mail, MapPin, ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { NewsletterSignup } from '@/components/NewsletterSignup';

const footerLinks = {
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'How It Works', href: '/how-it-works' },
    { name: 'Contact', href: '/contact' },
  ],
  legal: [
    { name: 'Compliance & Rights', href: '/compliance' },
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'FAQ', href: '/faq' },
  ],
  social: [
    { name: 'Instagram', href: '#' },
    { name: 'Twitter', href: '#' },
    { name: 'LinkedIn', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="brand-footer relative overflow-hidden">
      <div className="absolute inset-0 rule-grid-ink" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent" aria-hidden />

      <div className="container relative z-10 mx-auto px-4 pt-16 pb-10 md:px-6 md:pt-20">
        {/* Editorial close */}
        <div className="mb-14 max-w-3xl md:mb-20">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-brass">
            Top Tier Financial Solutions
          </p>
          <p className="font-editorial mt-4 text-3xl leading-[1.15] text-ink-foreground md:text-5xl">
            Your credit history is a record.
            <br />
            <em>Your future doesn&rsquo;t have to be.</em>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 border-t border-ink-border pt-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="flex flex-col gap-6">
            <Logo variant="light" size="sm" />
            <p className="brand-footer-copy max-w-xs text-sm leading-relaxed">
              Compliant credit repair operations — disputes, documentation, and client clarity in one system.
            </p>
            <div className="flex gap-2.5">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="flex size-9 items-center justify-center rounded-lg border border-ink-border bg-ink-raised text-ink-muted transition-[border-color,color,transform] duration-[160ms] ease-[var(--ease-out)] hover:border-brass/40 hover:text-ink-foreground active:scale-[0.96]"
                >
                  <span className="sr-only">{item.name}</span>
                  <span className="text-xs font-bold">{item.name.charAt(0)}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="brand-footer-heading mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.22em]">
              Company
            </h4>
            <ul className="flex flex-col gap-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="brand-footer-copy group inline-flex items-center gap-1 text-sm transition-colors duration-[160ms] ease-[var(--ease-out)] hover:text-ink-foreground"
                  >
                    {item.name}
                    <ArrowUpRight className="size-3 opacity-0 transition-opacity duration-[160ms] ease-[var(--ease-out)] group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="brand-footer-heading mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.22em]">
              Legal
            </h4>
            <ul className="flex flex-col gap-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="brand-footer-copy group inline-flex items-center gap-1 text-sm transition-colors duration-[160ms] ease-[var(--ease-out)] hover:text-ink-foreground"
                  >
                    {item.name}
                    <ArrowUpRight className="size-3 opacity-0 transition-opacity duration-[160ms] ease-[var(--ease-out)] group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <NewsletterSignup
              variant="footer"
              title="Stay Updated"
              description="Credit insights and platform updates, occasionally."
              source="footer"
            />
            <div className="mt-6 flex flex-col gap-3">
              <div className="brand-footer-copy flex items-center gap-3 text-sm">
                <MapPin className="size-4 text-brass/70" />
                <span>New York, NY</span>
              </div>
              <div className="brand-footer-copy flex items-center gap-3 text-sm">
                <Mail className="size-4 text-brass/70" />
                <a href="mailto:info@toptierfinancial.com" className="transition-colors hover:text-ink-foreground">
                  info@toptierfinancial.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-ink-border pt-7">
          <div className="brand-footer-muted flex flex-col items-center justify-between gap-3 text-[13px] md:flex-row">
            <p>&copy; {new Date().getFullYear()} Top Tier Financial Solutions. All rights reserved.</p>
            <p className="brand-footer-muted max-w-md text-center md:text-right">
              Credit repair services are regulated under CROA &amp; FCRA. Individual results vary.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

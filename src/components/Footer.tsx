'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
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
    <footer className="brand-footer relative overflow-hidden" style={{ backgroundColor: '#080A0F', color: '#E2E8F0' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-secondary/10 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/8 blur-[120px]" />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

      <div className="container relative z-10 mx-auto px-4 py-16 md:px-6 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            <Logo variant="light" size="md" />
            <p className="brand-footer-copy max-w-xs text-sm leading-relaxed" style={{ color: 'rgb(226 232 240 / 0.84)' }}>
              Empowering you to take control of your financial future with expert credit repair solutions.
            </p>
            <div className="flex gap-3">
              {footerLinks.social.map((item) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex size-10 items-center justify-center rounded-lg border border-secondary/35 bg-secondary/12 text-secondary transition-colors duration-200 hover:bg-secondary hover:text-primary"
                >
                  <span className="sr-only">{item.name}</span>
                  <span className="text-xs font-bold">{item.name.charAt(0)}</span>
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h4 className="brand-footer-heading mb-6 text-lg font-bold tracking-wide" style={{ color: '#6EE7B7' }}>Company</h4>
            <ul className="flex flex-col gap-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="brand-footer-copy group inline-flex items-center gap-1 text-sm transition-colors duration-200 hover:text-secondary"
                    style={{ color: 'rgb(226 232 240 / 0.84)' }}
                  >
                    {item.name}
                    <ArrowUpRight className="size-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h4 className="brand-footer-heading mb-6 text-lg font-bold tracking-wide" style={{ color: '#6EE7B7' }}>Legal</h4>
            <ul className="flex flex-col gap-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="brand-footer-copy group inline-flex items-center gap-1 text-sm transition-colors duration-200 hover:text-secondary"
                    style={{ color: 'rgb(226 232 240 / 0.84)' }}
                  >
                    {item.name}
                    <ArrowUpRight className="size-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <NewsletterSignup
              variant="footer"
              title="Stay Updated"
              description="Get credit tips and financial insights delivered to your inbox."
              source="footer"
            />
            <div className="mt-6 flex flex-col gap-3">
              <div className="brand-footer-copy flex items-center gap-3 text-sm" style={{ color: 'rgb(226 232 240 / 0.84)' }}>
                <MapPin className="size-4 text-secondary" />
                <span>New York, NY</span>
              </div>
              <div className="brand-footer-copy flex items-center gap-3 text-sm" style={{ color: 'rgb(226 232 240 / 0.84)' }}>
                <Mail className="size-4 text-secondary" />
                <a
                  href="mailto:info@toptierfinancial.com"
                  className="transition-colors hover:text-secondary"
                >
                  info@toptierfinancial.com
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 border-t border-secondary/25 pt-8"
        >
          <div className="brand-footer-muted flex flex-col items-center justify-between gap-4 text-sm md:flex-row" style={{ color: 'rgb(226 232 240 / 0.76)' }}>
            <p>&copy; {new Date().getFullYear()} Top Tier Financial Solutions. All rights reserved.</p>
            <p className="flex items-center gap-2">
              Designed with <span className="brand-footer-heading" style={{ color: '#6EE7B7' }}>precision</span> for your success
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

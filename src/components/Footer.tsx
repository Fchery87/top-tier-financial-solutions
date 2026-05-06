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
    <footer className="relative bg-primary text-primary-foreground overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-secondary/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

      <div className="container relative z-10 mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <Logo variant="light" size="md" />
            <p className="text-sm leading-relaxed text-primary-foreground/60 max-w-xs">
              Empowering you to take control of your financial future with expert credit repair solutions.
            </p>
            <div className="flex gap-3">
              {footerLinks.social.map((item) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary hover:bg-secondary hover:text-white transition-all duration-300"
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
            <h4 className="text-secondary font-bold mb-6 tracking-wide text-lg">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-primary-foreground/60 hover:text-secondary transition-colors duration-200 inline-flex items-center gap-1 group"
                  >
                    {item.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
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
            <h4 className="text-secondary font-bold mb-6 tracking-wide text-lg">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-primary-foreground/60 hover:text-secondary transition-colors duration-200 inline-flex items-center gap-1 group"
                  >
                    {item.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
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
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-primary-foreground/60">
                <MapPin className="w-4 h-4 text-secondary" />
                <span>New York, NY</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-primary-foreground/60">
                <Mail className="w-4 h-4 text-secondary" />
                <a
                  href="mailto:info@toptierfinancial.com"
                  className="hover:text-secondary transition-colors"
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
          className="mt-16 pt-8 border-t border-secondary/10"
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/50">
            <p>&copy; {new Date().getFullYear()} Top Tier Financial Solutions. All rights reserved.</p>
            <p className="flex items-center gap-2">
              Designed with <span className="text-secondary">precision</span> for your success
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

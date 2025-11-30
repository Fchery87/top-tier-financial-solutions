'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, MapPin, ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/Logo';

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
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[120px]" />
      </div>
      
      {/* Top Gradient Border */}
      <div className="h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
      
      <div className="container relative z-10 mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <Logo variant="light" size="md" />
            <p className="text-sm leading-relaxed text-primary-foreground/70 max-w-xs">
              Empowering you to take control of your financial future with expert credit repair solutions.
            </p>
            <div className="flex gap-4">
              {footerLinks.social.map((item) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary hover:bg-secondary hover:text-primary transition-all duration-300"
                >
                  <span className="sr-only">{item.name}</span>
                  <span className="text-xs font-bold">{item.name.charAt(0)}</span>
                </motion.a>
              ))}
            </div>
          </motion.div>
          
          {/* Company Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h4 className="text-secondary font-bold mb-6 font-serif tracking-wide text-lg">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link 
                    href={item.href} 
                    className="text-sm text-primary-foreground/70 hover:text-secondary transition-colors duration-300 inline-flex items-center gap-1 group"
                  >
                    {item.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h4 className="text-secondary font-bold mb-6 font-serif tracking-wide text-lg">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link 
                    href={item.href} 
                    className="text-sm text-primary-foreground/70 hover:text-secondary transition-colors duration-300 inline-flex items-center gap-1 group"
                  >
                    {item.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h4 className="text-secondary font-bold mb-6 font-serif tracking-wide text-lg">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <span className="text-sm font-medium block mb-1">Headquarters</span>
                  <span className="text-sm text-primary-foreground/70">New York, NY</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <span className="text-sm font-medium block mb-1">Email</span>
                  <a 
                    href="mailto:info@toptierfinancial.com" 
                    className="text-sm text-primary-foreground/70 hover:text-secondary transition-colors duration-300"
                  >
                    info@toptierfinancial.com
                  </a>
                </div>
              </li>
            </ul>
          </motion.div>
        </div>
        
        {/* Bottom Bar */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 pt-8 border-t border-secondary/10"
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/60">
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

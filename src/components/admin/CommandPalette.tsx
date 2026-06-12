'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutDashboard, Users, Scale, CheckSquare, FileText, Settings, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

const commands = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Clients', href: '/admin/clients', icon: Users },
  { label: 'New Dispute', href: '/admin/disputes/wizard', icon: Scale },
  { label: 'Disputes', href: '/admin/disputes', icon: Scale },
  { label: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
  { label: 'Billing', href: '/admin/billing', icon: CreditCard },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const openHandler = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('open-command-palette', openHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('open-command-palette', openHandler);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [open]);

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg mx-4"
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="flex-1 h-12 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded border border-border">
                  ESC
                </kbd>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
                {filtered.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => handleSelect(cmd.href)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <cmd.icon className="w-4 h-4 text-muted-foreground" />
                    <span>{cmd.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

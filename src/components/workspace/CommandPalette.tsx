'use client';

import * as React from 'react';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import {
  CheckSquare,
  CreditCard,
  FileText,
  LayoutDashboard,
  Loader2,
  Scale,
  Search,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { WorkspaceSearchResult } from '@/lib/workspace-search';

type Command = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

const commands: Command[] = [
  { label: 'Dashboard', href: '/workspace', icon: LayoutDashboard },
  { label: 'Clients', href: '/workspace/clients', icon: Users },
  { label: 'New Dispute', href: '/workspace/disputes/wizard', icon: Scale },
  { label: 'Disputes', href: '/workspace/disputes', icon: Scale },
  { label: 'Tasks', href: '/workspace/tasks', icon: CheckSquare },
  { label: 'Billing', href: '/workspace/billing', icon: CreditCard },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

function isWorkspaceSearchResult(value: unknown): value is WorkspaceSearchResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as Record<string, unknown>;
  return (
    (result.kind === 'client' || result.kind === 'dispute')
    && typeof result.id === 'string'
    && typeof result.label === 'string'
    && typeof result.description === 'string'
    && typeof result.href === 'string'
  );
}

function readSearchResults(value: unknown): WorkspaceSearchResult[] {
  if (!value || typeof value !== 'object') return [];
  const results = (value as { results?: unknown }).results;
  return Array.isArray(results) ? results.filter(isWorkspaceSearchResult) : [];
}

function resultIcon(result: WorkspaceSearchResult) {
  return result.kind === 'client' ? UserRound : Scale;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<WorkspaceSearchResult[]>([]);
  const [searchState, setSearchState] = React.useState<SearchState>('idle');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
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
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    setQuery('');
    setResults([]);
    setSearchState('idle');
    setActiveIndex(0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  React.useEffect(() => {
    const normalizedQuery = query.trim();
    setActiveIndex(0);

    if (normalizedQuery.length < 2) {
      setResults([]);
      setSearchState('idle');
      return;
    }

    const controller = new AbortController();
    const searchTimer = window.setTimeout(async () => {
      setSearchState('loading');
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('Search request failed');

        const body: unknown = await response.json();
        const nextResults = readSearchResults(body);
        setResults(nextResults);
        setSearchState(nextResults.length > 0 ? 'results' : 'empty');
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchState('error');
      }
    }, 250);

    return () => {
      window.clearTimeout(searchTimer);
      controller.abort();
    };
  }, [query]);

  const filteredCommands = query
    ? commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const selectableItems = query.trim().length >= 2
    ? results.map((result) => ({
        label: result.label,
        href: result.href,
        kind: result.kind,
      }))
    : filteredCommands.map((command) => ({
        label: command.label,
        href: command.href,
        kind: 'command' as const,
      }));

  const handleSelect = React.useCallback((href: string) => {
    router.push(href);
    setOpen(false);
  }, [router]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && selectableItems.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % selectableItems.length);
    }
    if (event.key === 'ArrowUp' && selectableItems.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + selectableItems.length) % selectableItems.length);
    }
    if (event.key === 'Enter' && selectableItems[activeIndex]) {
      event.preventDefault();
      handleSelect(selectableItems[activeIndex].href);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Workspace command palette">
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
            className="absolute top-[15%] left-1/2 w-full max-w-lg mx-4 -translate-x-1/2"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search clients, disputes, or pages…"
                  aria-label="Workspace record search"
                  className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {searchState === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Searching" />}
                <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-flex">ESC</kbd>
              </div>

              <div className="max-h-96 overflow-y-auto p-2">
                {query.trim().length < 2 && (
                  <CommandGroup
                    label="Navigation"
                    commands={filteredCommands}
                    activeIndex={activeIndex}
                    onSelect={handleSelect}
                  />
                )}

                {query.trim().length >= 2 && (
                  <>
                    {results.some((result) => result.kind === 'client') && (
                      <SearchResultGroup
                        label="Clients"
                        results={results.filter((result) => result.kind === 'client')}
                        activeIndex={activeIndex}
                        onSelect={handleSelect}
                      />
                    )}
                    {results.some((result) => result.kind === 'dispute') && (
                      <SearchResultGroup
                        label="Disputes"
                        results={results.filter((result) => result.kind === 'dispute')}
                        activeIndex={activeIndex}
                        offset={results.filter((result) => result.kind === 'client').length}
                        onSelect={handleSelect}
                      />
                    )}
                    {searchState === 'empty' && <p className="px-3 py-5 text-center text-sm text-muted-foreground">No matching records.</p>}
                    {searchState === 'error' && <p className="px-3 py-5 text-center text-sm text-destructive">Unable to search records.</p>}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CommandGroup({
  label,
  commands: groupCommands,
  activeIndex,
  onSelect,
}: {
  label: string;
  commands: Command[];
  activeIndex: number;
  onSelect: (href: string) => void;
}) {
  return (
    <section aria-label={label}>
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="space-y-0.5">
        {groupCommands.map((command, index) => (
          <Link
            key={command.label}
            href={command.href}
            aria-pressed={index === activeIndex}
            onClick={(event) => {
              event.preventDefault();
              onSelect(command.href);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <command.icon className="h-4 w-4 text-muted-foreground" />
            <span>{command.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SearchResultGroup({
  label,
  results,
  activeIndex,
  offset = 0,
  onSelect,
}: {
  label: string;
  results: WorkspaceSearchResult[];
  activeIndex: number;
  offset?: number;
  onSelect: (href: string) => void;
}) {
  return (
    <section aria-label={label}>
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="space-y-0.5">
        {results.map((result, index) => {
          const Icon = resultIcon(result);
          return (
            <Link
              key={`${result.kind}-${result.id}`}
              href={result.href}
              aria-pressed={offset + index === activeIndex}
              aria-label={`${result.label}, ${result.description}`}
              onClick={(event) => {
                event.preventDefault();
                onSelect(result.href);
              }}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate">{result.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{result.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

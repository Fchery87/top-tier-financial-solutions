'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, User, LogOut, Settings, LayoutDashboard, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from '@/lib/auth-client';

const navigation = [
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Services', href: '/services' },
  { name: 'Compliance', href: '/compliance' },
  { name: 'Blog', href: '/blog' },
  { name: 'About', href: '/about' },
];

const navLinkClass =
  'relative whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-[color,background-color] duration-[160ms] ease-[var(--ease-out)]';

const menuItemClass =
  'flex items-center gap-2 px-4 py-3 text-sm transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)]';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: _isLoading } = useAuth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  React.useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full text-ink-foreground transition-[background-color,border-color,box-shadow] duration-[200ms] ease-[var(--ease-out)]',
        scrolled
          ? 'border-b border-ink-border bg-[hsl(var(--ink))]/92 shadow-[0_1px_2px_hsl(0_0%_0%/0.2)] backdrop-blur-xl'
          : 'border-b border-transparent bg-[hsl(var(--ink))]/65 backdrop-blur-md'
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <Logo size="sm" variant="light" />

        {/* Desktop Navigation */}
        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  navLinkClass,
                  active
                    ? 'text-ink-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-brass'
                    : 'text-ink-muted hover:text-ink-foreground'
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <ThemeToggle className="text-ink-muted hover:bg-white/[0.08] hover:text-ink-foreground" />
          {mounted && user ? (
            <div className="relative">
              <button
                type="button"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg border border-ink-border bg-ink-raised px-2.5 py-1.5 transition-[border-color,background-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:border-brass/40 active:scale-[0.98]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-foreground text-[11px] font-semibold text-ink">
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[100px] truncate text-sm font-medium text-ink-foreground">
                  {user.name || 'Account'}
                </span>
              </button>
              {userMenuOpen && (
                <div
                  role="menu"
                  className="ui-popover surface-panel absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg shadow-[0_8px_24px_-8px_hsl(24_10%_10%/0.18)]"
                >
                  {(user.role === 'super_admin' || user.role === 'admin') && (
                    <>
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className={cn(menuItemClass, 'font-medium text-foreground hover:bg-muted')}
                      >
                        <LayoutDashboard className="h-4 w-4 text-secondary" />
                        Admin Dashboard
                      </Link>
                      <div className="border-t border-border" />
                    </>
                  )}
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(menuItemClass, 'text-foreground hover:bg-muted')}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(menuItemClass, 'text-foreground hover:bg-muted')}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <div className="border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className={cn(menuItemClass, 'w-full text-left text-destructive hover:bg-destructive/10')}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-[160ms] ease-[var(--ease-out)] hover:text-ink-foreground"
            >
              Sign In
            </Link>
          )}
          <Button
            asChild
            size="sm"
            className="h-9 bg-ink-foreground px-4 text-ink shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5)] hover:bg-white"
          >
            <Link href="/contact" className="group/cta flex items-center gap-1.5">
              Book Consultation
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-[160ms] ease-[var(--ease-out)] group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3 lg:hidden">
          <ThemeToggle className="text-ink-muted hover:bg-white/[0.08] hover:text-ink-foreground" />
          <button
            type="button"
            className="rounded-md p-2 text-ink-muted transition-[background-color,color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-white/[0.08] hover:text-ink-foreground active:scale-[0.96]"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="ui-mobile-menu surface-ink fixed inset-x-0 top-16 z-40 border-b border-ink-border shadow-[0_24px_48px_-24px_hsl(0_0%_0%/0.5)] lg:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-5" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'block rounded-lg px-4 py-3 text-base font-medium transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)]',
                  pathname === item.href
                    ? 'bg-white/[0.08] text-ink-foreground'
                    : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink-foreground'
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="mt-3 space-y-2.5 border-t border-ink-border pt-4">
              {mounted && user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-foreground text-sm font-semibold text-ink">
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium text-ink-foreground">{user.name || 'User'}</p>
                      <p className="text-sm text-ink-muted">Signed in</p>
                    </div>
                  </div>
                  {(user.role === 'super_admin' || user.role === 'admin') && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium text-ink-foreground transition-[background-color] duration-[160ms] ease-[var(--ease-out)] hover:bg-white/[0.05]"
                    >
                      <LayoutDashboard className="h-5 w-5 text-brass" />
                      Admin Dashboard
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-ink-foreground transition-[background-color] duration-[160ms] ease-[var(--ease-out)] hover:bg-white/[0.05]"
                  >
                    <User className="h-5 w-5" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-ink-foreground transition-[background-color] duration-[160ms] ease-[var(--ease-out)] hover:bg-white/[0.05]"
                  >
                    <Settings className="h-5 w-5" />
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-destructive transition-[background-color] duration-[160ms] ease-[var(--ease-out)] hover:bg-destructive/10"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Button
                  className="h-11 w-full border-ink-border bg-ink-raised text-ink-foreground hover:border-brass/40 hover:bg-ink-raised"
                  variant="outline"
                  asChild
                >
                  <Link href="/sign-in" className="flex items-center justify-center gap-2">
                    Sign In
                  </Link>
                </Button>
              )}
              <Button className="h-11 w-full bg-ink-foreground text-ink hover:bg-white" asChild>
                <Link href="/contact" className="flex items-center justify-center gap-2">
                  Book Consultation
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

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
  { name: 'Home', href: '/' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Services', href: '/services' },
  { name: 'Blog', href: '/blog' },
  { name: 'Compliance', href: '/compliance' },
  { name: 'About', href: '/about' },
];

const navLinkClass =
  'relative whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-[160ms] ease-[var(--ease-out)]';

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
        'fixed top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-[200ms] ease-[var(--ease-out)]',
        scrolled
          ? 'border-b border-border/70 bg-background/92 shadow-sm backdrop-blur-md'
          : 'bg-background/40 backdrop-blur-[2px]'
      )}
    >
      <div className="container mx-auto flex h-18 items-center justify-between gap-4 px-4 md:px-6">
        <Logo size="md" />

        {/* Desktop Navigation */}
        <nav className="hidden min-w-0 items-center gap-1 md:flex" aria-label="Primary navigation">
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
                    ? 'bg-accent text-secondary shadow-[inset_0_0_0_1px_hsl(var(--secondary)/0.14)]'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )}
              >
                {item.name}
              </Link>
            );
          })}
          <div className="ml-4 flex items-center gap-3 border-l border-border pl-4 lg:ml-6 lg:pl-6">
            <ThemeToggle />
            {mounted && user ? (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 transition-[background-color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-accent active:scale-[0.98]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="max-w-[100px] truncate text-sm font-medium text-foreground">
                    {user.name || 'User'}
                  </span>
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="ui-popover absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg surface-panel"
                  >
                    {(user.role === 'super_admin' || user.role === 'admin') && (
                      <>
                        <Link
                          href="/admin"
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                          className={cn(menuItemClass, 'font-medium text-secondary hover:bg-accent')}
                        >
                          <LayoutDashboard className="h-4 w-4" />
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
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign In</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/contact" className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Book Consultation
              </Link>
            </Button>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground transition-[background-color,color,transform] duration-[160ms] ease-[var(--ease-out)] hover:bg-accent hover:text-foreground active:scale-[0.96]"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="ui-mobile-menu fixed inset-x-0 top-18 z-40 border-b border-border bg-background shadow-2xl shadow-foreground/10 md:hidden">
          <nav className="container mx-auto flex flex-col gap-2 px-4 py-6" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'block rounded-lg px-4 py-3 text-lg font-medium transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)]',
                  pathname === item.href
                    ? 'bg-accent text-secondary'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="mt-2 space-y-3 border-t border-border pt-4">
              {mounted && user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">Signed in</p>
                    </div>
                  </div>
                  {(user.role === 'super_admin' || user.role === 'admin') && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium text-secondary transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)] hover:bg-accent"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      Admin Dashboard
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-foreground transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)] hover:bg-muted"
                  >
                    <User className="h-5 w-5" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-foreground transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)] hover:bg-muted"
                  >
                    <Settings className="h-5 w-5" />
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-destructive transition-[background-color,color] duration-[160ms] ease-[var(--ease-out)] hover:bg-destructive/10"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Button className="h-12 w-full rounded-lg text-lg" variant="outline" asChild>
                  <Link href="/sign-in" className="flex items-center justify-center gap-2">
                    <User className="h-5 w-5" />
                    Sign In
                  </Link>
                </Button>
              )}
              <Button className="h-12 w-full rounded-lg bg-secondary text-lg text-secondary-foreground shadow-sm" asChild>
                <Link href="/contact" className="flex items-center justify-center gap-2">
                  <ArrowUpRight className="h-5 w-5" />
                  Book Consultation
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

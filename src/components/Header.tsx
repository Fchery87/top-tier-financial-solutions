'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Sparkles, User, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  { name: 'Compliance', href: '/compliance' },
  { name: 'About', href: '/about' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Prevent hydration mismatch by only showing auth-dependent UI after mount
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
  }, [pathname]);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-500",
        scrolled 
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5" 
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Logo size="md" />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navigation.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg",
                  pathname === item.href 
                    ? "text-secondary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.name}
                {pathname === item.href && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-secondary/10 rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            </motion.div>
          ))}
          <div className="flex items-center gap-3 ml-6 pl-6 border-l border-border/50">
            <ThemeToggle />
            {mounted && user ? (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-secondary/10 hover:bg-secondary/20 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
                    {user.name || 'User'}
                  </span>
                </motion.button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      {(user.role === 'super_admin' || user.role === 'admin') && (
                        <>
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-3 text-sm text-secondary font-medium hover:bg-secondary/10 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Admin Dashboard
                          </Link>
                          <div className="border-t border-border" />
                        </>
                      )}
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      <div className="border-t border-border" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button asChild variant="outline" className="rounded-full px-4">
                <Link href="/sign-in">Sign In</Link>
              </Button>
            )}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full px-6 shadow-lg shadow-secondary/20 hover:shadow-secondary/40 transition-shadow">
                <Link href="/contact" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Book Consultation
                </Link>
              </Button>
            </motion.div>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
          <ThemeToggle />
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="md:hidden fixed inset-x-0 top-20 z-40 bg-background/98 backdrop-blur-xl border-b border-border overflow-hidden"
          >
            <nav className="container mx-auto px-4 py-6 flex flex-col gap-2">
              {navigation.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "block text-lg font-medium py-3 px-4 rounded-lg transition-all",
                      pathname === item.href 
                        ? "text-secondary bg-secondary/10" 
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {item.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="pt-4 mt-2 border-t border-border space-y-3"
              >
                {mounted && user ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.name || 'User'}</p>
                        <p className="text-sm text-muted-foreground">Signed in</p>
                      </div>
                    </div>
                    {(user.role === 'super_admin' || user.role === 'admin') && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-4 py-3 text-secondary font-medium hover:bg-secondary/10 rounded-lg transition-colors"
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        Admin Dashboard
                      </Link>
                    )}
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <User className="w-5 h-5" />
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                      Account Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                    >
                      <LogOut className="w-5 h-5" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Button className="w-full h-12 text-lg rounded-full" variant="outline" asChild>
                    <Link href="/sign-in" className="flex items-center justify-center gap-2">
                      <User className="w-5 h-5" />
                      Sign In
                    </Link>
                  </Button>
                )}
                <Button className="w-full bg-secondary text-secondary-foreground h-12 text-lg rounded-full shadow-lg shadow-secondary/20" asChild>
                  <Link href="/contact" className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Book Consultation
                  </Link>
                </Button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

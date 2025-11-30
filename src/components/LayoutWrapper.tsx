'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

function HeaderFallback() {
  return (
    <header className="fixed top-0 z-50 w-full h-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
        <div className="hidden md:flex items-center gap-4">
          <div className="h-4 w-16 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-16 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-16 bg-muted/50 rounded animate-pulse" />
        </div>
      </div>
    </header>
  );
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main id="main-content" role="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}

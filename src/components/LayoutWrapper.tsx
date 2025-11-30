'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const isAuthRoute = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');

  if (isAdminRoute || isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main id="main-content" role="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}

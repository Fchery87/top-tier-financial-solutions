import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipWrapper } from "./providers";
import { Analytics } from '@/components/Analytics';
import { SkipLink } from '@/components/SkipLink';
import { LayoutWrapper } from '@/components/LayoutWrapper';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const jetbrainsMono = Geist_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
    themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFBFC' },
    { media: '(prefers-color-scheme: dark)', color: '#080A0F' },
  ],
};

export const metadata: Metadata = {
  title: "Top Tier Financial Solutions",
  description: "A premium credit repair operations platform for compliant client onboarding, dispute workflows, and financial restoration.",
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Top Tier Financial',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <Analytics />
          <SkipLink />
          <TooltipWrapper>
            <AuthProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </AuthProvider>
          </TooltipWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}

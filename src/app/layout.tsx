import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { TooltipWrapper } from "./providers";
import { Analytics } from '@/components/Analytics';
import { SkipLink } from '@/components/SkipLink';
import { LayoutWrapper } from '@/components/LayoutWrapper';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Satoshi (Fontshare) — self-hosted primary typeface for headings + body.
const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    { path: "../fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/Satoshi-Black.woff2", weight: "900", style: "normal" },
  ],
});

const jetbrainsMono = Geist_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// Instrument Serif — editorial display voice for marketing headlines only.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
    themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF8' },
    { media: '(prefers-color-scheme: dark)', color: '#151311' },
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
      <body className={`${satoshi.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} font-sans antialiased`}>
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

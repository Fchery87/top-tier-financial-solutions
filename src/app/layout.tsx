import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Manrope } from "next/font/google";
import "./globals.css";
import { TooltipWrapper } from "./providers";
import { Analytics } from '@/components/Analytics';
import { SkipLink } from '@/components/SkipLink';
import { LayoutWrapper } from '@/components/LayoutWrapper';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F8F6' },
    { media: '(prefers-color-scheme: dark)', color: '#07090D' },
  ],
};

export const metadata: Metadata = {
  title: "Top Tier Financial Solutions",
  description: "Expert credit repair and financial planning services.",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${sourceSerif.variable} ${manrope.variable} font-sans antialiased`}>
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

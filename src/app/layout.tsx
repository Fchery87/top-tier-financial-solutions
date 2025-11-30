import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { StackProvider } from "@stackframe/stack";
import { stackServerApp } from "@/stack";
import { TooltipWrapper } from "./providers";
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Analytics } from '@/components/Analytics';
import { SkipLink } from '@/components/SkipLink';

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
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
      <body className={`${playfair.variable} ${jakarta.variable} font-sans antialiased`}>
        <Analytics />
        <SkipLink />
        <TooltipWrapper>
          <StackProvider app={stackServerApp}>
            <Header />
            <main id="main-content" role="main" tabIndex={-1}>
              {children}
            </main>
            <Footer />
          </StackProvider>
        </TooltipWrapper>
      </body>
    </html>
  );
}

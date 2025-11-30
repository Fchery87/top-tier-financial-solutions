import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { StackProvider } from "@stackframe/stack";
import { stackServerApp } from "@/stack";
import { TooltipWrapper } from "./providers";
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

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

export const metadata: Metadata = {
  title: "Top Tier Financial Solutions",
  description: "Expert credit repair and financial planning services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${jakarta.variable} font-sans antialiased`}>
        <TooltipWrapper>
          <StackProvider app={stackServerApp}>
            <Header />
            {children}
            <Footer />
          </StackProvider>
        </TooltipWrapper>
      </body>
    </html>
  );
}

'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}

export function PlausibleAnalytics() {
  if (!PLAUSIBLE_DOMAIN) return null;

  return (
    <Script
      defer
      data-domain={PLAUSIBLE_DOMAIN}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}

export function Analytics() {
  return (
    <>
      <GoogleAnalytics />
      <PlausibleAnalytics />
    </>
  );
}

// Event tracking helper for Google Analytics
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window !== 'undefined' && GA_MEASUREMENT_ID && (window as typeof window & { gtag?: Function }).gtag) {
    (window as typeof window & { gtag: Function }).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

// Page view tracking (for client-side navigation)
export function trackPageView(url: string) {
  if (typeof window !== 'undefined' && GA_MEASUREMENT_ID && (window as typeof window & { gtag?: Function }).gtag) {
    (window as typeof window & { gtag: Function }).gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
}

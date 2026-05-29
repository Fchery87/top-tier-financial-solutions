import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Image Optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cal.com',
      },
    ],
  },

  // Compression
  compress: true,

  // Power optimizations
  poweredByHeader: false,

  // Strict mode for better debugging
  reactStrictMode: true,

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  // Keep Turbopack scoped to this app when parent directories also contain lockfiles.
  turbopack: {
    root: process.cwd(),
  },

  // Server external packages - keep these out of the bundle
  serverExternalPackages: ['pdf-parse', 'canvas', '@napi-rs/canvas'],

  // Headers for public assets. Do not override JS/CSS caching: Next.js/Turbopack
  // need their own revalidation headers for dev chunks, HMR, and RSC payloads.
  headers: async () => {
    const revalidatingPublicAssetCache = 'public, max-age=86400, stale-while-revalidate=604800';

    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: revalidatingPublicAssetCache,
          },
        ],
      },
      {
        source: '/:all*(woff|woff2|ttf|otf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: revalidatingPublicAssetCache,
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});

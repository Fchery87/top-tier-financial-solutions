import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';

// Test-only escape hatch: point the Neon serverless driver at a local
// `wsproxy` in front of a plain Postgres (used by the E2E workflow's
// throwaway database). Ignored in production builds so it can never
// redirect real traffic.
if (process.env.NEON_WS_PROXY && process.env.NODE_ENV !== 'production') {
  const proxy = process.env.NEON_WS_PROXY;
  neonConfig.wsProxy = (host, port) => `${proxy}?address=${host}:${port}`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema });

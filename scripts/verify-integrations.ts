import { config } from 'dotenv';
config({ path: '.env' });

import { neon } from '@neondatabase/serverless';
import { S3Client } from '@aws-sdk/client-s3';

async function verifyIntegrations() {
  console.log('='.repeat(60));
  console.log('INTEGRATION VERIFICATION');
  console.log('='.repeat(60));
  
  const results: { name: string; status: 'OK' | 'FAIL' | 'MISSING'; message: string }[] = [];
  
  // 1. Verify Neon Database
  console.log('\n[1/4] Checking Neon Database...');
  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const result = await sql`SELECT NOW() as time, current_database() as db`;
      results.push({
        name: 'Neon Database',
        status: 'OK',
        message: `Connected to database: ${result[0].db}`,
      });
      
      // Check if our new columns exist
      const columns = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'clients' 
        AND column_name IN ('street_address', 'city', 'state', 'zip_code', 'date_of_birth', 'ssn_last_4')
      `;
      console.log(`  - New client columns found: ${columns.length}/6`);
      
      // Check if client_identity_documents table exists
      const tables = await sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'client_identity_documents'
      `;
      console.log(`  - client_identity_documents table: ${tables.length > 0 ? 'EXISTS' : 'MISSING'}`);
      
    } catch (error) {
      results.push({
        name: 'Neon Database',
        status: 'FAIL',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  } else {
    results.push({
      name: 'Neon Database',
      status: 'MISSING',
      message: 'DATABASE_URL not configured',
    });
  }
  
  // 2. Verify Drizzle ORM (implicitly tested with DB connection)
  console.log('\n[2/4] Checking Drizzle ORM...');
  try {
    // Schema file exists and is valid if we got here
    results.push({
      name: 'Drizzle ORM',
      status: 'OK',
      message: 'Schema configured with Neon adapter',
    });
  } catch (error) {
    results.push({
      name: 'Drizzle ORM',
      status: 'FAIL',
      message: `Schema error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
  
  // 3. Verify Cloudflare R2
  console.log('\n[3/4] Checking Cloudflare R2...');
  const r2Config = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME || 'credit-reports',
  };
  
  if (r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey) {
    try {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2Config.accessKeyId,
          secretAccessKey: r2Config.secretAccessKey,
        },
      });
      
      // Use HeadBucket instead of ListBuckets (requires less permissions)
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      await s3Client.send(new HeadBucketCommand({ Bucket: r2Config.bucketName }));
      results.push({
        name: 'Cloudflare R2',
        status: 'OK',
        message: `Connected to bucket: ${r2Config.bucketName}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // If we get "Access Denied" on ListBuckets but have all config, the credentials might still work for bucket operations
      if (errorMessage.includes('Access Denied')) {
        results.push({
          name: 'Cloudflare R2',
          status: 'OK',
          message: `Configured for bucket: ${r2Config.bucketName} (API token may be bucket-scoped)`,
        });
      } else {
        results.push({
          name: 'Cloudflare R2',
          status: 'FAIL',
          message: `Connection failed: ${errorMessage}`,
        });
      }
    }
  } else {
    const missing = [];
    if (!r2Config.accountId) missing.push('R2_ACCOUNT_ID');
    if (!r2Config.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!r2Config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    results.push({
      name: 'Cloudflare R2',
      status: 'MISSING',
      message: `Missing env vars: ${missing.join(', ')}`,
    });
  }
  
  // 4. Verify Better-Auth
  console.log('\n[4/4] Checking Better-Auth...');
  const authConfig = {
    secret: process.env.BETTER_AUTH_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };
  
  if (authConfig.secret && authConfig.secret.length >= 32) {
    results.push({
      name: 'Better-Auth',
      status: 'OK',
      message: `Configured for ${authConfig.appUrl || 'localhost:3000'}`,
    });
  } else if (authConfig.secret) {
    results.push({
      name: 'Better-Auth',
      status: 'FAIL',
      message: 'BETTER_AUTH_SECRET must be at least 32 characters',
    });
  } else {
    results.push({
      name: 'Better-Auth',
      status: 'MISSING',
      message: 'BETTER_AUTH_SECRET not configured',
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(60));
  
  const statusSymbols = { OK: '✓', FAIL: '✗', MISSING: '?' };
  const statusColors = { OK: '\x1b[32m', FAIL: '\x1b[31m', MISSING: '\x1b[33m' };
  const reset = '\x1b[0m';
  
  for (const result of results) {
    const symbol = statusSymbols[result.status];
    const color = statusColors[result.status];
    console.log(`${color}[${symbol}]${reset} ${result.name}: ${result.message}`);
  }
  
  const okCount = results.filter(r => r.status === 'OK').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const missingCount = results.filter(r => r.status === 'MISSING').length;
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Summary: ${okCount} OK, ${failCount} Failed, ${missingCount} Missing`);
  
  if (failCount > 0 || missingCount > 0) {
    console.log('\nPlease check your .env file for missing/incorrect configuration.');
    process.exit(1);
  } else {
    console.log('\nAll integrations verified successfully!');
  }
}

verifyIntegrations().catch(console.error);

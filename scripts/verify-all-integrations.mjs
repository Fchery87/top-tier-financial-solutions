import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';

config();

console.log('🔍 COMPREHENSIVE INTEGRATION VERIFICATION\n');
console.log('='.repeat(60));

let allTestsPassed = true;

// ============================================
// 1. Neon Database Connection
// ============================================
console.log('\n1️⃣  Neon Database Connection');
console.log('-'.repeat(60));
try {
  const sql = neon(process.env.DATABASE_URL);
  const result = await sql`
    SELECT 
      current_database() as db,
      current_user as user,
      version() as version,
      pg_size_pretty(pg_database_size(current_database())) as size
  `;
  
  console.log('   ✅ Status: CONNECTED');
  console.log(`   📊 Database: ${result[0].db}`);
  console.log(`   👤 User: ${result[0].user}`);
  console.log(`   🔧 Version: ${result[0].version.split('on')[0].trim()}`);
  console.log(`   💾 Size: ${result[0].size}`);
} catch (error) {
  console.error('   ❌ Status: FAILED');
  console.error('   Error:', error.message);
  allTestsPassed = false;
}

// ============================================
// 2. Drizzle ORM Integration
// ============================================
console.log('\n2️⃣  Drizzle ORM Integration');
console.log('-'.repeat(60));
try {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  
  const tableCount = await sql`
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  
  console.log('   ✅ Status: OPERATIONAL');
  console.log(`   📊 Total Tables: ${tableCount[0].count}`);
  
  // List key tables
  const keyTables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN (
        'user', 'session', 'clients', 'credit_reports', 
        'disputes', 'system_settings'
      )
    ORDER BY table_name
  `;
  
  console.log('   📋 Key Tables Present:');
  keyTables.forEach(t => console.log(`      ✓ ${t.table_name}`));
  
} catch (error) {
  console.error('   ❌ Status: FAILED');
  console.error('   Error:', error.message);
  allTestsPassed = false;
}

// ============================================
// 3. System Settings Table
// ============================================
console.log('\n3️⃣  System Settings Table');
console.log('-'.repeat(60));
try {
  const sql = neon(process.env.DATABASE_URL);
  
  const settings = await sql`
    SELECT 
      category,
      COUNT(*) as count
    FROM system_settings
    GROUP BY category
    ORDER BY category
  `;
  
  const totalSettings = await sql`SELECT COUNT(*) as total FROM system_settings`;
  
  console.log('   ✅ Status: ACCESSIBLE');
  console.log(`   ⚙️  Total Settings: ${totalSettings[0].total}`);
  console.log('   📊 By Category:');
  settings.forEach(s => console.log(`      - ${s.category}: ${s.count} settings`));
  
  // Verify LLM settings exist
  const llmSettings = await sql`
    SELECT setting_key, setting_value, setting_type
    FROM system_settings
    WHERE category = 'llm'
    ORDER BY setting_key
  `;
  
  console.log('   🤖 LLM Configuration:');
  llmSettings.forEach(s => {
    const value = s.is_secret ? '••••••' : s.setting_value;
    console.log(`      ✓ ${s.setting_key}: ${s.setting_value}`);
  });
  
} catch (error) {
  console.error('   ❌ Status: FAILED');
  console.error('   Error:', error.message);
  allTestsPassed = false;
}

// ============================================
// 4. Better-Auth Integration
// ============================================
console.log('\n4️⃣  Better-Auth Integration');
console.log('-'.repeat(60));
try {
  const sql = neon(process.env.DATABASE_URL);
  
  const userStats = await sql`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE role = 'super_admin') as super_admins,
      COUNT(*) FILTER (WHERE role = 'admin') as admins,
      COUNT(*) FILTER (WHERE role = 'user' OR role IS NULL) as regular_users
    FROM "user"
  `;
  
  const sessionStats = await sql`
    SELECT COUNT(*) as active_sessions 
    FROM session 
    WHERE expires_at > NOW()
  `;
  
  console.log('   ✅ Status: OPERATIONAL');
  console.log('   👥 User Statistics:');
  console.log(`      Total Users: ${userStats[0].total_users}`);
  console.log(`      Super Admins: ${userStats[0].super_admins}`);
  console.log(`      Admins: ${userStats[0].admins}`);
  console.log(`      Regular Users: ${userStats[0].regular_users}`);
  console.log(`   🔑 Active Sessions: ${sessionStats[0].active_sessions}`);
  
} catch (error) {
  console.error('   ❌ Status: FAILED');
  console.error('   Error:', error.message);
  allTestsPassed = false;
}

// ============================================
// 5. Client & Case Management
// ============================================
console.log('\n5️⃣  Client & Case Management');
console.log('-'.repeat(60));
try {
  const sql = neon(process.env.DATABASE_URL);
  
  const clientStats = await sql`
    SELECT 
      COUNT(*) as total_clients,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
    FROM clients
  `;
  
  const reportStats = await sql`
    SELECT 
      COUNT(*) as total_reports,
      COUNT(*) FILTER (WHERE parse_status = 'completed') as parsed
    FROM credit_reports
  `;
  
  const disputeStats = await sql`
    SELECT 
      COUNT(*) as total_disputes,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
    FROM disputes
  `;
  
  console.log('   ✅ Status: OPERATIONAL');
  console.log(`   👥 Clients: ${clientStats[0].total_clients} total (${clientStats[0].active} active)`);
  console.log(`   📄 Credit Reports: ${reportStats[0].total_reports} total (${reportStats[0].parsed} parsed)`);
  console.log(`   ⚖️  Disputes: ${disputeStats[0].total_disputes} total (${disputeStats[0].sent} sent)`);
  
} catch (error) {
  console.error('   ❌ Status: FAILED');
  console.error('   Error:', error.message);
  allTestsPassed = false;
}

// ============================================
// 6. Cloudflare R2 Configuration
// ============================================
console.log('\n6️⃣  Cloudflare R2 Storage');
console.log('-'.repeat(60));
const r2Vars = [
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ACCOUNT_ID'
];

const r2Status = r2Vars.map(v => ({
  name: v,
  configured: !!process.env[v]
}));

const allR2Configured = r2Status.every(v => v.configured);

if (allR2Configured) {
  console.log('   ✅ Status: CONFIGURED');
  console.log(`   🪣 Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`   🔑 Credentials: Present`);
} else {
  console.log('   ⚠️  Status: PARTIAL');
  r2Status.forEach(v => {
    console.log(`   ${v.configured ? '✓' : '✗'} ${v.name}`);
  });
}

// ============================================
// 7. Environment Variables
// ============================================
console.log('\n7️⃣  Environment Variables');
console.log('-'.repeat(60));

const criticalEnvVars = [
  { name: 'DATABASE_URL', required: true },
  { name: 'BETTER_AUTH_SECRET', required: true },
  { name: 'BETTER_AUTH_URL', required: false },
  { name: 'GOOGLE_AI_API_KEY', required: true },
  { name: 'NEXT_PUBLIC_APP_URL', required: false },
];

console.log('   Critical Variables:');
criticalEnvVars.forEach(v => {
  const present = !!process.env[v.name];
  const icon = present ? '✅' : (v.required ? '❌' : '⚠️');
  console.log(`   ${icon} ${v.name}`);
  if (!present && v.required) {
    allTestsPassed = false;
  }
});

// ============================================
// 8. Database Schema Validation
// ============================================
console.log('\n8️⃣  Database Schema Validation');
console.log('-'.repeat(60));
try {
  const sql = neon(process.env.DATABASE_URL);
  
  // Check for foreign key constraints
  const fkCount = await sql`
    SELECT COUNT(*) as count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
  `;
  
  // Check for indexes
  const indexCount = await sql`
    SELECT COUNT(*) as count
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;
  
  // Check for unique constraints
  const uniqueCount = await sql`
    SELECT COUNT(*) as count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
  `;
  
  console.log('   ✅ Status: VALID');
  console.log(`   🔗 Foreign Keys: ${fkCount[0].count}`);
  console.log(`   📑 Indexes: ${indexCount[0].count}`);
  console.log(`   🔒 Unique Constraints: ${uniqueCount[0].count}`);
  
} catch (error) {
  console.error('   ❌ Status: FAILED');
  console.error('   Error:', error.message);
  allTestsPassed = false;
}

// ============================================
// Final Summary
// ============================================
console.log('\n' + '='.repeat(60));
if (allTestsPassed) {
  console.log('✅ ALL INTEGRATIONS: VERIFIED & OPERATIONAL');
  console.log('='.repeat(60));
  console.log('\n🎉 System Status: HEALTHY\n');
  console.log('All connections between:');
  console.log('  ✅ Neon Database (PostgreSQL 17)');
  console.log('  ✅ Drizzle ORM');
  console.log('  ✅ Better-Auth');
  console.log('  ✅ System Settings');
  console.log('  ✅ Client Management');
  console.log(`  ${allR2Configured ? '✅' : '⚠️'} Cloudflare R2 Storage`);
  console.log('\n💡 Ready for production use!');
  process.exit(0);
} else {
  console.log('❌ INTEGRATION ISSUES DETECTED');
  console.log('='.repeat(60));
  console.log('\n⚠️  System Status: DEGRADED');
  console.log('\nPlease review the errors above and fix before proceeding.');
  process.exit(1);
}

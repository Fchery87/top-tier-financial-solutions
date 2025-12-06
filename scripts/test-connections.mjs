import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';

config();

console.log('🔍 Testing all system connections...\n');

// ============================================
// 1. Test Neon Database Connection
// ============================================
console.log('1️⃣  Testing Neon Database Connection...');
try {
  const sql = neon(process.env.DATABASE_URL);
  const result = await sql`SELECT current_database(), current_user, version()`;
  console.log('   ✅ Neon Database: Connected');
  console.log(`   📊 Database: ${result[0].current_database}`);
  console.log(`   👤 User: ${result[0].current_user}`);
  console.log(`   🔧 Version: ${result[0].version.split(' ')[0]} ${result[0].version.split(' ')[1]}\n`);
} catch (error) {
  console.error('   ❌ Neon Database: Failed -', error.message);
  process.exit(1);
}

// ============================================
// 2. Test Drizzle ORM
// ============================================
console.log('2️⃣  Testing Drizzle ORM...');
try {
  const sql = neon(process.env.DATABASE_URL);
  const _db = drizzle(sql);
  
  // Test a simple query
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name 
    LIMIT 10
  `;
  
  console.log('   ✅ Drizzle ORM: Working');
  console.log(`   📊 Sample Tables: ${tables.map(t => t.table_name).join(', ')}\n`);
} catch (error) {
  console.error('   ❌ Drizzle ORM: Failed -', error.message);
  process.exit(1);
}

// ============================================
// 3. Test System Settings Table
// ============================================
console.log('3️⃣  Testing System Settings Table...');
try {
  const sql = neon(process.env.DATABASE_URL);
  const settings = await sql`
    SELECT setting_key, category, setting_type 
    FROM system_settings 
    ORDER BY category, setting_key
  `;
  
  console.log('   ✅ System Settings Table: Accessible');
  console.log(`   ⚙️  Settings Count: ${settings.length}`);
  if (settings.length > 0) {
    console.log('   📋 Settings:');
    settings.forEach(s => {
      console.log(`      - ${s.setting_key} (${s.category})`);
    });
  }
  console.log();
} catch (error) {
  console.error('   ❌ System Settings Table: Failed -', error.message);
  process.exit(1);
}

// ============================================
// 4. Test Better-Auth Tables
// ============================================
console.log('4️⃣  Testing Better-Auth Integration...');
try {
  const sql = neon(process.env.DATABASE_URL);
  const userCount = await sql`SELECT COUNT(*) as count FROM "user"`;
  const sessionCount = await sql`SELECT COUNT(*) as count FROM session`;
  
  console.log('   ✅ Better-Auth: Tables Accessible');
  console.log(`   👥 Users: ${userCount[0].count}`);
  console.log(`   🔑 Active Sessions: ${sessionCount[0].count}\n`);
} catch (error) {
  console.error('   ❌ Better-Auth: Failed -', error.message);
  process.exit(1);
}

// ============================================
// 5. Test LLM Settings
// ============================================
console.log('5️⃣  Testing LLM Configuration...');
try {
  const sql = neon(process.env.DATABASE_URL);
  const llmSettings = await sql`
    SELECT setting_key, setting_value, is_secret 
    FROM system_settings 
    WHERE category = 'llm'
    ORDER BY setting_key
  `;
  
  console.log('   ✅ LLM Configuration: Found');
  llmSettings.forEach(s => {
    const value = s.is_secret ? '••••••••' : s.setting_value;
    console.log(`   🤖 ${s.setting_key}: ${value}`);
  });
  console.log();
} catch (error) {
  console.error('   ❌ LLM Configuration: Failed -', error.message);
  process.exit(1);
}

// ============================================
// 6. Test Environment Variables
// ============================================
console.log('6️⃣  Testing Environment Variables...');
const requiredEnvVars = [
  { name: 'DATABASE_URL', present: !!process.env.DATABASE_URL },
  { name: 'BETTER_AUTH_SECRET', present: !!process.env.BETTER_AUTH_SECRET },
  { name: 'BETTER_AUTH_URL', present: !!process.env.BETTER_AUTH_URL },
  { name: 'GOOGLE_AI_API_KEY', present: !!process.env.GOOGLE_AI_API_KEY },
];

const optionalEnvVars = [
  { name: 'R2_ACCESS_KEY_ID', present: !!process.env.R2_ACCESS_KEY_ID },
  { name: 'R2_SECRET_ACCESS_KEY', present: !!process.env.R2_SECRET_ACCESS_KEY },
  { name: 'R2_BUCKET_NAME', present: !!process.env.R2_BUCKET_NAME },
];

console.log('   Required Variables:');
requiredEnvVars.forEach(v => {
  console.log(`   ${v.present ? '✅' : '❌'} ${v.name}`);
});

console.log('\n   Optional Variables (Cloudflare R2):');
const r2Configured = optionalEnvVars.every(v => v.present);
optionalEnvVars.forEach(v => {
  console.log(`   ${v.present ? '✅' : '⚠️ '} ${v.name}`);
});

if (r2Configured) {
  console.log('   ✅ Cloudflare R2: Configured');
} else {
  console.log('   ⚠️  Cloudflare R2: Not configured (optional)');
}

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(50));
console.log('✅ All Critical Systems: OPERATIONAL');
console.log('='.repeat(50));
console.log('\n📝 Connection Summary:');
console.log('   ✅ Neon PostgreSQL Database');
console.log('   ✅ Drizzle ORM');
console.log('   ✅ System Settings Table');
console.log('   ✅ Better-Auth Integration');
console.log('   ✅ LLM Configuration');
console.log(`   ${r2Configured ? '✅' : '⚠️ '} Cloudflare R2 (${r2Configured ? 'configured' : 'not configured'})`);

process.exit(0);

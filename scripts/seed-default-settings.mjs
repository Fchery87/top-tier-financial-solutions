import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

console.log('Connecting to database...');
const sql = neon(process.env.DATABASE_URL);

// Default system settings
const defaultSettings = [
  {
    id: randomUUID(),
    setting_key: 'llm.provider',
    setting_value: 'google',
    setting_type: 'string',
    category: 'llm',
    description: 'LLM provider (google, openai, anthropic, custom)',
    is_secret: false,
  },
  {
    id: randomUUID(),
    setting_key: 'llm.model',
    setting_value: 'gemini-2.0-flash-exp', // Gemini 2.5 Flash preview (non-thinking)
    setting_type: 'string',
    category: 'llm',
    description: 'LLM model identifier (e.g., gemini-2.0-flash-exp, gpt-4, claude-3-opus)',
    is_secret: false,
  },
  {
    id: randomUUID(),
    setting_key: 'llm.temperature',
    setting_value: '0.1',
    setting_type: 'number',
    category: 'llm',
    description: 'LLM temperature for generation (0-1). Lower = more deterministic.',
    is_secret: false,
  },
  {
    id: randomUUID(),
    setting_key: 'llm.max_tokens',
    setting_value: '4096',
    setting_type: 'number',
    category: 'llm',
    description: 'Maximum tokens for LLM response generation',
    is_secret: false,
  },
];

console.log('Seeding default system settings...');

for (const setting of defaultSettings) {
  try {
    // Check if setting already exists
    const existing = await sql`
      SELECT id FROM system_settings WHERE setting_key = ${setting.setting_key}
    `;

    if (existing.length > 0) {
      console.log(`⏭️  Skipping "${setting.setting_key}" - already exists`);
      continue;
    }

    // Insert setting
    await sql`
      INSERT INTO system_settings (
        id,
        setting_key,
        setting_value,
        setting_type,
        category,
        description,
        is_secret,
        created_at,
        updated_at
      ) VALUES (
        ${setting.id},
        ${setting.setting_key},
        ${setting.setting_value},
        ${setting.setting_type},
        ${setting.category},
        ${setting.description},
        ${setting.is_secret},
        NOW(),
        NOW()
      )
    `;
    console.log(`✓ Created setting: ${setting.setting_key} = ${setting.setting_value}`);
  } catch (error) {
    console.error(`❌ Error seeding "${setting.setting_key}":`, error);
  }
}

console.log('\n✅ Default settings seeded successfully!');
console.log('\n📝 Next steps:');
console.log('1. Access super admin settings at /admin/settings');
console.log('2. Configure LLM API keys if needed');
console.log('3. Customize LLM model and parameters');

process.exit(0);

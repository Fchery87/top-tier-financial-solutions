/**
 * Seed default email templates for client communication automation
 * 
 * Run with: npx tsx scripts/seed-email-templates.ts
 */

import 'dotenv/config';
import { db } from '../db/client';
import { emailTemplates, emailAutomationRules } from '../db/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { DEFAULT_EMAIL_TEMPLATES } from '../src/lib/email-service';

async function seedEmailTemplates() {
  console.log('Seeding email templates...\n');

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const id = randomUUID();
    
    // Check if template already exists
    const existing = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.triggerType, template.triggerType))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Template for "${template.triggerType}" already exists, skipping...`);
      continue;
    }

    await db.insert(emailTemplates).values({
      id,
      name: template.name,
      triggerType: template.triggerType,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      variables: template.variables,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create default automation rule (immediate send)
    await db.insert(emailAutomationRules).values({
      id: randomUUID(),
      templateId: id,
      triggerType: template.triggerType,
      delayMinutes: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✓ Created template: ${template.name}`);
  }

  console.log('\nEmail templates seeded successfully!');
  process.exit(0);
}

seedEmailTemplates().catch((error) => {
  console.error('Error seeding templates:', error);
  process.exit(1);
});

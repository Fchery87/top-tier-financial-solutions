/**
 * CLEAR and RESEED email templates with clean styling
 * This will delete all existing templates and reseed with the originals
 */

import 'dotenv/config';
import { db } from '../db/client';
import { emailTemplates, emailAutomationRules } from '../db/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { DEFAULT_EMAIL_TEMPLATES } from '../src/lib/email-service';

async function reseedClean() {
  console.log('🧹 Clearing all existing email templates...\n');
  
  // Delete all automation rules first (foreign key constraint)
  await db.delete(emailAutomationRules);
  console.log('   ✅ Deleted automation rules');
  
  // Delete all templates
  await db.delete(emailTemplates);
  console.log('   ✅ Deleted all templates\n');
  
  console.log('🚀 Seeding clean email templates...\n');
  console.log('='.repeat(60));
  
  let transactionalCount = 0;
  let marketingCount = 0;

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const id = randomUUID();

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

    // Create default automation rule for transactional emails only
    if (template.category === 'transactional' && template.triggerType !== 'custom') {
      await db.insert(emailAutomationRules).values({
        id: randomUUID(),
        templateId: id,
        triggerType: template.triggerType,
        delayMinutes: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const category = template.category === 'transactional' ? '📧' : '📬';
    console.log(`${category} Created: ${template.name} (${template.triggerType})`);
    
    if (template.category === 'transactional') {
      transactionalCount++;
    } else {
      marketingCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Clean Email Templates Seeded!\n');
  console.log(`📊 Summary:`);
  console.log(`   Transactional Emails: ${transactionalCount}`);
  console.log(`   Marketing Emails: ${marketingCount}`);
  console.log(`   Total Templates: ${DEFAULT_EMAIL_TEMPLATES.length}`);
  console.log('\n💡 All templates now have clean styling (no grey background)!');
  
  process.exit(0);
}

reseedClean().catch((error) => {
  console.error('\n❌ Error reseeding templates:', error);
  process.exit(1);
});

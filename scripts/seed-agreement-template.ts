import 'dotenv/config';
import { db } from '../db/client';
import { agreementTemplates } from '../db/schema';
import { randomUUID } from 'crypto';
import { NY_SERVICE_AGREEMENT_TEMPLATE, REQUIRED_DISCLOSURES_NY } from '../src/lib/service-agreement-template';

async function seedAgreementTemplate() {
  console.log('Seeding NY GBL Article 28-BB Compliant Agreement Template...');

  try {
    // Check if template already exists
    const existing = await db
      .select()
      .from(agreementTemplates)
      .limit(1);

    if (existing.length > 0) {
      console.log('Agreement templates already exist. Skipping seed.');
      console.log(`Found ${existing.length} existing template(s).`);
      return;
    }

    // Insert the NY-compliant template
    const templateId = randomUUID();
    await db.insert(agreementTemplates).values({
      id: templateId,
      name: 'NY Credit Services Agreement (GBL 28-BB Compliant)',
      version: '1.0',
      content: NY_SERVICE_AGREEMENT_TEMPLATE,
      requiredDisclosures: JSON.stringify(REQUIRED_DISCLOSURES_NY),
      cancellationPeriodDays: 3,
      isActive: true,
    });

    console.log('Successfully seeded agreement template!');
    console.log(`Template ID: ${templateId}`);
    console.log('Template includes:');
    console.log('  - CROA Consumer Rights Notice');
    console.log('  - 13 Client Acknowledgment sections (initials required)');
    console.log('  - NY GBL 458-f compliant fee disclosure');
    console.log('  - Detachable Notice of Cancellation (3 business days)');
    console.log('  - NY-specific disclosures (incorrect info, adverse data limits)');
    console.log('  - Payment Schedule Exhibit');
    console.log('  - Electronic Signature support');

  } catch (error) {
    console.error('Error seeding agreement template:', error);
    throw error;
  }
}

seedAgreementTemplate()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

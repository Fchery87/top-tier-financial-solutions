import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const sql = neon(process.env.DATABASE_URL);

console.log('📧 Email Templates in Database\n');
console.log('='.repeat(80));

const templates = await sql`
  SELECT 
    id,
    name,
    trigger_type,
    subject,
    is_active,
    created_at
  FROM email_templates
  ORDER BY 
    CASE 
      WHEN trigger_type = 'welcome' THEN 1
      WHEN trigger_type = 'agreement_sent' THEN 2
      WHEN trigger_type = 'agreement_signed' THEN 3
      WHEN trigger_type = 'dispute_sent' THEN 4
      WHEN trigger_type = 'response_received' THEN 5
      WHEN trigger_type = 'item_deleted' THEN 6
      WHEN trigger_type = 'progress_report' THEN 7
      WHEN trigger_type = 'payment_received' THEN 8
      ELSE 9
    END,
    created_at
`;

let transactional = 0;
let marketing = 0;

templates.forEach((t, i) => {
  const status = t.is_active ? '✅ Active' : '❌ Inactive';
  const type = ['welcome', 'agreement_sent', 'agreement_signed', 'dispute_sent', 
                'response_received', 'item_deleted', 'progress_report', 'payment_received']
                .includes(t.trigger_type) ? '📧' : '📬';
  
  if (type === '📧') transactional++;
  else marketing++;
  
  console.log(`\n${i + 1}. ${type} ${t.name}`);
  console.log(`   Trigger: ${t.trigger_type}`);
  console.log(`   Subject: ${t.subject}`);
  console.log(`   Status: ${status}`);
  console.log(`   ID: ${t.id}`);
});

console.log('\n' + '='.repeat(80));
console.log(`📊 Summary:`);
console.log(`   Total Templates: ${templates.length}`);
console.log(`   📧 Transactional: ${transactional}`);
console.log(`   📬 Marketing: ${marketing}`);
console.log(`   ✅ Active: ${templates.filter(t => t.is_active).length}`);
console.log(`   ❌ Inactive: ${templates.filter(t => !t.is_active).length}`);

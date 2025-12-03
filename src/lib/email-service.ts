/**
 * Email Service for Client Communication Automation
 * 
 * Supports multiple email providers via environment variables:
 * - RESEND_API_KEY: Use Resend
 * - SENDGRID_API_KEY: Use SendGrid
 * - SMTP_HOST + SMTP_USER + SMTP_PASS: Use SMTP
 * 
 * If no provider is configured, emails are logged but not sent (dev mode).
 */

import { db } from '@/db/client';
import { 
  emailTemplates, 
  emailSendLog, 
  emailAutomationRules,
  clientNotificationPreferences,
  clients 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export type EmailTriggerType = 
  | 'welcome'
  | 'dispute_created'
  | 'dispute_sent'
  | 'response_received'
  | 'item_deleted'
  | 'progress_report'
  | 'agreement_sent'
  | 'agreement_signed'
  | 'payment_received'
  | 'custom';

export interface EmailVariables {
  client_name?: string;
  client_first_name?: string;
  client_email?: string;
  company_name?: string;
  company_phone?: string;
  company_email?: string;
  company_address?: string;
  portal_url?: string;
  // Dispute related
  dispute_count?: number;
  bureau_name?: string;
  creditor_name?: string;
  dispute_round?: number;
  response_deadline?: string;
  // Results related
  items_deleted?: number;
  score_change?: number;
  current_score?: number;
  // Progress report
  total_disputes_sent?: number;
  total_items_removed?: number;
  negative_items_remaining?: number;
  // Custom
  [key: string]: string | number | undefined;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// Company info from environment or defaults
const getCompanyInfo = () => ({
  company_name: process.env.COMPANY_NAME || 'Top Tier Financial Solutions',
  company_phone: process.env.COMPANY_PHONE || '',
  company_email: process.env.COMPANY_EMAIL || process.env.EMAIL_FROM || '',
  company_address: process.env.COMPANY_ADDRESS || '',
  portal_url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});

/**
 * Render a template with variables
 */
export function renderTemplate(template: string, variables: EmailVariables): string {
  let rendered = template;
  
  // Add company info to variables
  const allVariables = { ...getCompanyInfo(), ...variables };
  
  // Replace {{variable_name}} patterns
  for (const [key, value] of Object.entries(allVariables)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(pattern, String(value ?? ''));
  }
  
  // Handle conditional blocks {{#if variable}}...{{/if}}
  rendered = rendered.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => {
      const value = allVariables[varName];
      return value ? content : '';
    }
  );
  
  return rendered;
}

/**
 * Get email provider based on environment configuration
 */
function getEmailProvider(): 'resend' | 'sendgrid' | 'smtp' | 'console' {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (process.env.SMTP_HOST) return 'smtp';
  return 'console';
}

/**
 * Send email via configured provider
 */
async function sendViaProvider(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const provider = getEmailProvider();
  const fromEmail = process.env.EMAIL_FROM || 'noreply@example.com';
  
  switch (provider) {
    case 'resend': {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            reply_to: options.replyTo,
          }),
        });
        
        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.message || 'Resend API error' };
        }
        return { success: true, messageId: data.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    case 'sendgrid': {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: options.to }] }],
            from: { email: fromEmail },
            subject: options.subject,
            content: [
              { type: 'text/html', value: options.html },
              ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
            ],
            reply_to: options.replyTo ? { email: options.replyTo } : undefined,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          return { success: false, error: data.errors?.[0]?.message || 'SendGrid API error' };
        }
        return { success: true, messageId: response.headers.get('x-message-id') || undefined };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    case 'smtp': {
      // SMTP would require a library like nodemailer
      // For now, fall through to console logging
      console.log('[SMTP] Would send email via SMTP (not implemented)');
      return { success: false, error: 'SMTP not implemented - install nodemailer' };
    }
    
    case 'console':
    default: {
      console.log('='.repeat(60));
      console.log('[EMAIL - DEV MODE] Would send email:');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('-'.repeat(60));
      console.log(options.text || 'HTML email - check logs');
      console.log('='.repeat(60));
      return { success: true, messageId: `dev-${Date.now()}` };
    }
  }
}

/**
 * Check if client has opted in for this type of notification
 */
async function checkNotificationPreference(
  clientId: string,
  triggerType: EmailTriggerType
): Promise<boolean> {
  const [prefs] = await db
    .select()
    .from(clientNotificationPreferences)
    .where(eq(clientNotificationPreferences.clientId, clientId))
    .limit(1);
  
  // If no preferences set, default to enabled
  if (!prefs) return true;
  if (!prefs.emailEnabled) return false;
  
  // Check specific preferences
  switch (triggerType) {
    case 'dispute_created':
    case 'dispute_sent':
    case 'response_received':
    case 'item_deleted':
      return prefs.disputeUpdates ?? true;
    case 'progress_report':
      return prefs.progressReports ?? true;
    default:
      return true;
  }
}

/**
 * Log email send attempt
 */
async function logEmailSend(
  clientId: string | null,
  templateId: string | null,
  toEmail: string,
  subject: string,
  triggerType: EmailTriggerType,
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const id = randomUUID();
  
  await db.insert(emailSendLog).values({
    id,
    clientId,
    templateId,
    toEmail,
    subject,
    triggerType,
    status,
    errorMessage,
    sentAt: status === 'sent' ? new Date() : null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date(),
  });
  
  return id;
}

/**
 * Get template by trigger type
 */
export async function getTemplateByTrigger(triggerType: EmailTriggerType) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.triggerType, triggerType),
        eq(emailTemplates.isActive, true)
      )
    )
    .limit(1);
  
  return template;
}

/**
 * Send an automated email to a client
 */
export async function sendAutomatedEmail(
  clientId: string,
  triggerType: EmailTriggerType,
  additionalVariables: EmailVariables = {},
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; logId: string; error?: string }> {
  // Get client info
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  
  if (!client) {
    return { success: false, logId: '', error: 'Client not found' };
  }
  
  // Check notification preferences
  const canSend = await checkNotificationPreference(clientId, triggerType);
  if (!canSend) {
    return { success: false, logId: '', error: 'Client has opted out of this notification type' };
  }
  
  // Get template
  const template = await getTemplateByTrigger(triggerType);
  if (!template) {
    return { success: false, logId: '', error: `No active template found for trigger: ${triggerType}` };
  }
  
  // Build variables
  const variables: EmailVariables = {
    client_name: `${client.firstName} ${client.lastName}`,
    client_first_name: client.firstName,
    client_email: client.email,
    ...additionalVariables,
  };
  
  // Render template
  const renderedSubject = renderTemplate(template.subject, variables);
  const renderedHtml = renderTemplate(template.htmlContent, variables);
  const renderedText = template.textContent ? renderTemplate(template.textContent, variables) : undefined;
  
  // Send email
  const result = await sendViaProvider({
    to: client.email,
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  });
  
  // Log the send
  const logId = await logEmailSend(
    clientId,
    template.id,
    client.email,
    renderedSubject,
    triggerType,
    result.success ? 'sent' : 'failed',
    result.error,
    { ...metadata, messageId: result.messageId }
  );
  
  return {
    success: result.success,
    logId,
    error: result.error,
  };
}

/**
 * Send a custom email (not from template)
 */
export async function sendCustomEmail(
  to: string,
  subject: string,
  html: string,
  options?: {
    clientId?: string;
    text?: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; logId: string; error?: string }> {
  const result = await sendViaProvider({
    to,
    subject,
    html,
    text: options?.text,
    replyTo: options?.replyTo,
  });
  
  const logId = await logEmailSend(
    options?.clientId || null,
    null,
    to,
    subject,
    'custom',
    result.success ? 'sent' : 'failed',
    result.error,
    options?.metadata
  );
  
  return {
    success: result.success,
    logId,
    error: result.error,
  };
}

/**
 * Trigger automation for a specific event
 * This checks automation rules and sends emails accordingly
 */
export async function triggerAutomation(
  triggerType: EmailTriggerType,
  clientId: string,
  variables: EmailVariables = {},
  metadata?: Record<string, unknown>
): Promise<void> {
  // Check if there are any active automation rules for this trigger
  const rules = await db
    .select()
    .from(emailAutomationRules)
    .where(
      and(
        eq(emailAutomationRules.triggerType, triggerType),
        eq(emailAutomationRules.isActive, true)
      )
    );
  
  for (const rule of rules) {
    // Check conditions if any
    if (rule.conditions) {
      try {
        const conditions = JSON.parse(rule.conditions);
        // Simple condition checking - can be expanded
        let conditionsMet = true;
        for (const [key, value] of Object.entries(conditions)) {
          if (variables[key] !== value) {
            conditionsMet = false;
            break;
          }
        }
        if (!conditionsMet) continue;
      } catch {
        // Invalid conditions, skip
        continue;
      }
    }
    
    // Handle delay if specified
    if (rule.delayMinutes && rule.delayMinutes > 0) {
      // In production, this would queue the email for later
      // For now, we'll just note it in the log
      console.log(`[EMAIL] Would delay ${rule.delayMinutes} minutes before sending ${triggerType}`);
      // Could integrate with a job queue like BullMQ, or use a cron job
    }
    
    // Send the email
    await sendAutomatedEmail(clientId, triggerType, variables, metadata);
  }
}

// Default email templates (for seeding)
export const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: 'Welcome Email',
    triggerType: 'welcome' as const,
    subject: 'Welcome to {{company_name}} - Your Credit Repair Journey Begins!',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: #d4af37; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; background: #d4af37; color: #1a1a2e; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome, {{client_first_name}}!</h1>
    </div>
    <div class="content">
      <p>Thank you for choosing {{company_name}} for your credit repair needs.</p>
      <p>We're excited to help you improve your credit score and take control of your financial future.</p>
      <h3>What happens next?</h3>
      <ul>
        <li>Our team will review your credit report</li>
        <li>We'll identify negative items that can be disputed</li>
        <li>You'll receive updates as we work on your case</li>
      </ul>
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{portal_url}}/portal" class="button">Access Your Portal</a>
      </p>
    </div>
    <div class="footer">
      <p>{{company_name}}<br>{{company_address}}<br>{{company_phone}}</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textContent: `Welcome, {{client_first_name}}!

Thank you for choosing {{company_name}} for your credit repair needs.

What happens next?
- Our team will review your credit report
- We'll identify negative items that can be disputed
- You'll receive updates as we work on your case

Access your portal: {{portal_url}}/portal

{{company_name}}
{{company_phone}}`,
    variables: JSON.stringify(['client_name', 'client_first_name', 'company_name', 'portal_url']),
  },
  {
    name: 'Disputes Sent Notification',
    triggerType: 'dispute_sent' as const,
    subject: 'Your Credit Disputes Have Been Sent - {{dispute_count}} Items',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: #d4af37; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .highlight { background: #d4af37; color: #1a1a2e; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #d4af37; color: #1a1a2e; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Disputes Sent!</h1>
    </div>
    <div class="content">
      <p>Hi {{client_first_name}},</p>
      <p>Great news! We've sent your credit dispute letters to the bureaus.</p>
      <div class="highlight">
        <strong>{{dispute_count}} dispute(s)</strong> sent to <strong>{{bureau_name}}</strong>
      </div>
      <h3>What to expect:</h3>
      <ul>
        <li>Credit bureaus have <strong>30 days</strong> to investigate</li>
        <li>Response deadline: <strong>{{response_deadline}}</strong></li>
        <li>We'll notify you when we receive their response</li>
      </ul>
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{portal_url}}/portal" class="button">Track Your Progress</a>
      </p>
    </div>
    <div class="footer">
      <p>{{company_name}}<br>{{company_phone}}</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textContent: `Hi {{client_first_name}},

Great news! We've sent your credit dispute letters.

{{dispute_count}} dispute(s) sent to {{bureau_name}}

What to expect:
- Credit bureaus have 30 days to investigate
- Response deadline: {{response_deadline}}
- We'll notify you when we receive their response

Track your progress: {{portal_url}}/portal

{{company_name}}`,
    variables: JSON.stringify(['client_first_name', 'dispute_count', 'bureau_name', 'response_deadline', 'portal_url']),
  },
  {
    name: 'Item Deleted - Celebration',
    triggerType: 'item_deleted' as const,
    subject: '🎉 Success! Negative Item Removed from Your Credit Report',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #22c55e; color: white; padding: 30px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .win-box { background: #dcfce7; border: 2px solid #22c55e; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations!</h1>
    </div>
    <div class="content">
      <p>Hi {{client_first_name}},</p>
      <p>We have fantastic news!</p>
      <div class="win-box">
        <h2 style="color: #22c55e; margin: 0;">Item Deleted!</h2>
        <p style="font-size: 18px; margin: 10px 0;"><strong>{{creditor_name}}</strong></p>
        <p>Successfully removed from <strong>{{bureau_name}}</strong></p>
      </div>
      <p>This is a big win for your credit journey! Each removed negative item helps improve your credit score.</p>
      {{#if score_change}}
      <p><strong>Estimated impact:</strong> +{{score_change}} points</p>
      {{/if}}
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{portal_url}}/portal" class="button">View Your Results</a>
      </p>
    </div>
    <div class="footer">
      <p>{{company_name}}<br>{{company_phone}}</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textContent: `Hi {{client_first_name}},

🎉 CONGRATULATIONS!

We have fantastic news - a negative item has been removed from your credit report!

DELETED: {{creditor_name}}
Bureau: {{bureau_name}}

This is a big win for your credit journey!

View your results: {{portal_url}}/portal

{{company_name}}`,
    variables: JSON.stringify(['client_first_name', 'creditor_name', 'bureau_name', 'score_change', 'portal_url']),
  },
  {
    name: 'Monthly Progress Report',
    triggerType: 'progress_report' as const,
    subject: 'Your Monthly Credit Repair Progress Report',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: #d4af37; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat-box { text-align: center; padding: 15px; background: white; border-radius: 10px; flex: 1; margin: 0 5px; }
    .stat-number { font-size: 32px; font-weight: bold; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background: #d4af37; color: #1a1a2e; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Monthly Progress Report</h1>
    </div>
    <div class="content">
      <p>Hi {{client_first_name}},</p>
      <p>Here's your credit repair progress summary:</p>
      
      <table width="100%" cellpadding="10" style="margin: 20px 0;">
        <tr>
          <td style="text-align: center; background: white; border-radius: 10px;">
            <div style="font-size: 32px; font-weight: bold; color: #22c55e;">{{total_items_removed}}</div>
            <div style="font-size: 12px; color: #666;">Items Removed</div>
          </td>
          <td style="text-align: center; background: white; border-radius: 10px;">
            <div style="font-size: 32px; font-weight: bold; color: #1a1a2e;">{{total_disputes_sent}}</div>
            <div style="font-size: 12px; color: #666;">Disputes Sent</div>
          </td>
          <td style="text-align: center; background: white; border-radius: 10px;">
            <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">{{current_score}}</div>
            <div style="font-size: 12px; color: #666;">Current Score</div>
          </td>
        </tr>
      </table>
      
      {{#if negative_items_remaining}}
      <p><strong>Items remaining:</strong> {{negative_items_remaining}} negative items still being worked on.</p>
      {{/if}}
      
      <p>We're continuing to work hard on improving your credit. Keep an eye on your portal for the latest updates!</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{portal_url}}/portal" class="button">View Full Report</a>
      </p>
    </div>
    <div class="footer">
      <p>{{company_name}}<br>{{company_phone}}</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    textContent: `Hi {{client_first_name}},

Here's your credit repair progress summary:

ITEMS REMOVED: {{total_items_removed}}
DISPUTES SENT: {{total_disputes_sent}}
CURRENT SCORE: {{current_score}}

{{#if negative_items_remaining}}
Items remaining: {{negative_items_remaining}} negative items still being worked on.
{{/if}}

View your full report: {{portal_url}}/portal

{{company_name}}`,
    variables: JSON.stringify(['client_first_name', 'total_items_removed', 'total_disputes_sent', 'current_score', 'negative_items_remaining', 'portal_url']),
  },
];

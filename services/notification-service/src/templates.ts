import type { NotificationChannel } from '@aci/contracts';

export interface DefaultTemplate {
  key: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
}

/**
 * Seeded on startup when missing; admins can then edit them in Settings → Notifications.
 * Variables available everywhere: {{brand}}, {{studentPortalUrl}}, {{publicSiteUrl}}.
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  { key: 'welcome', channel: 'WHATSAPP', body: 'Welcome to {{brand}}! Complete your athlete profile to start applying for scholarships: {{studentPortalUrl}}/onboarding' },

  { key: 'profile_submitted', channel: 'WHATSAPP', body: 'Hi {{name}}, your athlete profile ({{athleteCode}}) has been submitted. Our team will verify your documents shortly.' },
  { key: 'profile_submitted', channel: 'EMAIL', subject: 'Your {{brand}} athlete profile was submitted', body: 'Hi {{name}},\n\nYour athlete profile ({{athleteCode}}) has been submitted and is now under verification.\n\nYou can browse and apply for scholarships here: {{studentPortalUrl}}/programs\n\n— {{brand}}' },
  { key: 'profile_reviewed', channel: 'WHATSAPP', body: 'Hi {{name}}, your athlete profile review is complete: {{status}}. {{remarks}} Details: {{studentPortalUrl}}/profile' },

  { key: 'application_submitted', channel: 'WHATSAPP', body: 'Your scholarship application {{applicationNo}} has been received. We will update you as it is reviewed. Track it: {{studentPortalUrl}}/applications' },
  { key: 'application_forwarded', channel: 'WHATSAPP', body: 'Good news! Your application {{applicationNo}} has been shortlisted and forwarded to the university for final approval.' },
  { key: 'application_rejected', channel: 'WHATSAPP', body: 'Update on application {{applicationNo}}: it was not approved this time. {{note}} You can apply to other open programs: {{studentPortalUrl}}/programs' },
  { key: 'application_expired', channel: 'WHATSAPP', body: 'Your application {{applicationNo}} has expired because the agreements were not signed in time. Contact us if this is a mistake.' },

  { key: 'agreements_ready', channel: 'WHATSAPP', body: 'Congratulations {{name}}! 🎉 You have been awarded a scholarship at {{universityName}}. To accept it, sign your Scholarship Award Agreement and Agency Agreement within {{deadlineDays}} days: {{studentPortalUrl}}/agreements' },
  { key: 'agreements_ready', channel: 'EMAIL', subject: 'Action required: sign your scholarship agreements', body: 'Congratulations {{name}}!\n\nYou have been awarded a {{durationYears}}-year scholarship at {{universityName}} ({{programName}}).\n\nPlease sign both the Scholarship Award Agreement and the Agency Agreement within {{deadlineDays}} days: {{studentPortalUrl}}/agreements\n\n— {{brand}}' },
  { key: 'agreement_reminder', channel: 'WHATSAPP', body: 'Reminder: your {{agreementName}} is waiting for your signature. Sign here: {{studentPortalUrl}}/agreements' },
  { key: 'award_activated', channel: 'WHATSAPP', body: 'Your scholarship {{awardNo}} at {{universityName}} is now ACTIVE. Remember: you must renew and re-sign every year to keep receiving it.' },

  { key: 'renewal_reminder', channel: 'WHATSAPP', body: 'Hi {{name}}, your Year {{yearNumber}} scholarship renewal is due on {{dueDate}}. No signature, no scholarship that year — renew here: {{studentPortalUrl}}/renewals' },
  { key: 'renewal_reminder', channel: 'EMAIL', subject: 'Your Year {{yearNumber}} scholarship renewal is due {{dueDate}}', body: 'Hi {{name}},\n\nYour scholarship must be renewed every year. Your Year {{yearNumber}} renewal is due on {{dueDate}}.\n\nRenew and sign here: {{studentPortalUrl}}/renewals\n\n— {{brand}}' },
  { key: 'renewal_open', channel: 'WHATSAPP', body: 'Your Year {{yearNumber}} renewal forms are ready. Please register and sign by {{deadline}}: {{studentPortalUrl}}/renewals' },
  { key: 'renewal_done', channel: 'WHATSAPP', body: 'Done! Your scholarship has been renewed for Year {{yearNumber}} ({{academicYear}}).' },
  { key: 'award_suspended', channel: 'WHATSAPP', body: 'Your scholarship {{awardNo}} has been SUSPENDED: {{reason}}. Please contact us or complete your renewal: {{studentPortalUrl}}/renewals' },
  { key: 'award_suspended', channel: 'EMAIL', subject: 'Your scholarship has been suspended', body: 'Your scholarship {{awardNo}} has been suspended.\n\nReason: {{reason}}\n\nComplete your renewal or contact us: {{studentPortalUrl}}/renewals\n\n— {{brand}}' },

  { key: 'payment_receipt', channel: 'WHATSAPP', body: 'Payment received: ₹{{amount}} for {{purpose}} (receipt {{orderNo}}). Thank you!' },
  { key: 'payment_failed', channel: 'WHATSAPP', body: 'Your payment for {{purpose}} did not go through. You can retry from {{studentPortalUrl}}/applications' },

  { key: 'staff_invite', channel: 'WHATSAPP', body: 'You have been added to the {{brand}} admin portal as {{role}}. Log in with this number: {{adminPortalUrl}}' },
];

export function render(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

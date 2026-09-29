import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose';

export const metadata: Metadata = { title: 'Privacy policy' };

// Draft for legal review before launch (Digital Personal Data Protection Act, 2023).
export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy" updated="September 2026">
      <p>
        This policy explains how Alumni Connect India Private Limited (“we”), collects and uses personal data of athletes, guardians,
        references and partner-university staff, in line with the Digital Personal Data Protection Act, 2023.
      </p>
      <h2>Data we collect</h2>
      <ul>
        <li>Identity and contact details: name, date of birth, gender, nationality, mobile/WhatsApp number, email, address.</li>
        <li>Academic records, sports metrics, rankings, medals, injury and medical-clearance information you choose to provide.</li>
        <li>Documents you upload (ID, date-of-birth and address proof, marksheets, certificates, photos).</li>
        <li>Parent/guardian details for athletes under 18, and details of the references you nominate.</li>
        <li>Payment records (processed by our payment gateway; we never store card or UPI credentials).</li>
        <li>Signed agreements and the electronic-signature audit trail (time, IP address, device).</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To assess eligibility, recommend candidates and administer scholarships with partner universities.</li>
        <li>To send one-time login codes and service messages by WhatsApp, SMS and email.</li>
        <li>To meet legal, tax, audit and accounting obligations.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>
        The partner university you apply to; our service providers (cloud hosting, messaging, payment gateway, e-signature provider) under contract; and authorities
        where required by law. We do not sell personal data.
      </p>
      <h2>Your rights</h2>
      <p>
        You may access, correct or request erasure of your data, withdraw consent, and nominate another person to exercise your rights, by writing to our
        grievance officer at the email on the Contact page. Some records (signed agreements, payment records) must be retained for statutory periods.
      </p>
      <h2>Security</h2>
      <p>Data is encrypted in transit and at rest, access is role-restricted and logged, and logins use one-time codes rather than passwords.</p>
    </ProsePage>
  );
}

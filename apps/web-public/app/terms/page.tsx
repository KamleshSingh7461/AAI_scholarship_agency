import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose';

export const metadata: Metadata = { title: 'Terms and conditions' };

// Draft for legal review before launch.
export default function TermsPage() {
  return (
    <ProsePage title="Terms and conditions" updated="September 2026">
      <p>By creating an account on Alumni Connect India you agree to these terms.</p>
      <h2>Accounts</h2>
      <ul>
        <li>You log in with a one-time code sent to your mobile number. Keep your phone secure; do not share codes.</li>
        <li>Information and documents you submit must be true and complete. False information may lead to rejection or withdrawal of a scholarship.</li>
        <li>Athletes under 18 need a parent or guardian, who must co-sign agreements.</li>
      </ul>
      <h2>Applications and fees</h2>
      <ul>
        <li>Each scholarship page shows its application fee (flat or a percentage of the scholarship value) and GST before you pay.</li>
        <li>Fees are collected once, at the time of application, through our payment gateway. Refund eligibility is shown on each scholarship page.</li>
        <li>Submitting an application does not guarantee a scholarship. The partner university has the final right to accept or reject any candidate.</li>
      </ul>
      <h2>Scholarships</h2>
      <ul>
        <li>A scholarship becomes active only after you sign both the Scholarship Award Agreement and the Agency Agreement.</li>
        <li>Scholarships are renewed one academic year at a time and require your annual registration and signature on the portal.</li>
        <li>Scholarships are personal and non-transferable, and follow the partner university’s policies.</li>
      </ul>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Disputes are subject to arbitration seated in Delhi under the Arbitration and Conciliation Act, 1996.</p>
    </ProsePage>
  );
}

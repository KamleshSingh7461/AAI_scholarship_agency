import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose';

export const metadata: Metadata = { title: 'About us' };

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About us" title="About Alumni Connect India">
      <p>
        Alumni Connect India runs the Alumni Association of India programme, operated by EUSAI Team Private Limited. We partner with universities to build
        official alumni associations and to place talented student-athletes on athletic scholarships.
      </p>
      <h2>What we do</h2>
      <ul>
        <li>Partner universities transfer a set number of athletic scholarships to us each academic year.</li>
        <li>Student-athletes create one profile with us and apply to the programs they are eligible for.</li>
        <li>We verify every profile and recommend candidates; the university makes the final decision.</li>
        <li>Selected athletes sign their Scholarship Award Agreement and Agency Agreement online, and renew every year while they study.</li>
      </ul>
      <h2>Why athletes trust the process</h2>
      <ul>
        <li>Every scholarship shows exactly what it covers, per year, before you apply.</li>
        <li>Secure login with a one-time code on WhatsApp or SMS — no passwords to steal.</li>
        <li>Your documents are stored encrypted and are only visible to our review team and the university.</li>
        <li>Agreements are signed electronically with a full audit trail; you can download your signed copies any time.</li>
      </ul>
    </ProsePage>
  );
}

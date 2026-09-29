/**
 * Starting-point agreement texts, seeded as version 1 when no template exists.
 * THESE ARE DRAFTS FOR LEGAL REVIEW — admins replace them with counsel-approved text
 * in Settings → Agreement templates (each edit creates a new immutable version).
 *
 * Markup: "# " title, "## " section, "- " bullet, blank line = paragraph. {{field}} = merge field.
 * The signature block (with DocuSign anchor strings) is appended automatically.
 */
export const DEFAULT_TEMPLATES: Record<string, { title: string; body: string }> = {
  SCHOLARSHIP_AWARD: {
    title: 'Scholarship Award Agreement',
    body: `# Scholarship Award Agreement

Award No. {{awardNo}} · Date: {{date}}

This Scholarship Award Agreement ("Agreement") is entered into between {{companyName}}, operating the Alumni Association of India programme under the brand {{brandName}} ("the Association"), and {{athleteName}} (Athlete ID {{athleteCode}}) ("the Athlete").

## 1. The Award
The Association, exercising the scholarship rights transferred to it by {{universityName}} ("the University"), awards the Athlete the following scholarship under the programme "{{programName}}":
- Duration: {{durationYears}} academic years, starting academic year {{academicYear}}
- Tuition covered per year: {{tuitionPerYear}}
- Accommodation (room) per year: {{roomPerYear}}
- Food per year: {{foodPerYear}}
- Other benefits per year: {{otherPerYear}}
- Total value per year: {{annualValue}}
- Total value over the full term: {{totalValue}}

## 2. University approval and policy
The award is subject to the University's final approval and to the Athlete's continued compliance with the University's scholarship, academic, disciplinary and athletic eligibility policies. The University retains the absolute right to accept or reject a candidate.

## 3. Annual renewal — no signature, no scholarship
The scholarship is granted one academic year at a time. Before each anniversary the Athlete must (a) register on the Alumni Connect India portal, confirming enrolment and acceptance of the University's policy, and (b) electronically sign the renewal of this Agreement and of the Agency Agreement. If the renewal is not completed within the grace period notified on the portal, the scholarship is suspended for that year and may be withdrawn.

## 4. Athlete obligations
- Maintain enrolment and the academic standing required by the University.
- Participate in the University's athletic programme in {{sport}} as reasonably required.
- Keep contact details (including WhatsApp number) current on the portal.
- Provide true and complete information and documents. False information entitles the Association to withdraw the award.

## 5. Suspension and withdrawal
The Association may suspend or withdraw the award if the Athlete fails to renew, ceases to be enrolled, breaches University policy or this Agreement, or if the University withdraws its approval. Benefits already delivered for completed years are not recoverable except in the case of fraud.

## 6. Non-transferable
The award is personal to the Athlete and cannot be transferred, sold or exchanged for cash.

## 7. Data protection
The Athlete consents to the Association and the University processing the Athlete's personal data for administering the scholarship, in accordance with applicable Indian data protection law.

## 8. Governing law and disputes
This Agreement is governed by the laws of India. Disputes shall first be resolved by mutual discussion, failing which by arbitration seated in Delhi under the Arbitration and Conciliation Act, 1996.`,
  },

  AGENCY: {
    title: 'Athlete Agency Agreement',
    body: `# Athlete Agency Agreement

Reference: {{awardNo}} · Date: {{date}}

This Agency Agreement is entered into between {{companyName}} ("the Agency") and {{athleteName}} (Athlete ID {{athleteCode}}) ("the Athlete").

## 1. Appointment
The Athlete appoints the Agency as the Athlete's representative for the scholarship awarded at {{universityName}} under the programme "{{programName}}" (Award No. {{awardNo}}) and for matters directly related to that scholarship for its full term of {{durationYears}} years.

## 2. Services
- Representing the Athlete in scholarship matters with the University.
- Administering the scholarship, annual renewals and related paperwork.
- Guidance on eligibility, documentation and compliance with University policy.

## 3. Agency fee
The Agency is entitled to an agency fee of {{commissionPct}}% of the scholarship value ({{totalValue}} over the full term), settled as agreed between the Agency and the University. [MANAGEMENT TO CONFIRM: who bears this fee and how it is paid. The Athlete is not charged anything under this clause beyond the application fee already paid unless stated here.]

## 4. Term and annual renewal
This Agreement runs for the term of the scholarship and must be re-signed each year together with the scholarship renewal. If the scholarship is suspended or withdrawn, this Agreement ends for the affected period.

## 5. Athlete undertakings
The Athlete will provide accurate information, keep the Agency informed of any change in enrolment, eligibility, injury or contact details, and will not appoint another agent for the same scholarship during the term.

## 6. Confidentiality and data
Each party keeps the other's confidential information private. The Athlete consents to processing of personal data for the purposes of this Agreement.

## 7. Governing law
Governed by the laws of India; disputes by arbitration seated in Delhi under the Arbitration and Conciliation Act, 1996.`,
  },

  SCHOLARSHIP_RENEWAL: {
    title: 'Scholarship Renewal — Year {{yearNumber}}',
    body: `# Scholarship Renewal — Year {{yearNumber}}

Award No. {{awardNo}} · Academic year {{academicYear}} · Date: {{date}}

I, {{athleteName}} (Athlete ID {{athleteCode}}), confirm that:
- I am enrolled at {{universityName}} for academic year {{academicYear}} ({{periodStart}} to {{periodEnd}}).
- I continue to comply with the University's scholarship, academic and athletic policies.
- The information I provided in my annual registration is true and complete.

I request renewal of my scholarship for Year {{yearNumber}} of {{durationYears}} on the terms of my Scholarship Award Agreement, with benefits for this year of {{annualValue}}. I understand that the scholarship continues only while I renew every year.`,
  },

  AGENCY_RENEWAL: {
    title: 'Agency Agreement Renewal — Year {{yearNumber}}',
    body: `# Agency Agreement Renewal — Year {{yearNumber}}

Reference: {{awardNo}} · Academic year {{academicYear}} · Date: {{date}}

I, {{athleteName}} (Athlete ID {{athleteCode}}), confirm the continuation of my Athlete Agency Agreement with {{companyName}} for Year {{yearNumber}} of my scholarship at {{universityName}}, on the same terms, including the agency fee of {{commissionPct}}% of the scholarship value.`,
  },
};

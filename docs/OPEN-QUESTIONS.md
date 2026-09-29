# Decisions needed from management

The platform is built so each of these is a **setting, not a code change**. Current defaults are shown.

| # | Question | Where it is configured | Current default |
| --- | --- | --- | --- |
| 1 | **Application fee: flat or % of the scholarship?** Charged once, at application. | Per program (Programs → Application fee) | Flat ₹999 + 18% GST (demo); % supported with min/max caps |
| 2 | Is the fee **refunded** if the university rejects the athlete? | Per program | Not refundable |
| 3 | **Unused seats at year end**: the IES *Scholarship Transfer Letter* says they are **forfeited**; the *Valuation Letter* says they **roll over**. Which applies? | Per annual allocation | Forfeit |
| 4 | **Revenue recognition**: booking the full multi-year value on the signing date (management's instruction) is aggressive under Ind AS 115 / ASC 606. Please confirm with the statutory auditor. | `REVENUE_RECOGNITION_POLICY` | `FULL_AT_GRANT` (alt: `RATABLE`) |
| 5 | **Agency commission (8%)**: who pays it — the university, deducted from the scholarship, or the athlete? The Agency Agreement text has a placeholder. | Per program + agreement template | 8%, university share 0% |
| 6 | **Agreement texts**: seeded Scholarship Award / Agency / renewal texts are drafts. Counsel must approve the final text. | Settings → Agreement templates (versioned) | Draft v1 |
| 7 | **Minors (U14/U17)**: guardians co-sign in person on the athlete's device. Acceptable, or must guardians sign remotely? | esign-service | In-person co-sign |
| 8 | **Renewal timing**: reminder 30 days before, renewal forms on the anniversary, 14-day grace, then suspension. | env `RENEWAL_*` | As listed |
| 9 | **Agreement signing deadline** after university approval before the seat is released. | `AGREEMENT_SIGNING_DEADLINE_DAYS` | 14 days |
| 10 | **Which university-funded vs company-funded components** apply at IES? The MoU says only 50% tuition is covered; hostel, books, uniform, exam fees are paid by "AAI/student". | Per program (who funds each component) | Tuition = university; other = student |
| 11 | **USD/INR rate source**: manual entry by finance, or an automatic daily feed? | Settings → FX rate | Manual (default 83.00) |
| 12 | **One scholarship at a time** per athlete? | application-service + DB index | Yes |
| 13 | Company details for receipts: legal name, **GSTIN**, address. | `COMPANY_*` env | Legal name only |
| 14 | **University staff access**: should universities log in (University rep role) to approve candidates themselves, or does our team record decisions? | Settings → Staff | Both supported |
| 15 | **DPDP Act 2023**: appoint a grievance officer and confirm data-retention periods for rejected applicants' documents. | Privacy policy + ops | Not set |

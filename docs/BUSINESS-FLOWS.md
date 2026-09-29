# Business flows

## 1. Setting up a university (admin)

1. **Universities → Add university** (e.g. IES University, Bhopal).
2. **MoUs & letters**: record the *Agreement for the Establishment of Alumni Association* (5-year term, auto-renew,
   80/20 donation split, 8% agency commission), the *Scholarship Transfer Letter* and the *Valuation Letter*, and upload
   the signed PDFs.
3. **Annual allocations**: one row per academic year with the seats transferred (IES: 50), the fair value per seat
   (₹37,500/yr), and the unused-seat policy (forfeit or roll over). *Close year* applies the policy.
4. **Programs**: carve the allocation into programs (e.g. 30 × 4-year, 20 × 3-year). For each: tuition and the share
   covered, room/food/other and **who funds each** (university in kind, company cash, or student), seats, eligibility,
   dates and the **application fee** (none / flat / % of annual or total value, min/max, GST, refundable?). Publish.

## 2. Athlete journey

```
Sign up (OTP) → 4-step profile → Submit ─▶ staff verify documents ─▶ VERIFIED
                                   │
Browse → Apply ─▶ PAYMENT_PENDING ─(gateway)─▶ SUBMITTED ─▶ UNDER_REVIEW ─▶ FORWARDED_TO_UNIVERSITY
                                                   │             │                  │
                                                REJECTED      REJECTED     UNIVERSITY_APPROVED / _REJECTED
                                                                                     │ (seat reserved, award offered)
                                                                             AGREEMENTS_PENDING ─(both signed)─▶ AWARDED
                                                                                     └─(deadline passed)─▶ EXPIRED (seat released)
```

- Applying checks eligibility (profile submitted, age, gender, sport), blocks duplicates, and snapshots the program terms.
- The fee is computed on the server from the program (never from the browser) and charged once, in INR.
- Forwarding requires a **verified** athlete; the **university records the final decision** (MoU: absolute right).
- Approval reserves a seat atomically and creates the **award** in `PENDING_SIGNATURE`, then sends the **Scholarship
  Award Agreement** and the **Agency Agreement**. Minors' guardians co-sign.
- When both are signed the award is **ACTIVE**: grant date = "date passed out", yearly periods are created, the seat is
  confirmed, finance books the revenue.

## 3. Yearly renewal ("no signature, no scholarship")

| When | What happens |
| --- | --- |
| 30 days before the anniversary | Year → `DUE`, award → `RENEWAL_DUE`, WhatsApp + email reminder |
| Athlete registers (any time once due) | Confirms enrolment + university policy, uploads bonafide/marksheet; renewal agreements are created |
| On the anniversary | Renewal agreements are sent if not already |
| Both renewal agreements signed + registration | Year → `RENEWED`, finance recognises that year |
| Anniversary passed | Year → `OVERDUE` |
| Grace period (14 days) passed | Year and award → `SUSPENDED`, athlete notified; completing the renewal reinstates automatically |

Staff can also suspend, reinstate or revoke (with reason, audit-logged). Revoking cancels future years and reverses
undelivered revenue.

## 4. Accounting (finance-service)

Management's policy (email of 7 Sep 2026): recognise the full value when the athlete signs; expense it over the years.
Worked example: $2,000 tuition + $250 food + $200 room = $2,450/yr × 4 = **$9,800 booked on the grant date**.

| Event | Journal |
| --- | --- |
| Award activated | Dr Scholarship rights / Cr Scholarship revenue — full value |
| | Dr Commission receivable / Cr Commission income (our share) / Cr Commission payable to university |
| Each year renewed (year 1 at grant) | Dr Scholarship expense / Cr Scholarship obligation — that year's value |
| | Dr Scholarship obligation / Cr Scholarship rights — the university-funded part, delivered in kind |
| Cash disbursement (e.g. hostel paid) | Dr Scholarship obligation / Cr Bank |
| Award revoked | Dr Scholarship revenue / Cr Scholarship rights — undelivered years |
| Application fee paid | Dr Bank / Cr Fee income / Cr GST payable |
| Fee refunded | reverse, with proportional GST |

`REVENUE_RECOGNITION_POLICY=RATABLE` switches to recognising revenue year by year instead (for auditor review).
University confirmation of each award's value is recorded on the award (with the letter) and drives the audit views.
Reports: Scholarship List, Annual Renewal, Revenue, Expense Schedule, University-wise (XLSX/CSV/PDF).

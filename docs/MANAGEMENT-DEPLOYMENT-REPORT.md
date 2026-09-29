# Alumni Connect India (AAI) — Platform Staging Report & Testing Guide

**Date:** September 29, 2026  
**Subject:** AWS EC2 Staging Deployment & Executive Testing Walkthrough  
**Company:** Alumni Connect India Private Limited  
**Environment:** AWS Asia Pacific (Mumbai) `ap-south-1`  
**Host IP:** `15.206.179.72` (Instance ID: `i-07af14310b0abb357`)  

---

## 1. Executive Summary

The **Alumni Connect India (AAI) Scholarship Platform** has been successfully built and deployed to a dedicated staging environment on AWS EC2. 

The platform is designed to automate the full lifecycle of sports scholarships in India—from athletic merit assessment and university admissions to digital agreement signing, fee discounts, and commission recognition.

### Key Milestones Completed:
1. **Core Microservices Architecture (9 Services):** Fully decoupled services for Auth, Athlete Profiles, University Programs, Applications, Payments, Digital E-signing, Document Vault (S3), Notifications, and Financial Ledgers.
2. **Unified Portals:** 
   - Public Website & Scholarship Discovery
   - Student / Athlete Portal
   - Administrative Operations Dashboard
3. **Official Company Branding:** Real company logos, high-resolution favicons, metadata, and medals/achievements tracking (Gold, Silver, Bronze at National/State/District levels).
4. **Security & Authentication:** Passwordless Mobile OTP authentication, RSA-2048 JWT tokens, role-based access control (RBAC), and least-privilege service-level databases.

---

## 2. Live Portals Directory

| Portal | URL | Intended Audience | Core Capabilities |
|---|---|---|---|
| **Public Website & Discovery** | [http://15.206.179.72:3000](http://15.206.179.72:3000) | Prospective Athletes, Parents, Public | University catalog, scholarship scheme explorer, eligibility calculator, corporate branding |
| **Athlete / Student Portal** | [http://15.206.179.72:3001](http://15.206.179.72:3001) | Student Athletes | Profile creation, athletic achievements recording, application tracking, document vault, contract e-signing |
| **Admin Operations Dashboard** | [http://15.206.179.72:3002](http://15.206.179.72:3002) | Management, Admissions Team, Staff | Application evaluation, quota management, university MoU tracking, award issuance, financial ledger |
| **Live Notifications & OTPs (Mailpit)** | [http://15.206.179.72:8025](http://15.206.179.72:8025) | Management, QA & Testers | Real-time inbox capturing all outgoing system OTPs, alerts, and notifications without requiring live SMS |
| **API Gateway Status** | [http://15.206.179.72:8080/health](http://15.206.179.72:8080/health) | Tech / Operations | System health check monitoring all 9 backend microservices |

---

## 3. Login Credentials for Testing

### A. Staff / Management Login
* **Portal:** [http://15.206.179.72:3002](http://15.206.179.72:3002)
* **Registered Number:** `+919999900001`
* **Role:** `SUPER_ADMIN`
* **OTP:** Displayed directly in the helper banner on the login screen, or viewable at [Mailpit (Port 8025)](http://15.206.179.72:8025).

### B. Athlete / Candidate Login
* **Portal:** [http://15.206.179.72:3001](http://15.206.179.72:3001)
* **Registered Number:** Any personal or test 10-digit mobile number (e.g. `+919876543210`).
* **Role:** `STUDENT` / `ATHLETE`
* **OTP:** Displayed on screen / Mailpit inbox.

---

## 4. Key Review Scenarios for Management

1. **Brand Identity & Experience (Port 3000):**
   - Review home page, mission statement, partner university showcases, and mobile responsiveness.
2. **End-to-End Athlete Application (Port 3001):**
   - Test candidate registration, entering sport achievements (e.g. National Level Gold Medal), and program selection.
3. **Scholarship Grant & Approval Workflow (Port 3002):**
   - Review incoming applications, verify athletic credentials, and issue scholarship grant letters.
4. **Digital Contract Execution (Port 3001 & 3002):**
   - Verify digital signature workflows for scholarship agreements and compliance recording.
5. **Financial Records & Commission Tracking (Port 3002):**
   - Inspect financial ledger entries for university seat bookings, commission allocations, and fee schedules.

---

## 5. Next Steps towards Production Rollout

1. **Internal Feedback Collection (UAT):** Gather feedback from management and admissions team on usability and workflows.
2. **Domain & SSL Binding:** Map `alumniindia.com`, `admin.alumniindia.com`, and `portal.alumniindia.com` via AWS Route 53 and configure Cloudflare / AWS Certificate Manager SSL.
3. **Production AWS Services Migration:** Migrate containerized PostgreSQL and Redis to AWS RDS Multi-AZ and ElastiCache.
4. **Live SMS / WhatsApp Integration:** Connect production MSG91 or Twilio credentials for live candidate SMS notifications.

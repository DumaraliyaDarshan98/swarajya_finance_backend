# Swarajya Finance — Client Demo Plan (3 Meetings)  
### Detailed step-by-step presentation guide

**Product:** Swarajya Finance — Risk Assessment / Verification Platform  
**Format:** Live product walkthrough (screen share) + Q&A  
**Note:** **Dashboards & analytics graphs are presented only in Meeting 3** (after the client has seen all operational flows).

| Meeting | Focus | Suggested duration |
|--------|--------|-------------------|
| **Meeting 1** | Platform setup, access, subscription & master configuration | 60–75 min |
| **Meeting 2** | Digital verification + OCR verification (core product) | 75–90 min |
| **Meeting 3** | Physical verification, audit, **dashboards**, wrap-up | 90–105 min |

---

# MEETING 1  
## Platform foundation — setup, access & configuration

**Goal:** Client understands how the organization is onboarded, who can access what, and how subscription features are controlled — *before* running verifications or dashboards.

---

### Step 1 — Welcome & product map (5 min)

**Present:**  
Short introduction of Swarajya Finance as one platform with three verification products:

1. **Digital** — form-based verification with public data scrapes  
2. **OCR** — document upload, AI extraction, then scrapes from extracted data  
3. **Physical** — field visit with agent, GPS, approval & report  

**Say to client:**  
Today we only cover **setup and control**. Verification demos are Meeting 2 & 3. Dashboards come at the end in Meeting 3, after you have seen how cases are created.

---

### Step 2 — Login & role-based access (10 min)

**Open:** Login screen → Super Admin → then Client Admin (or switch accounts).

**Present in order:**

1. **Login** — secure sign-in  
2. **Super Admin** — platform owner: all clients, plans, agents, global settings  
3. **Client Admin** — organization admin for one client  
4. **Client User** — limited user inside the same organization (permissions-based)  
5. **Field Agent** — mention only (full demo in Meeting 3)

**Description:**  
Every screen and menu is driven by **role + permissions**. Super Admin sees the full platform; Client users only see their organization and modules enabled on their subscription.

---

### Step 3 — Client organization listing & profile (10–12 min)

**Open (Super Admin):** Client listing → open one demo client → client detail / edit.

**Present in order:**

1. **Client list** — search, pagination, status  
2. **Client profile** — company name, contact, bank/vendor details  
3. **Organization settings** — feature toggles preview (Digital / OCR / Physical / Triangulation)  
4. **Limits** — max users, max roles (subscription-linked)

**Description:**  
Each client is a separate tenant. Data, users, and cases stay scoped to that client. Feature flags decide which verification menus appear for that client.

---

### Step 4 — Subscription plans & feature packaging (12–15 min)

**Open (Super Admin):** Subscription plans (or Plans module) → show one plan → link plan to client.

**Present in order:**

1. **Plan list** — plan title, amount (MRR-style pricing)  
2. **Plan features** — which products are included (Digital / OCR / Physical, etc.)  
3. **Assign plan to client** — how purchase maps to access  
4. **Client view of plan** (Client Admin → Plans / Settings) — what the client sees after purchase

**Description:**  
This is how commercial packaging works: client purchases a plan → platform enables the matching modules → menus and APIs respect those flags. (Revenue graphs are shown later in Meeting 3.)

---

### Step 5 — Users & custom roles (12–15 min)

**Open (Client Admin):** User list → Role list → create/edit example.

**Present in order:**

1. **User list** — invite/create client users, status  
2. **Role list** — custom roles for the organization  
3. **Permissions matrix** — module-wise VIEW / ADD / EDIT / DELETE (e.g. Verification, Users, Audit, Settings)  
4. **Assign role to user** — demonstrate restricted menu after login as that user (optional quick switch)

**Description:**  
Client Admin controls internal team access. Example: one user can only view Digital cases; another can create OCR cases. Super Admin / Internal users are managed separately on the platform side.

---

### Step 6 — Supporting masters (brief) (8–10 min)

**Open (Super Admin) as a quick tour (no deep case run):**

1. **Portal list** — government / public portals used in Digital reports  
2. **RCU triggers** — rules used in OCR checks  
3. **Forensic checks** — document authenticity signals for OCR  
4. **Report customization** — Digital / OCR report section visibility & labels (high-level)  
5. **Notifications** — in-app notification center (open bell / list once)

**Description:**  
These masters power report quality and OCR intelligence. We will see them *in action* when we generate reports in Meeting 2.

---

### Step 7 — Meeting 1 wrap-up & Q&A (10 min)

**Recap for client:**

- Platform vs Client access  
- Subscription → feature enablement  
- Users & roles  
- Masters that support verification  

**Do not open dashboards yet** — confirm: *“Graphs and performance monitoring are reserved for Meeting 3.”*

**Ask:** Questions on setup, packaging, or access control.

---

# MEETING 2  
## Digital verification + OCR verification (core product)

**Goal:** Full live run of both desktop verification products, including how data is scraped and printed on reports.

---

### Step 1 — Recap of Meeting 1 (5 min)

**Present:**  
Access + subscription remind: today we use a client that has **Digital** and **OCR** enabled.

---

### Step 2 — Digital verification — list & navigation (5 min)

**Open (Client Admin):** Menu → Digital Verification → List.

**Present in order:**

1. **Digital list** — cases, status badges (Draft / In progress / Report generated / Failed)  
2. **Filters / search** (if available)  
3. **Add new** button → form

**Description:**  
Digital is form-driven: user enters applicant and business details; system enriches via public scrapes and produces a Digital report.

---

### Step 3 — Digital verification — enter details (10–12 min)

**Open:** Digital form (create).

**Present fields in order:**

1. Loan / application reference (if used)  
2. Applicant identity — name, mobile, email, PAN, Aadhaar  
3. Residential address — address, landmark, city, state, pincode  
4. Optional office address block  
5. Optional business block — company name, domain, GSTIN, business PAN, CIN, type  

**Description:**  
This is the **source data**. Everything scraped in the next step is driven from these values.

---

### Step 4 — Digital verification — generate & scrape pipeline (12–15 min)

**Action:** Submit / Generate report (show status moving to In progress).

**Explain pipeline verbally while it runs:**

1. **Primary scrapes from entered details**  
   - Pincode / postal + maps / geocode for addresses  
   - GST public search (if GSTIN entered)  
   - WHOIS / domain (if company domain entered)  
2. **Cascade from scrape results**  
   - If GST returns business address / website → enrich those further  
   - Business name match vs GST legal/trade name  
3. **Related portals**  
   - Portal catalog of other government / public sites for the report  
4. **Status outcome**  
   - Report Generated or Failed (e.g. GST/WHOIS/name mismatch)

**Description:**  
*Enter details → scrape → if other sites/data available from scrape, fetch those too → print on report.*

---

### Step 5 — Digital verification — report walkthrough (12–15 min)

**Open:** Digital report for the case just generated.

**Present sections in order (tab / scroll order):**

1. Header — request ID, status, report date, applicant summary  
2. Input / KYC details submitted  
3. Address enrichment — pincode fields, map / street view  
4. GST scrape fields (if business)  
5. Domain / WHOIS fields  
6. Business name match result  
7. **Related public / government portals** list  
8. Back to list / regenerate path if Failed

**Description:**  
Client sees how typed input becomes an auditable printed report with external data.

---

### Step 6 — OCR verification — list & upload (8–10 min)

**Open (Client Admin):** Menu → OCR Verification → List → Add / Form.

**Present in order:**

1. OCR case list & statuses (Draft → Uploading → OCR Processing → Report Generated / Failed)  
2. Create case  
3. Upload documents (PAN, Aadhaar, bank statement, etc.)  
4. Optional remove / re-upload  

**Description:**  
OCR is document-driven. User does not type full KYC; the system reads documents.

---

### Step 7 — OCR verification — processing pipeline (15–18 min)

**Action:** Generate report; keep list open to show live progress messages (socket progress).

**Explain phases in order:**

1. **Identify** each document type  
2. **Match RCU triggers** for that document type  
3. **OCR extract** fields + forensic / authenticity checks  
4. **Fuse** case-level forensic verdict / risk score  
5. **Derive scrape inputs** from extracted fields (PAN, GSTIN, address, name, domain, etc.)  
6. **Scrape public sites** using those extracted values (same enrichment engine as Digital)  
7. Final status — Report Generated or Failed

**Description:**  
*Upload document → extract → based on extracted data, scrape sites → print OCR + scrape results on report.*

---

### Step 8 — OCR verification — report walkthrough (12–15 min)

**Open:** OCR report.

**Present sections in order:**

1. Header — status, date, case forensic verdict / risk score  
2. Per-document cards  
   - File name, OCR success/fail  
   - Extracted key–value fields  
   - Forensic signals  
   - RCU trigger results  
3. **Public site scrapes (from OCR data)**  
   - Fields used for scraping  
   - GST / WHOIS / address enrichment  
   - Related portals  
4. Compare briefly with Digital: same scrape idea, different input source

**Description:**  
Client sees document intelligence plus enrichment from public sites in one report.

---

### Step 9 — Digital vs OCR comparison (5 min)

| | Digital | OCR |
|--|---------|-----|
| Input | Typed form | Uploaded files |
| First processing | Scrapes from form | AI extract from docs |
| Then | Cascade scrapes + portals | Scrapes from extracted fields + portals |
| Best for | Structured applications | Document packs / KYC files |

---

### Step 10 — Meeting 2 wrap-up & Q&A (10 min)

**Recap:** Both core products run end-to-end.  
**Next meeting:** Physical field flow + audit + **dashboards & graphs**.

---

# MEETING 3  
## Physical verification, audit, dashboards & closing

**Goal:** Complete field operations story, show compliance monitoring, then present **all dashboards/graphs**, then close with next steps.

---

### Step 1 — Recap of Meetings 1–2 (5 min)

**Present:** Setup done; Digital & OCR seen. Today: Physical → Audit → **Dashboards** → decisions.

---

### Step 2 — Physical verification — client intake (10–12 min)

**Open (Client Admin):** Physical Verification → List → Form.

**Present in order:**

1. Physical list & statuses overview  
2. Create case — applicant, verification type (PD / FI / RCU, etc.), priority  
3. Residential and/or office address flags  
4. Supporting documents upload (if used)  
5. **Submit** case (Draft → In progress; visits created per address)

**Description:**  
Client starts the case; field work happens after Super Admin assignment.

---

### Step 3 — Physical verification — Super Admin assign & monitor (10–12 min)

**Open (Super Admin):** Physical list → open case / view.

**Present in order:**

1. Parent case + visit cards (one visit per address)  
2. **Assign field agent** per visit  
3. Status becomes Agent Assigned  
4. Live / tracking view concept (GPS history when agent is on trip)

**Description:**  
Super Admin controls workforce assignment and oversight.

---

### Step 4 — Physical verification — field agent app flow (12–15 min)

**Open (Field Agent login):** Assigned visits / loan case list → open visit.

**Present in order:**

1. Assigned visit queue  
2. **Start trip**  
3. GPS tracking pings while travelling  
4. **End trip**  
5. Fill visit form / photos  
6. Save draft → **Submit visit**  
7. Optional: decline assignment (explain briefly)

**Description:**  
Field agent executes the on-site check with geo evidence.

---

### Step 5 — Physical verification — approve, complete & report (10–12 min)

**Open (Super Admin):** Visit review.

**Present in order:**

1. Review submitted visit data & photos  
2. **Approve** or **Reject** each visit  
3. When all visits approved → **Complete** case  
4. Report generated; wallet credit to agent (mention ₹ reward per visit at high level)  
5. Open **Physical report** (Client / SA)

**Description:**  
Closed-loop: intake → assign → visit → approve → report + payout signal.

---

### Step 6 — Audit logs & security monitoring (10–12 min)

**Open:** Super Admin Audit Logs → then Client Audit Logs.

**Present in order:**

1. **Super Admin audit** — platform-wide events, filters (module, action, user, date), pagination, card layout  
2. Module badges / action highlights  
3. IP / time / user context  
4. **Client audit** — same UI scoped only to that organization  
5. Tie-in: “These events also feed activity charts on the dashboard (next step).”

**Description:**  
Compliance view of *who did what, when, from where* — required for enterprise demos.

---

### Step 7 — Dashboards & graph analytics (20–25 min)  ★ LAST MAJOR PRODUCT BLOCK

**Goal of this step:** After the client has seen how cases and audits work, show how everything is **monitored and tracked** in graphs.

#### 7A — Super Admin dashboard (10–12 min)

**Open (Super Admin):** Dashboard / Control Center.

**Present in this exact order:**

1. **Greeting / filters** — client filter, pipeline filter (optional)  
2. **KPI cards (counts)**  
   - Clients, internal users, field agents  
   - Completed cases, all verifications, needs attention  
   - Wallet balance / this-month earning  
3. **Subscription revenue KPIs**  
   - Subscription MRR  
   - Subscribed client count  
   - Report success rate  
4. **Graph 1 — Revenue by plan** (bar)  
   - Monthly recurring amount by subscription plan  
5. **Graph 2 — Verification mix** (donut)  
   - Digital vs OCR vs Physical case counts  
6. **Graph 3 — Performance** (bar)  
   - Reports / In progress / Failed / Draft  
7. **Graph 4 — Client growth** (line)  
   - New clients over last 6 months  
8. **Graph 5 — Audit activity** (line)  
   - Security / action volume last 14 days  
9. **Plan subscribers list**  
   - Clients per plan + revenue contribution  
10. Quick actions & top field agents table (brief)

**Description:**  
Platform-wide monitoring: **money (subscription), volume (cases), quality (success/fail), growth, and audit activity**.

#### 7B — Client dashboard (8–10 min)

**Open (Client Admin):** Client dashboard.

**Present in this exact order:**

1. Greeting / org context  
2. **KPI cards** — total cases, reports, in progress, failed, success rate, users, roles, audit events  
3. **Subscription card**  
   - Plan name, monthly amount  
   - Feature chips (Digital / OCR / Physical / Triangulation on-off)  
4. **Usage bars**  
   - Users used vs max  
   - Roles used vs max  
5. **Graph 1 — Verification mix** (donut) — org-scoped  
6. **Graph 2 — Performance** (bar) — org-scoped  
7. **Graph 3 — Activity monitoring** (line) — org audit trend 14 days  
8. Pipeline status panels + quick actions + recent activity (brief)

**Description:**  
Client sees **only their organization**: plan value, utilization, case performance, and activity — matching what they purchased.

#### 7C — Dashboard takeaway (2–3 min)

**Say to client:**  
- Super Admin = full platform health + subscription revenue  
- Client = your purchased plan + your team’s performance  
- Graphs update from live case and audit data you saw in Meetings 2–3  

---

### Step 8 — Full product map & commercial alignment (8–10 min)

**Present on one summary slide / screen:**

1. Meeting 1 → Setup & subscription packaging  
2. Meeting 2 → Digital + OCR  
3. Meeting 3 → Physical + Audit + Dashboards  
4. How plan features map to each module  
5. Optional: Training module mention (if in scope)

---

### Step 9 — Feedback, pilot & next steps (15–20 min)

**Discuss in order:**

1. What worked well / gaps  
2. Which modules for pilot (Digital / OCR / Physical)  
3. Users & roles for pilot  
4. Success criteria (turnaround time, report quality, adoption)  
5. Tentative timeline & owners  
6. Commercial / subscription confirmation  

---

## Quick “first → second → third” cheat sheet (for presenter)

### Meeting 1
1. Welcome & product map  
2. Login & roles  
3. Client profile  
4. Subscription plans  
5. Users & roles/permissions  
6. Masters (portals, RCU, forensics, report layout, notifications)  
7. Q&A *(no dashboards)*

### Meeting 2
1. Recap  
2. Digital list  
3. Digital form (enter details)  
4. Digital generate (scrape + cascade)  
5. Digital report  
6. OCR list & upload  
7. OCR generate (extract → scrape)  
8. OCR report  
9. Digital vs OCR  
10. Q&A

### Meeting 3
1. Recap  
2. Physical create/submit (client)  
3. Assign agent (SA)  
4. Field agent visit  
5. Approve / complete / report  
6. Audit logs (SA + Client)  
7. **Dashboards (SA then Client) — graphs last**  
8. Product map & packaging  
9. Pilot & next steps  

---

## Suggested attendees

| Role | M1 | M2 | M3 |
|------|:--:|:--:|:--:|
| Business / sponsor | ✓ | ✓ | ✓ |
| Operations / verification | Optional | ✓ | ✓ |
| IT / security / compliance | Optional | Optional | ✓ |
| Field / vendor ops | — | — | ✓ |

---

## Prerequisites

- Demo URLs + Super Admin, Client Admin, Field Agent logins  
- Sample Digital form data  
- Sample OCR documents  
- Sample Physical case ready for assignment  
- Dashboard should have some live demo data (clients on plans, cases, audit events)

---

*Client-shareable detailed agenda — Swarajya Finance*  
*Dashboards intentionally scheduled in Meeting 3 only.*

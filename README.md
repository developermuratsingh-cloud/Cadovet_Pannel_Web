# Cadovet Veterinary Hospital Management System

A comprehensive, enterprise-grade Veterinary Hospital Management Platform and full website replica built for **Cadovet**.

- 🌐 **Reference / Previous Live Website:** [https://cadovet.com/](https://cadovet.com/)
- 💻 **Local Replica Website:** [http://localhost:5173/](http://localhost:5173/)
- 🔐 **Hospital Portal Login:** [http://localhost:5173/login](http://localhost:5173/login)

---

## ⚡ How to Run the Project

### Option A: Run Everything with a Single Command (Recommended)

From the project root (`cado_vet`):

```bash
# Using npm
npm start
# or
npm run dev

# Or directly using the start script
./start.sh
```

> **Note:** This starts both the **Backend Server** (on port `5001`) and the **Frontend Client** (on port `5173`) concurrently.

### Option B: Run in Separate Terminals

#### 1. Start Backend Server:
```bash
cd cadovet-server
npm start
# Server runs on http://localhost:5001
```

#### 2. Start Frontend Client:
```bash
cd cadovet-client
npm run dev
# Frontend runs on http://localhost:5173
```

---

### 🐾 All Public Website Replica Pages & Navigation
Every single page and navigation link from the original [https://cadovet.com/](https://cadovet.com/) website has been faithfully replicated with live backend linking:

| Page / Navigation Route | Local URL | Live Source Reference | Features & Integrations |
| :--- | :--- | :--- | :--- |
| **Home Page** | [`/`](http://localhost:5173/) | `https://cadovet.com/` | Hero banner, Doorstep Consultation Form (₹599), Best Sellers, Expert Doctors, FAQs, Places We Serve |
| **About Us** | [`/about-us`](http://localhost:5173/about-us) | `https://cadovet.com/about-us/` | Story, Vision, Mission, Goal, and Founders/Leadership Team Cards (Virendra Rajpoot, Deepak Vishwakarma, Vivek Singhal, Sandeep Singh) |
| **Blog & Journal** | [`/blog`](http://localhost:5173/blog) | `https://cadovet.com/blog/` | 7 complete medical articles with category filters, vet credentials, and interactive full-text article reader modal |
| **Dogs Packages** | [`/dogs-packages`](http://localhost:5173/dogs-packages) | `https://cadovet.com/dogs-packages/` | 8 Dog Immunization products: Puppy 3-Shot (₹5,999), Adult Booster (₹3,399), Anti-Rabies (₹899), DHPPi (₹1,399), Kennel Cough (₹1,499), Corona (₹1,299), Parvo+CD (₹1,499), Tick Treatment (₹2,499) with "Add to Cart" and "Book Visit" |
| **Cat Packages** | [`/cat-packages`](http://localhost:5173/cat-packages) | `https://cadovet.com/cat-packages/` | 5 Feline packages: Kitten Pack (₹3,599), Adult Cat Pack (₹1,999), Anti-Rabies (₹899), Tick Treatment (₹1,599), Feline CRP Tri-Cat (₹1,499) with "Add to Cart" and "Book Visit" |
| **Vaccination Guide** | [`/vaccination`](http://localhost:5173/vaccination) | `https://cadovet.com/vaccination/` | Complete Canine & Feline vaccination protocols, shot-by-shot breakdown, FAQs, and instant booking modal |
| **All Services Catalog** | [`/services`](http://localhost:5173/services) | `https://cadovet.com/` (Services) | Master catalog of all doorstep and clinical services |
| **Major & Minor Surgery** | [`/major-minor-surgery`](http://localhost:5173/major-minor-surgery) | `https://cadovet.com/major-minor-surgery/` | Spay/Neuter, Orthopedic Surgery, Tumor Removal, C-Sections, Biopsies, Dental, multiparameter monitoring, and pre-op consultation scheduling |
| **Dog Grooming & Spa** | [`/dog-grooming`](http://localhost:5173/dog-grooming) | `https://cadovet.com/dog-grooming/` | Full Grooming (₹1,599), Mini Pet Grooming (₹999), medicated baths, nail trimming, breed cuts, and home booking |
| **Diagnostic Lab Tests** | [`/lab-tests`](http://localhost:5173/lab-tests) | `https://cadovet.com/lab-tests/` | 7 Lab Panels: CBC+LFT+KFT (₹2,599), Viral Parvo+Distemper (₹2,500), TVT (₹999), Tick Fever 4DX (₹1,299), Biopsy (₹1,599), FNAC (₹1,599), Glucose (₹849) with home sample collection booking |
| **Product Detail View** | [`/product/:slug`](http://localhost:5173/product/puppy-vaccination-package) | `https://cadovet.com/product/...` | Dynamic product pages with quantity counters, inclusions checklists, reviews, related products, and booking |
| **Cart & Doorstep Checkout** | [`/cart`](http://localhost:5173/cart) | `https://cadovet.com/` (Cart) | Global cart, coupon support (`WELCOME10`), address picker, time slot, and direct submission to backend `POST /api/appointments/public` |
| **Contact Us** | [`/contact-us`](http://localhost:5173/contact-us) | `https://cadovet.com/contact-us/` | 24x7 Helplines (+91 922 041 0777), Delhi NCR service hubs, and interactive veterinary inquiry form |
| **Hospital Portal Link** | [`/login`](http://localhost:5173/login) | Portal Entry | Seamlessly linked in the header ("Portal Login" / "Hospital Portal") with test credentials for Admin, Doctors, and Staff |

---

## 🔑 Test Credentials

There are **two sign-in routes**, chosen by who you are (the website's *Login* page has a tab for each):

* **Staff — email + password** (admin, operational head, doctors, inventory / pharmacy desks). Staff can change their own password
  (header → *Change password*), reset a forgotten one (*Forgot password?* → a 6-digit code emailed to them), and an administrator can
  reset it for them. There is **no OTP route into a staff account**.
* **Customers — mobile number + 6-digit OTP** (app and website). Pet parents have no password to remember or lose.

**Staff** (development passwords — change them before going live; verified working against the current seed):

| Role | Name | Email | Password | What they see / do |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Super Admin | `admin@cadovet.com` | `Admin#2026Vet9!` | Everything: users, roles, doctors, all appointments, audit logs |
| **Operational head** (unlocked, no branch) | Operations Head | `operations.head@cadovet.com` | `OpsHead#2026Rv6!` | Receives **every** appointment request, **assigns a doctor**, registers callers, books for callers, billing. No clinical records |
| **Operational head** (Main Branch) | Ops Demo | `ops.demo@cadovet.com` | `OpsDemo#2026Lm5!` | Same as above, scoped to Main Branch only |
| **Operational head** (Andheri Branch) | Ops Andheri | `ops.andheri@cadovet.com` | `OpsAndheri#2026Qz4!` | Same as above, scoped to Andheri Branch only — for testing multi-branch isolation |
| **Doctor** (Main Branch) | Dr. Ananya Kapoor | `doctor.demo@cadovet.com` | `DoctorDemo#2026Nk4!` | **Only** appointments assigned to her, and those patients/owners/records |
| **Doctor** (Main + Andheri) | Dr. Multi Branch | `multi.doctor@cadovet.com` | `MultiDoctor#2026Tp8!` | Rostered at two branches — for testing a doctor who works across locations |
| **Inventory desk** (Main Branch) | Inventory Demo | `inventory.demo@cadovet.com` | `InventoryDemo#2026Wc2!` | Pharmacy & stock only |
| **Pharmacy desk** (Main Branch) | Pharmacy Demo | `pharmacy.demo@cadovet.com` | `PharmacyDemo#2026Yb7!` | Pharmacy & stock only |
| **Pharmacy desk** (Andheri Branch) | Pharm Andheri | `pharm.andheri@cadovet.com` | `PharmAndheri#2026Bd9!` | Pharmacy & stock only, scoped to Andheri Branch |

**Customers** (mobile → OTP; in development the backend accepts the fixed code **`123456`** for these numbers only):

| Name | Mobile | Data |
| :--- | :--- | :--- |
| Anita Rao | `9000000021` | 1 pet (Rocky, Dog), 1 completed appointment |
| Vikram Singh | `9000000022` | 1 pet (Bruno, Dog), 1 completed appointment |
| Emergency Test | `9000000033` | 1 pet (Whiskers, Cat), 1 pending appointment |
| *Sign-up tests* | `9000000001` … `9000000005` | Register on the app or website with any name |

Any other number gets a random code that is printed in the backend console (`[otp] (SMS not configured) code for …`). The fixed code is
set by `OTP_TEST_CODE` / `OTP_TEST_MOBILES` in `cadovet-server/.env` (template in `.env.example`); it covers **customer numbers only**,
never staff, and is **ignored** — with a warning in the log — when `NODE_ENV=production` or a real SMS provider is configured.

**How the password route is protected:** passwords are bcrypt-hashed and must be 8–72 characters with a letter and a number; 10 wrong
passwords lock the account for 15 minutes; "unknown email" and "wrong password" answer identically and take the same time; a customer
account can never be entered through the password route; changing or resetting a password ends **every** other session (each access
token carries a per-account version); an administrator-set temporary password must be replaced at first sign-in; emailed reset codes are
single-use, expire after 10 minutes, lock after 5 wrong tries and are limited to 3 per hour. Without an SMTP server the reset code is
printed in the backend console (development).

---

## 🚫 What a doctor cannot see

The doctor panel has no Customers directory and no Doctors/Staff directory — not even read-only, not even their own doctor
profile by that route. `DOCTOR_VIEW` and `CUSTOMER_VIEW` are not granted to the `DOCTOR` role at all (`migrate_doctor_scope.sql`),
so `GET /api/customers` and `GET /api/doctors` are a flat 403, and the corresponding nav items and routes are gone from the panel.
A doctor works only from their own assigned appointments, which already carry the patient's and owner's name, mobile and details.

This also closes a real gap: a `doctor_id` set on an appointment without going through the assignment workflow (`assigned_at`
IS NULL — e.g. data from before this workflow existed) is **never** treated as "this doctor's patient". `listAppointments`,
`getAppointment`, `updateStatus`, and the pet / medical-record scoping all additionally require `assigned_at IS NOT NULL`, so a
doctor never sees a customer, pet or appointment that was not actually handed to them by the operational head or admin.

## 🩺 Clinic workflow (roles, requests, assignment)

```
 APP (customer)  ─┐                                         ┌─► DOCTOR  sees only appointments assigned to them
 WEBSITE (guest or│   request: pet + service + date + time  │
   customer)      ├──► PENDING, no doctor  ──►  OPERATIONAL ─┤   ► assigns a doctor (checks the doctor's days, hours, free slot)
 PHONE CALL       │                              HEAD queue   │   ► status becomes CONFIRMED, customer sees the doctor
 (staff books)   ─┘                                          └─► ADMIN  sees everything
```

* **Requests, not bookings.** A customer picks a date and time but **not a doctor**. Every request from the app, the website
  (visitor form or customer dashboard) and staff bookings without a doctor is stored `PENDING` with `doctor_id = NULL` and appears in the
  operational head's **Needs doctor** queue (oldest date first, filterable by source: App / Website / Phone).
* **Clinic capacity.** A time is offered while fewer open requests exist at that time than doctors working then
  (`GET /api/appointments/availability?date=`). Simultaneous requests are serialised, so the clinic cannot be overbooked.
* **Assignment** — `PATCH /api/appointments/:id/assign {doctor_id, appointment_date?, appointment_time?}` (permission
  `APPOINTMENT_ASSIGN`: operational head and admin only). It checks the doctor is active, works that day and hour, and is free; the
  appointment becomes `CONFIRMED`, `assigned_by` / `assigned_at` are recorded, and it is audited. Re-assigning moves it to another doctor.
  A website doorstep window ("10:00 AM to 12:00 PM") must be given an exact time when assigned.
* **A doctor sees only their own work.** The list, `GET /appointments/:id`, and the related pets, customers and medical records are all
  limited to what is assigned to them (others are **404**, not 403). Before assignment the doctor cannot see the request at all. A doctor can
  only mark **their own confirmed** appointments `COMPLETED`; they cannot create, assign, edit or cancel. A doctor account without a
  doctor profile sees nothing.
* **Customer moves an assigned visit** → it returns to the queue as `PENDING` and the doctor loses sight of it.
* **Rules the database enforces:** one active appointment per doctor per date/time slot, and a `CONFIRMED`/`COMPLETED` appointment always
  has a doctor.
* **Callers.** When someone phones the clinic the operational head opens **Customers → Register a customer** (name + mobile, email
  optional; **no password**). The customer can then sign in to the app or website straight away with that mobile number and an OTP. The
  operational head can then add their pet and **Book for a caller** (queued, or straight to a doctor).
* **Staff accounts.** Admin creates staff on **System Users** (email + a temporary password the person must change at first sign-in;
  the *Operational head* and desk roles; mobile optional) and doctors on **Doctors → Add doctor** (email + temporary password,
  specialization, working days and hours). **Reset password** on the Users page sets a new temporary password and signs the person out. Roles: `ADMIN`, `OPERATIONAL_HEAD`,
  `DOCTOR`, `SUBADMIN` (inventory / pharmacy desks only), `CUSTOMER`; permissions are editable on the *Roles & Matrix* page.

## 🔗 How the four parts connect

```
 MOBILE APP (Expo)  ─┐                       ┌─ ADMIN PORTAL  /admin/*   (admin, operational head, doctor — email + password)
 (customers, OTP)    ├──►  BACKEND  ◄────────┤
 WEBSITE  (React)   ─┘     Express + PostgreSQL └─ WEBSITE      /, /login  (visitors book; customers sign in with OTP)
```

| Concern | How it is shared |
| :--- | :--- |
| **One API** | Every client calls the same `cadovet-server` (`/api/...`). App: `EXPO_PUBLIC_API_URL`. Website + portal: `VITE_API_URL` (`cadovet-client/src/config.js`). |
| **One customer identity** | A customer is a `users` row with a mobile number. The same number works in the app, on the website and in the portal. Mobile numbers are stored in ONE canonical form (India: 10 digits; other countries: `+<code><number>`), whatever way they were typed (`+91 98765-43210`, `98765 43210`…). |
| **Website guest → app** | A visitor who books on the website gets a customer record automatically (no password). The same person can later sign in to the app or website with an OTP for that number and sees the booking, pet and invoice. |
| **Portal → app/website** | Staff actions (complete/cancel an appointment, create an invoice, write a medical record, deactivate a customer) are what the customer sees next time they open the app or dashboard. |
| **Slots** | One doctor, one active appointment per date and time slot — enforced in the API *and* by a database index, so simultaneous bookings from any client cannot double-book. |
| **Permissions** | Customers can only reach their own pets, appointments, invoices, records and documents; staff endpoints return 403 to customers. |

## 🧪 Automated tests

```bash
npm test          # backend: 255 API/integration tests on a fresh isolated database (~25 s)
npm run e2e       # real browser (Chrome) + backend + website + admin portal, 50 cross-system checks
```

* `cadovet-server/tests/` — `node:test` suites, each hitting the real Express app over HTTP against `cadovet_test`
  (built from `schema.sql` + seeds + migrations by `tests/setup-db.js`; it refuses to touch any database not named `*_test`):
  `01-auth` (OTP sign-up/login, replay, expiry, brute force, refresh rotation, token forgery, account deletion) ·
  `02-authorization` (permission matrix, cross-customer access) · `03-appointments` (validation, slots, races, lifecycle) ·
  `04-public-booking` (the website's unauthenticated booking) · `05-data-flow` (app ↔ backend ↔ portal ↔ website stories) ·
  `06-hardening` (headers, bad input, rate limits, production-mode start-up checks) · `07-seed-integrity` (documented accounts work, DB constraints) ·
  `08-workflow` (operational-head queue, assignment, doctor-only visibility — including that a bare `doctor_id` with no
  real assignment never counts as a patient — call-in registration, creating staff and doctors) ·
  `09-staff-auth` (change / reset / forgot password, forced first-login change, sessions ending on a change, lock-outs).
* `e2e/run.mjs` — starts its own backend (:5002) and website (:5174) on the test database and drives Chrome through: a website booking and
  an app request → the **operational head** signing in with email + password, seeing both in the *Needs doctor* queue and assigning one in the panel → the
  app showing `CONFIRMED` with the doctor → the **doctor** signing in with email + password, seeing only the assigned visit (not the unassigned one) and
  completing it → the operational head registering a caller who signs in by mobile → a website customer signing in / signing up by OTP →
  staff security: wrong password, OTP refused for a staff mobile, forced change of a temporary password, changing it from the header, forgot-password by emailed code. Needs PostgreSQL and Google Chrome (`CHROME_PATH` to override).
* Tests read the real random OTP from the server log; the `OTP_TEST_CODE` shortcut is explicitly disabled for them.

## 🚀 Production checklist

Set / do these before real users touch it (the API refuses to start in production without a strong `JWT_SECRET`):

- [ ] `NODE_ENV=production`, and `JWT_SECRET` = a random string of **32+ characters** (`openssl rand -hex 32`). The API will not boot otherwise.
- [ ] `CORS_ORIGIN` = your website origin(s), comma separated (`https://cadovet.com,https://admin.cadovet.com`). Unset means "no cross-origin browser access" in production; `*` works but is logged as a warning.
- [ ] **Change or delete every seeded account.** The seeded staff and customers and their passwords / numbers are public in this README. Create your own admin (then your operational head and doctors from the panel — each gets a temporary password they must change), and deactivate the seeded ones.
- [ ] Do **not** set `OTP_TEST_CODE`, `OTP_TEST_MOBILES` or `RESET_CODE_IN_RESPONSE` (the first two are ignored in production and logged, the last is unsafe).
- [ ] Configure **SMTP** (`SMTP_HOST`, `MAIL_FROM`… in `cadovet-server/.env.example`) so staff can receive password-reset codes, and **SMS** (Twilio) for customers' OTP.
- [ ] Configure SMS (`TWILIO_*`, see `cadovet-server/.env.example`) — without it OTP codes only appear in the server log. For India, register the sender ID and template (DLT).
- [ ] Serve everything over **HTTPS**; set `VITE_API_URL=https://api…/api` when building the website and `EXPO_PUBLIC_API_URL` for the app build.
- [ ] Put a shared rate limiter (nginx, gateway or Redis) in front if you run more than one API instance: the built-in limits (10 wrong passwords per account per 15 min, 5 OTPs/hour/number, 30 public bookings/hour/IP) are per process.
- [ ] Back up PostgreSQL; run `migrate_hardening.sql` (it fails, on purpose, if existing rows already double-book a slot — fix those first).
- [ ] Known API quirk: `/customers/:id` and `/customers/:id/status` take the **user** id (the list's `id`), while `/pets?customer_id=` takes the customers-table id.

## 🏗️ System Architecture

- **Frontend (`cadovet-client`):** React 19, Vite, Vanilla CSS design system, React Router v7, Axios.
- **Backend (`cadovet-server`):** Node.js, Express, PostgreSQL (`pg`), JWT authentication, Bcrypt password hashing, Helmet security headers, CORS.
- **Database:** PostgreSQL relational schema with foreign key cascades, role-based access control, and audit logs.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js:** v18 or newer
- **PostgreSQL:** Running locally on port 5432

### 2. Configure Environment

#### Backend (`cadovet-server/.env`)
```env
PORT=5001
DATABASE_URL=postgresql://murat@localhost:5432/cadovet
JWT_SECRET=cadovet_super_secret_jwt_2024_key
JWT_EXPIRES_IN=1d
CORS_ORIGIN=*
```

### 3. Database Initialization & Migrations

Execute the SQL scripts in order using `psql`:

```bash
# 1. Initialize schema & base seed
psql -d cadovet -f cadovet-server/src/database/schema.sql
psql -d cadovet -f cadovet-server/src/database/seeds.sql

# 2. Apply Phase 2 (Customers & Audit Logs)
psql -d cadovet -f cadovet-server/src/database/migrate_phase2.sql

# 3. Apply Phase 3 (Pets Table, Permissions & Test Accounts)
psql -d cadovet -f cadovet-server/src/database/migrate_phase3.sql

# 4. Apply Phase 4 (Services, Doctors, and Appointments)
psql -d cadovet -f cadovet-server/src/database/migrate_phase4.sql

# 5. Apply Phase 5 & 6 (Clinical Records, Prescriptions, Invoices, and Inventory)
psql -d cadovet -f cadovet-server/src/database/migrate_phase5_6.sql

# 6. Mobile app, documents/coupons/referrals, blog, password reset, OTP sign-in, production hardening
psql -d cadovet -f cadovet-server/src/database/migrate_mobile.sql
psql -d cadovet -f cadovet-server/src/database/migrate_records_offers.sql
psql -d cadovet -f cadovet-server/src/database/migrate_blog.sql
psql -d cadovet -f cadovet-server/src/database/migrate_password_reset.sql
psql -d cadovet -f cadovet-server/src/database/migrate_otp.sql
psql -d cadovet -f cadovet-server/src/database/migrate_hardening.sql   # fails loudly if existing data double-books a slot
psql -d cadovet -f cadovet-server/src/database/migrate_workflow.sql    # operational-head / doctor roles, assignment columns
psql -d cadovet -f cadovet-server/src/database/migrate_staff_auth.sql  # forced password change, session versioning
```
`npm test` (see *Automated tests*) builds a throw-away database from exactly these files, so they are proven to work on a fresh install.

### 4. Build the Project

You can build the production frontend bundle directly from the workspace root:

```bash
npm run build
```

Or from within `cadovet-client`:
```bash
cd cadovet-client
npm run build
```

### 5. Run the Project

#### Option 1: From the root directory (Runs both Backend & Frontend)
```bash
npm start
# or
npm run dev
# or
chmod +x start.sh && ./start.sh
```

#### Option 2: Run individually in two separate terminals

#### Terminal 1 — Backend (`cadovet-server`):
```bash
cd cadovet-server
npm install
node server.js
# Backend runs on http://localhost:5001
```

#### Terminal 2 — Frontend (`cadovet-client`):
```bash
cd cadovet-client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 📌 Development Phases & Implementation Overview

### ✅ Phase 1: Authentication & Security Foundation
- Single identifier login (automatic detection for Email vs. Mobile number).
- Customer registration with password hashing (`bcryptjs`).
- Role-Based Access Control (RBAC) with JWT authentication and permission verification middleware.
- Route protection (`ProtectedRoute`) and UI component guards (`PermissionGuard`).

### ✅ Phase 2: Admin Foundation & Customer Directory
- **Customers Management (`/admin/customers`):** Full customer listing, search by name/email/mobile, add customer modal, and activate/deactivate status toggle.
- **Staff / Users Management (`/admin/users`):** Staff directory, role and department badges, create staff modal.
- **Roles & Permissions Matrix (`/admin/roles`):** Role selector with granular permission checkboxes grouped by module.
- **Audit Logs (`/admin/audit-logs`):** Color-coded audit trail tracking logins, updates, and creation events.
- **Admin Layout:** Collapsible sidebar with dynamic permission-filtered navigation.

### ✅ Phase 3: Customer Portal & Pet Management System
- **Database Schema:** `pets` table with species, breed, gender, DOB, weight, color, microchip number, blood group, vaccination status, neutered status, allergies, and clinical notes.
- **Backend API (`/api/pets`):** Role-based ownership enforcement (customers access only their pets, admins/doctors access all).
- **Admin Pet Management (`/admin/pets`):** Summary cards (Total Pets, Dogs, Cats, Vaccinated count), species filtering pills, Add/Edit Pet modals, and detailed Pet Medical Profile card modal.

### ✅ Phase 4: Appointments, Services & Doctor Specialists
- **Appointments Management (`/admin/appointments`):** Schedule visits, status management (`CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED`), doctor assignments, and date filter controls.
- **Hospital Services & Pricing (`/admin/services`):** Consultation, surgical, dental, grooming, and diagnostics catalog with fees, durations, and active status toggle.
- **Veterinary Doctors Directory (`/admin/doctors`):** Specialist profiles, schedules, ratings, and consultation fees.
- **Customer Portal Live Booking:** Dynamic appointment scheduling directly linked with doctors and services.

### ✅ Phase 5: Clinical Records, Consultations & Prescriptions
- **Clinical Records (`/admin/medical-records`):** Doctor examination notes, symptoms, diagnoses, patient weight & temperature vitals, and treatment plans.
- **Digital Prescriptions (`/api/prescriptions`):** Medicine name, dosage, frequency, duration in days, and special instructions.
- **Customer Portal Medical History:** Pet parents can view clinical examination reports and digital prescription slips for their registered pets.

### ✅ Phase 6: Hospital Invoicing, Billing & Pharmacy / Inventory
- **Invoices & Billing (`/admin/invoices`):** Generation of hospital invoices, payment tracking (`PAID`, `PENDING`), revenue statistics, and printable receipt slips.
- **Pharmacy & Medical Inventory (`/admin/inventory`):** Stock tracking for medicines, vaccines, and surgical supplies with low-stock warning banners and quick stock adjustments (`+5`, `-1`).
- **SubAdmin Department Portals:** Tailored workspaces for `DOCTOR`, `OPERATIONAL`, `INVENTORY`, and `MEDICINE` staff in `SubAdminDashboard`.

---

## 📡 Complete REST API Endpoints Reference

| Method | Endpoint | Access / Permission | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Login with email or mobile identifier |
| `POST` | `/api/auth/signup` | Public | Register a new customer account |
| `GET` | `/api/auth/me` | Authenticated | Fetch current user profile and assigned permissions |
| `GET` | `/api/appointments` | `APPOINTMENT_VIEW` | List appointments (scoped for customers and doctors) |
| `POST` | `/api/appointments` | `APPOINTMENT_CREATE` | Book / schedule a veterinary appointment |
| `PATCH` | `/api/appointments/:id/status` | `APPOINTMENT_UPDATE` | Update visit status (CONFIRMED, COMPLETED, CANCELLED) |
| `DELETE` | `/api/appointments/:id` | `APPOINTMENT_CANCEL` | Cancel an appointment |
| `GET` | `/api/services` | `SERVICE_VIEW` | List hospital services with prices and categories |
| `POST` | `/api/services` | `SERVICE_MANAGE` | Create new hospital service |
| `PUT` | `/api/services/:id` | `SERVICE_MANAGE` | Update service pricing and details |
| `GET` | `/api/doctors` | `DOCTOR_VIEW` | List veterinary doctors and specialists |
| `PUT` | `/api/doctors/:id` | `DOCTOR_UPDATE` | Update doctor profile, consultation fee, and schedule |
| `GET` | `/api/medical-records` | `MEDICAL_RECORD_VIEW` | List clinical records and digital prescriptions |
| `POST` | `/api/medical-records` | `MEDICAL_RECORD_MANAGE` | Create clinical consultation notes & prescription |
| `GET` | `/api/invoices` | `INVOICE_VIEW` | List hospital invoices & revenue metrics |
| `POST` | `/api/invoices` | `INVOICE_MANAGE` | Generate new billing invoice |
| `PATCH` | `/api/invoices/:id/status` | `INVOICE_MANAGE` | Mark invoice as PAID / PENDING |
| `GET` | `/api/inventory` | `INVENTORY_VIEW` | List pharmacy supplies, stock counts, and low-stock alerts |
| `POST` | `/api/inventory` | `INVENTORY_MANAGE` | Add new pharmaceutical or surgical supply |
| `PATCH` | `/api/inventory/:id/adjust-stock` | `INVENTORY_MANAGE` | Adjust inventory stock quantity |
| `GET` | `/api/pets` | `PET_VIEW` | List pets (scoped to customer for CUSTOMER role) |
| `POST` | `/api/pets` | `PET_CREATE` | Register a new pet patient |
| `GET` | `/api/customers` | `CUSTOMER_VIEW` | Customer directory with search & status filters |
| `GET` | `/api/users` | `USER_CREATE` | List staff and administrators |
| `GET` | `/api/roles` | `ROLE_MANAGE` | List roles and assigned permissions |
| `GET` | `/api/audit-logs` | `REPORT_VIEW` | System audit trail |

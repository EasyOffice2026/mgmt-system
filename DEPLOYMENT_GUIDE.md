# ================================================================
# TROT DATA MANAGEMENT SYSTEM — COMPLETE DEPLOYMENT GUIDE
# For Developer / IT Person
# ================================================================

## Overview
A cloud-based data management system for business operations.
- Frontend: React.js (deployed on Vercel — free)
- Database + Auth + Storage: Supabase (free tier)
- Languages: English + Arabic (RTL)
- Modules: Customers, Sales/Contracts, Purchase, Inventory, Legal Cases,
  Expenses, Receipts, Accounting, HRD (Employees, Attendance, Payroll, Leaves),
  Users, Settings

---

## STEP 1 — Create Supabase Project (10 min)

1. Go to https://supabase.com → Sign up (free)
2. Click "New Project"
3. Name: `mgmt-system`
4. Database password: choose a strong password → SAVE IT
5. Region: choose closest to Kuwait (e.g. eu-west-1)
6. Click "Create new project" → wait ~2 min

---

## STEP 2 — Set Up Database (5 min)

1. In Supabase dashboard → click "SQL Editor" (left sidebar)
2. Click "New query"
3. Open the file: `database/schema.sql`
4. Copy ALL contents → paste into SQL editor
5. Click "Run" (green button)
6. You should see: "Success. No rows returned."

---

## STEP 3 — Set Up Storage Buckets (5 min)

In Supabase dashboard → "Storage" → "New bucket":

Create these buckets (make them PUBLIC):
- `customer-docs`
- `employee-docs`
- `contracts`
- `purchases`
- `expenses`
- `receipts`
- `legal`

For each bucket → click on it → "Policies" → "New policy" → "For full customization":
```sql
-- Allow authenticated users to upload/view files
CREATE POLICY "auth_access"
ON storage.objects FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

---

## STEP 4 — Create First Owner User (3 min)

1. Supabase dashboard → "Authentication" → "Users" → "Invite user"
2. Email: `owner@company.com`
3. They will receive an email to set their password
   OR: use "Add user" → set email + password manually

4. After creating the auth user, go to SQL Editor and run:
```sql
INSERT INTO user_profiles (id, full_name, role)
SELECT id, 'System Owner', 'owner'
FROM auth.users
WHERE email = 'owner@company.com';
```

---

## STEP 5 — Get Your API Keys (2 min)

1. Supabase dashboard → "Settings" (bottom left) → "API"
2. Copy:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## STEP 6 — Deploy Frontend to Vercel (10 min)

### Option A — GitHub (Recommended)

1. Create a GitHub account at https://github.com (free)
2. Create new repository: `mgmt-system`
3. Upload all files in the `frontend/` folder to the repo

4. Go to https://vercel.com → Sign up with GitHub
5. Click "New Project" → import your GitHub repo
6. Framework preset: **Create React App** (auto-detected)
7. Under "Environment Variables", add:
   - `REACT_APP_SUPABASE_URL` = your Supabase Project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
8. Click "Deploy" → done in ~3 min

### Option B — Direct Upload (No GitHub)

1. On your computer, open terminal in the `frontend/` folder:
```bash
cp .env.example .env
# Edit .env and fill in your Supabase URL and key
npm install
npm run build
```
2. Go to https://vercel.com → drag and drop the `build/` folder
3. Add environment variables in Vercel dashboard → Settings → Environment Variables

---

## STEP 7 — Login & Test (2 min)

1. Open your Vercel URL (e.g. `https://mgmt-system.vercel.app`)
2. Login with: `owner@company.com` and the password you set
3. Test: Add a customer, create a contract, add an employee

---

## MAINTENANCE & BACKUP

### Adding More Users
- Supabase → Authentication → Users → Add user
- Then SQL Editor:
```sql
INSERT INTO user_profiles (id, full_name, role)
SELECT id, 'Staff Name', 'staff'  -- or 'admin'
FROM auth.users
WHERE email = 'newuser@company.com';
```

### Database Backups
- Supabase → Settings → Database → "Database backups"
- Pro plan ($25/mo) includes automated daily backups
- Free tier: export manually via SQL Editor: `pg_dump`

### Scaling (if needed)
- Free tier limits: 500MB database, 1GB storage, 50,000 monthly active users
- Supabase Pro: $25/month — 8GB database, 100GB storage
- Vercel: Free tier is generous for most businesses

---

## STORAGE BUCKETS REFERENCE

| Bucket         | Used For                        |
|----------------|---------------------------------|
| customer-docs  | Civil IDs, Passports, Photos    |
| employee-docs  | Employee documents              |
| contracts      | Contract copies                 |
| purchases      | Purchase invoices               |
| expenses       | Expense receipts                |
| receipts       | Payment vouchers                |
| legal          | Legal case documents            |

---

## MODULES SUMMARY

| Module          | Features                                                    |
|-----------------|-------------------------------------------------------------|
| Dashboard       | KPIs, expiring docs alert, recent contracts, charts         |
| Customers       | CRUD, Civil ID/Mobile validation, address, attachments      |
| Sales/Contracts | Auto-installment schedule, inventory link, status tracking  |
| Purchase        | Supplier invoices, auto-inventory, categories               |
| Inventory       | All purchased items, status tracking (in stock/assigned)    |
| Legal Cases     | Auto excess amount calc, linked to contracts/customers      |
| Expenses        | Voucher numbers, case-linked expenses, all types            |
| Receipts        | File opening, installments, court money                     |
| Accounting      | Monthly P&L, partner contributions, trends                  |
| Employees       | Full profiles, 6 document types, all HR fields              |
| Attendance      | Daily log, bulk mark, hours calculation                     |
| Payroll         | Bulk process, allowances, deductions, payslip               |
| Leaves          | Request/approve workflow, auto day count                    |
| Users           | Role-based access (Owner/Admin/Staff)                       |
| Settings        | Add categories, payment modes                               |

---

## SUPPORT CONTACTS

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- React Docs: https://react.dev

---

## FILE STRUCTURE

```
mgmt-system/
├── database/
│   └── schema.sql          ← Run this in Supabase SQL Editor
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js           ← Main routing
│   │   ├── index.js         ← Entry point
│   │   ├── styles/
│   │   │   └── global.css   ← All styles (EN + AR/RTL)
│   │   ├── contexts/
│   │   │   ├── AuthContext.js
│   │   │   └── LangContext.js
│   │   ├── i18n/
│   │   │   └── translations.js  ← All EN + AR text
│   │   ├── utils/
│   │   │   └── supabaseClient.js
│   │   └── components/
│   │       ├── auth/LoginPage.js
│   │       ├── layout/
│   │       │   ├── Layout.js
│   │       │   └── SharedComponents.js
│   │       └── modules/
│   │           ├── Dashboard.js
│   │           ├── AllModules.js   ← Sales, Purchase, Legal, etc.
│   │           ├── customers/
│   │           ├── hrd/            ← Employees, Attendance, Payroll, Leaves
│   │           └── users/
│   ├── package.json
│   ├── vercel.json
│   └── .env.example        ← Copy to .env and fill in keys
└── DEPLOYMENT_GUIDE.md     ← This file
```

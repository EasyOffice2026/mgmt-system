# ================================================================
# RESTAURANT MANAGEMENT SYSTEM - DEPLOYMENT GUIDE
# ================================================================

## Overview
Cloud-based Restaurant Management System with:
- Frontend: React (deployed on Vercel)
- Database/Auth/Storage: Supabase
- Languages: English + Arabic (RTL)
- Modules: Guests, Menu, Orders, Tables, Reservations, Kitchen, Inventory, Staff, Reports, Users, Settings

---

## Step 1 - Create Supabase Project
1. Go to https://supabase.com and create a project.
2. Keep your database password secure.
3. Choose a region near your operations.

---

## Step 2 - Initialize Database Schema
1. Open Supabase -> SQL Editor.
2. Create a new query.
3. Paste the contents of `database/schema.sql`.
4. Run the script.

---

## Step 3 - Create Initial Owner User
1. In Supabase -> Authentication -> Users, create or invite your owner account.
2. In SQL Editor, link that auth account to a profile:

```sql
INSERT INTO user_profiles (id, full_name, role)
SELECT id, 'Restaurant Owner', 'owner'
FROM auth.users
WHERE email = 'owner@restaurant.com';
```

---

## Step 4 - Configure Frontend Environment
Inside `frontend/.env`:

```bash
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can copy from `.env.example` if needed.

---

## Step 5 - Run Locally
```bash
cd frontend
npm install
npm start
```

---

## Step 6 - Deploy to Vercel
1. Push this repo to GitHub/GitLab.
2. Import the project in Vercel.
3. Set:
   - `root directory` to `frontend`
   - `build command`: `npm run build`
4. Add environment variables from Step 4.
5. Deploy.

---

## Recommended Supabase Buckets (optional)
Create public buckets if you want file/image uploads:
- `menu-images`
- `kitchen`
- `staff-docs`
- `inventory-docs`

---

## Post-deployment checklist
- Login with owner account.
- Add menu categories and menu items.
- Add dining tables.
- Create a test guest, reservation, and order.
- Move an order through kitchen statuses.
- Validate dashboard/report figures.

# Mudawwarah Restaurant Management System

Cloud-based restaurant management system for Mudawwarah Kuwait operations.

## Features

- **Dashboard** — KPI cards and branch-wise summary
- **Sales** — Daily sales with 7 payment channels (Cash, KNET, Link, WAMD, Talabat, Jahez, KEETA) + Foodics comparison
- **Purchases** — Purchase orders with item master management
- **Expenses** — Expense tracking by category
- **Human Resources** — Employee management with Civil ID / Mobile validation
- **Cash Sheet** — Daily cash tracking with auto-calculated values
- **Export** — Excel, CSV, PDF exports for all modules
- **i18n** — English / Arabic with RTL support
- **Branch-wise login** — Owner sees all branches, branch users see only their branch

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, python-jose (JWT), passlib (bcrypt)
- **Frontend**: React 18, React Router, Vite, lucide-react, react-hot-toast

## Setup

### Backend

```bash
pip install -e .
cd backend && PYTHONPATH=.. uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend && npm install && npm run build
```

The built frontend is served by FastAPI from `frontend/dist/`.

## Demo Credentials

| Username | Password | Role | Branch |
|----------|----------|------|--------|
| owner | owner123 | owner | All Branches |
| manager | manager123 | manager | All Branches |
| aqeelah | aqeelah123 | branch_user | Al Aqeelah |
| aradiya | aradiya123 | branch_user | Al Aradiya |
| jahra | jahra123 | branch_user | Al Jahra |
| ayoun | ayoun123 | branch_user | Al Ayoun |
| kitchen | kitchen123 | branch_user | Central Kitchen |

## Branches

1. Al Aqeelah (العقيلة)
2. Al Aradiya (العارضية)
3. Al Jahra (الجهراء)
4. Al Ayoun (العيون)
5. Central Kitchen (المطبخ المركزي)

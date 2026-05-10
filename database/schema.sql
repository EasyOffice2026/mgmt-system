-- Management System Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- User Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  full_name_ar TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'salesman', 'accountant', 'staff')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Customers
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_no TEXT UNIQUE,
  name TEXT NOT NULL,
  civil_id TEXT NOT NULL,
  mobile TEXT NOT NULL,
  passport_no TEXT DEFAULT '',
  email TEXT DEFAULT '',
  work_place TEXT DEFAULT '',
  client_check TEXT DEFAULT '',
  area_name TEXT DEFAULT '',
  block_no TEXT DEFAULT '',
  street_no TEXT DEFAULT '',
  house_no TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate customer number
CREATE OR REPLACE FUNCTION generate_customer_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.customer_no := 'CUST-' || LPAD(
    (SELECT COALESCE(MAX(CAST(REPLACE(customer_no, 'CUST-', '') AS INTEGER)), 0) + 1 FROM customers)::TEXT, 5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_customer_no ON customers;
CREATE TRIGGER tr_customer_no
  BEFORE INSERT ON customers
  FOR EACH ROW
  WHEN (NEW.customer_no IS NULL)
  EXECUTE FUNCTION generate_customer_no();

-- Unique constraint on civil_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_civil_id ON customers(civil_id);

-- ============================================
-- Purchases (also serves as inventory source)
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_date DATE DEFAULT CURRENT_DATE,
  supplier_name TEXT NOT NULL DEFAULT '',
  invoice_no TEXT DEFAULT '',
  shop_location TEXT DEFAULT '',
  category TEXT DEFAULT '',
  item_name TEXT NOT NULL DEFAULT '',
  model_type TEXT DEFAULT '',
  purchase_price NUMERIC(12,3) DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold')),
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Contracts (Sales)
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_no TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT DEFAULT '',
  category TEXT DEFAULT '',
  product_id UUID REFERENCES purchases(id),
  product_name TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  item_name TEXT DEFAULT '',
  model_type TEXT DEFAULT '',
  client_type TEXT DEFAULT 'new' CHECK (client_type IN ('new', 'existing')),
  file_opening_charges NUMERIC(12,3) DEFAULT 0,
  sale_price NUMERIC(12,3) DEFAULT 0,
  purchase_price NUMERIC(12,3) DEFAULT 0,
  duration_months INTEGER DEFAULT 12,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  first_installment_date DATE,
  last_installment_date DATE,
  installment_value NUMERIC(12,3) DEFAULT 0,
  installment_amount NUMERIC(12,3) DEFAULT 0,
  paid_amount NUMERIC(12,3) DEFAULT 0,
  remaining_amount NUMERIC(12,3) DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished', 'legal_case')),
  installments JSONB DEFAULT '[]'::jsonb,
  installment_schedule JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate contract number
CREATE OR REPLACE FUNCTION generate_contract_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.contract_no := 'CON-' || LPAD(
    (SELECT COALESCE(MAX(CAST(REPLACE(contract_no, 'CON-', '') AS INTEGER)), 0) + 1 FROM contracts)::TEXT, 5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_contract_no ON contracts;
CREATE TRIGGER tr_contract_no
  BEFORE INSERT ON contracts
  FOR EACH ROW
  WHEN (NEW.contract_no IS NULL)
  EXECUTE FUNCTION generate_contract_no();

-- ============================================
-- Legal Cases
-- ============================================
CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_case_no TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT DEFAULT '',
  contract_id UUID REFERENCES contracts(id),
  contract_no TEXT DEFAULT '',
  case_no TEXT DEFAULT '',
  purchase_price NUMERIC(12,3) DEFAULT 0,
  original_amount NUMERIC(12,3) DEFAULT 0,
  remaining_from_customer NUMERIC(12,3) DEFAULT 0,
  case_amount NUMERIC(12,3) DEFAULT 0,
  rcvd_from_customer NUMERIC(12,3) DEFAULT 0,
  rcvd_from_court NUMERIC(12,3) DEFAULT 0,
  excess_amount NUMERIC(12,3) DEFAULT 0,
  actual_amount NUMERIC(12,3) DEFAULT 0,
  claimed_amount NUMERIC(12,3) DEFAULT 0,
  balance_amount NUMERIC(12,3) DEFAULT 0,
  case_date DATE DEFAULT CURRENT_DATE,
  court_fees NUMERIC(12,3) DEFAULT 0,
  court_schedule JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate legal case number
CREATE OR REPLACE FUNCTION generate_legal_case_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.legal_case_no := 'LC-' || LPAD(
    (SELECT COALESCE(MAX(CAST(REPLACE(legal_case_no, 'LC-', '') AS INTEGER)), 0) + 1 FROM legal_cases)::TEXT, 5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_legal_case_no ON legal_cases;
CREATE TRIGGER tr_legal_case_no
  BEFORE INSERT ON legal_cases
  FOR EACH ROW
  WHEN (NEW.legal_case_no IS NULL)
  EXECUTE FUNCTION generate_legal_case_no();

-- ============================================
-- Expenses
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_voucher_no TEXT UNIQUE,
  expense_date DATE DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC(12,3) DEFAULT 0,
  description TEXT DEFAULT '',
  case_no TEXT DEFAULT '',
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT DEFAULT '',
  contract_id UUID REFERENCES contracts(id),
  contract_no TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate expense voucher number
CREATE OR REPLACE FUNCTION generate_expense_voucher_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expense_voucher_no := 'EXP-' || LPAD(
    (SELECT COALESCE(MAX(CAST(REPLACE(expense_voucher_no, 'EXP-', '') AS INTEGER)), 0) + 1 FROM expenses)::TEXT, 5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_expense_voucher_no ON expenses;
CREATE TRIGGER tr_expense_voucher_no
  BEFORE INSERT ON expenses
  FOR EACH ROW
  WHEN (NEW.expense_voucher_no IS NULL)
  EXECUTE FUNCTION generate_expense_voucher_no();

-- ============================================
-- Receipt Vouchers
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_voucher_no TEXT UNIQUE,
  receipt_date DATE DEFAULT CURRENT_DATE,
  receipt_type TEXT NOT NULL DEFAULT 'installment',
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT DEFAULT '',
  contract_id UUID REFERENCES contracts(id),
  contract_no TEXT DEFAULT '',
  court_case_no TEXT DEFAULT '',
  received_amount NUMERIC(12,3) DEFAULT 0,
  discount_amount NUMERIC(12,3) DEFAULT 0,
  net_amount NUMERIC(12,3) DEFAULT 0,
  installment_no INTEGER DEFAULT NULL,
  payment_mode TEXT DEFAULT 'cash',
  notes TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate receipt voucher number
CREATE OR REPLACE FUNCTION generate_receipt_voucher_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.receipt_voucher_no := 'RV-' || LPAD(
    (SELECT COALESCE(MAX(CAST(REPLACE(receipt_voucher_no, 'RV-', '') AS INTEGER)), 0) + 1 FROM receipt_vouchers)::TEXT, 5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_receipt_voucher_no ON receipt_vouchers;
CREATE TRIGGER tr_receipt_voucher_no
  BEFORE INSERT ON receipt_vouchers
  FOR EACH ROW
  WHEN (NEW.receipt_voucher_no IS NULL)
  EXECUTE FUNCTION generate_receipt_voucher_no();

-- ============================================
-- Partners (for Accounting)
-- ============================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_name TEXT NOT NULL DEFAULT '',
  contribution NUMERIC(12,3) DEFAULT 0,
  amount_received NUMERIC(12,3) DEFAULT 0,
  share_percentage NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Categories (configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT DEFAULT '',
  type TEXT DEFAULT 'purchase' CHECK (type IN ('purchase', 'expense')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, name_ar, type) VALUES
  ('Mobile', 'جوال', 'purchase'),
  ('Car', 'سيارة', 'purchase'),
  ('Furniture', 'أثاث', 'purchase'),
  ('Electronics', 'إلكترونيات', 'purchase'),
  ('Jewelry', 'مجوهرات', 'purchase'),
  ('Other', 'أخرى', 'purchase')
ON CONFLICT DO NOTHING;

-- ============================================
-- Payment Modes (configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_modes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default payment modes
INSERT INTO payment_modes (name, name_ar) VALUES
  ('Cash', 'نقداً'),
  ('Bank Transfer', 'تحويل بنكي'),
  ('Link', 'رابط'),
  ('Wamd', 'ومد')
ON CONFLICT DO NOTHING;

-- ============================================
-- Updated At Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['user_profiles', 'customers', 'purchases', 'contracts', 'legal_cases', 'expenses', 'receipt_vouchers', 'partners'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_updated_at ON %I', tbl);
    EXECUTE format('CREATE TRIGGER tr_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END;
$$;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;

-- Create policies - all authenticated users can read/write
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['user_profiles', 'customers', 'purchases', 'contracts', 'legal_cases', 'expenses', 'receipt_vouchers', 'partners', 'categories', 'payment_modes'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
  END LOOP;
END;
$$;

-- ============================================
-- Storage Buckets (run these separately if needed)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('customer-docs', 'customer-docs', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('purchases', 'purchases', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('expenses', 'expenses', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('legal', 'legal', true) ON CONFLICT DO NOTHING;

-- ============================================================
-- MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA
-- Platform: Supabase (PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LOOKUP / SETTINGS TABLES
-- ============================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, name_ar) VALUES
  ('Mobile', 'جوال'),
  ('Car', 'سيارة'),
  ('Furniture', 'أثاث'),
  ('Electronics', 'إلكترونيات'),
  ('Jewelry', 'مجوهرات'),
  ('Other', 'أخرى');

CREATE TABLE payment_modes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO payment_modes (name, name_ar) VALUES
  ('Cash', 'نقدي'),
  ('Bank Transfer', 'تحويل بنكي'),
  ('Link', 'Link'),
  ('Wamd', 'وامد');

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  full_name_ar VARCHAR(200),
  role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_no VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  full_name_ar VARCHAR(200),
  civil_id VARCHAR(12) UNIQUE CHECK (civil_id ~ '^\d{12}$'),
  mobile VARCHAR(8) CHECK (mobile ~ '^\d{8}$'),
  passport_no VARCHAR(50),
  email VARCHAR(200) CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  area_name VARCHAR(200),
  block_no VARCHAR(20),
  street_no VARCHAR(20),
  house_no VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'legal')),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE customer_seq START 1;

CREATE TABLE customer_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  attachment_type VARCHAR(50) CHECK (attachment_type IN ('civil_id', 'passport', 'other')),
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PURCHASE / INVENTORY
-- ============================================================

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_no VARCHAR(20) UNIQUE NOT NULL,
  purchase_date DATE NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  invoice_no VARCHAR(100),
  place VARCHAR(200),
  category_id UUID REFERENCES categories(id),
  item_name VARCHAR(200) NOT NULL,
  model_type VARCHAR(200),
  purchase_price DECIMAL(12,3) NOT NULL,
  payment_mode_id UUID REFERENCES payment_modes(id),
  inventory_status VARCHAR(20) DEFAULT 'in_stock' CHECK (inventory_status IN ('in_stock', 'assigned', 'sold')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE purchase_seq START 1;

CREATE TABLE purchase_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES / CONTRACTS
-- ============================================================

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_no VARCHAR(30) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  purchase_id UUID REFERENCES purchases(id),
  category_id UUID REFERENCES categories(id),
  client_type VARCHAR(20) DEFAULT 'new' CHECK (client_type IN ('new', 'existing')),
  file_opening_charges DECIMAL(12,3) DEFAULT 0,
  sale_price DECIMAL(12,3) NOT NULL,
  duration_months INTEGER NOT NULL,
  start_date DATE NOT NULL,
  first_installment_date DATE,
  last_installment_date DATE,
  installment_value DECIMAL(12,3),
  payment_mode_id UUID REFERENCES payment_modes(id),
  status VARCHAR(20) DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished', 'legal')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE contract_seq START 1;

CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12,3) NOT NULL,
  paid_amount DECIMAL(12,3) DEFAULT 0,
  paid_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  payment_mode_id UUID REFERENCES payment_modes(id),
  receipt_no VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contract_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  attachment_type VARCHAR(50) DEFAULT 'contract',
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEGAL CASES
-- ============================================================

CREATE TABLE legal_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  purchase_price DECIMAL(12,3),
  original_contract_amount DECIMAL(12,3) NOT NULL,
  remaining_from_customer DECIMAL(12,3) NOT NULL,
  case_amount DECIMAL(12,3),
  received_from_customer DECIMAL(12,3) DEFAULT 0,
  received_from_court DECIMAL(12,3) DEFAULT 0,
  excess_amount DECIMAL(12,3) GENERATED ALWAYS AS (
    received_from_court + received_from_customer - remaining_from_customer
  ) STORED,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'settled', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE legal_seq START 1;

CREATE TABLE legal_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expense_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  requires_case BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO expense_types (name, name_ar, requires_case) VALUES
  ('Rent', 'إيجار', FALSE),
  ('Salaries', 'رواتب', FALSE),
  ('Court Fees', 'رسوم المحكمة', TRUE),
  ('Lawyer Fees', 'أتعاب المحامي', TRUE),
  ('Utilities', 'مرافق', FALSE),
  ('Office Supplies', 'مستلزمات مكتبية', FALSE),
  ('Other', 'أخرى', FALSE);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_no VARCHAR(30) UNIQUE NOT NULL,
  expense_date DATE NOT NULL,
  expense_type_id UUID REFERENCES expense_types(id),
  amount DECIMAL(12,3) NOT NULL,
  case_no VARCHAR(50),
  customer_id UUID REFERENCES customers(id),
  contract_id UUID REFERENCES contracts(id),
  legal_case_id UUID REFERENCES legal_cases(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  description TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE expense_seq START 1;

CREATE TABLE expense_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESTAURANT OPERATIONS
-- ============================================================

CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_no VARCHAR(30) UNIQUE NOT NULL,
  sale_date DATE NOT NULL,
  shift VARCHAR(20) DEFAULT 'full_day' CHECK (shift IN ('breakfast', 'lunch', 'dinner', 'full_day')),
  dine_in_orders INTEGER DEFAULT 0,
  takeaway_orders INTEGER DEFAULT 0,
  delivery_orders INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  gross_sales DECIMAL(12,3) NOT NULL DEFAULT 0,
  discounts DECIMAL(12,3) DEFAULT 0,
  refunds DECIMAL(12,3) DEFAULT 0,
  net_sales DECIMAL(12,3) NOT NULL DEFAULT 0,
  cash_sales DECIMAL(12,3) DEFAULT 0,
  card_sales DECIMAL(12,3) DEFAULT 0,
  online_sales DECIMAL(12,3) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE petty_cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_no VARCHAR(30) UNIQUE NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('expense', 'replenishment', 'adjustment_add', 'adjustment_less')),
  category VARCHAR(120),
  amount DECIMAL(12,3) NOT NULL,
  payment_mode_id UUID REFERENCES payment_modes(id),
  description TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE internal_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_no VARCHAR(30) UNIQUE NOT NULL,
  transfer_date DATE NOT NULL,
  from_branch VARCHAR(200) NOT NULL,
  to_branch VARCHAR(200) NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'pcs',
  transfer_value DECIMAL(12,3) DEFAULT 0,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received', 'cancelled')),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE daily_sales_seq START 1;
CREATE SEQUENCE petty_cash_seq START 1;
CREATE SEQUENCE internal_transfer_seq START 1;

-- ============================================================
-- RECEIPT VOUCHERS
-- ============================================================

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_no VARCHAR(30) UNIQUE NOT NULL,
  receipt_date DATE NOT NULL,
  receipt_type VARCHAR(30) NOT NULL CHECK (receipt_type IN ('file_opening', 'installment', 'court_money', 'other')),
  amount DECIMAL(12,3) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  contract_id UUID REFERENCES contracts(id),
  installment_id UUID REFERENCES installments(id),
  legal_case_id UUID REFERENCES legal_cases(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE receipt_seq START 1;

CREATE TABLE receipt_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HRD - EMPLOYEES
-- ============================================================

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO departments (name, name_ar) VALUES
  ('Sales', 'المبيعات'),
  ('Finance', 'المالية'),
  ('Admin', 'الإدارة'),
  ('Warehouse', 'المستودع'),
  ('Legal', 'القانوني'),
  ('IT', 'تقنية المعلومات');

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_no VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  full_name_ar VARCHAR(200),
  nationality VARCHAR(100),
  civil_id VARCHAR(12),
  civil_id_expiry DATE,
  passport_no VARCHAR(50),
  passport_expiry DATE,
  mobile VARCHAR(20),
  email VARCHAR(200),
  date_of_birth DATE,
  gender VARCHAR(10) CHECK (gender IN ('Male', 'Female')),
  marital_status VARCHAR(20) CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed')),
  department_id UUID REFERENCES departments(id),
  designation VARCHAR(200),
  employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  join_date DATE NOT NULL,
  contract_end_date DATE,
  basic_salary DECIMAL(12,3) DEFAULT 0,
  housing_allowance DECIMAL(12,3) DEFAULT 0,
  transport_allowance DECIMAL(12,3) DEFAULT 0,
  other_allowance DECIMAL(12,3) DEFAULT 0,
  bank_name VARCHAR(200),
  iban VARCHAR(100),
  residency_no VARCHAR(50),
  residency_expiry DATE,
  work_permit_no VARCHAR(50),
  work_permit_expiry DATE,
  health_card_no VARCHAR(50),
  health_card_expiry DATE,
  emergency_contact_name VARCHAR(200),
  emergency_contact_mobile VARCHAR(20),
  emergency_contact_relation VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'leave')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE employee_seq START 1;

CREATE TABLE employee_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  attachment_type VARCHAR(50) CHECK (attachment_type IN ('civil_id','passport','contract','health_card','work_permit','photo','other')),
  uploaded_by UUID REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  hours_worked DECIMAL(4,2),
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'holiday', 'leave')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

-- ============================================================
-- PAYROLL
-- ============================================================

CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_month DATE NOT NULL,
  basic_salary DECIMAL(12,3) NOT NULL,
  housing_allowance DECIMAL(12,3) DEFAULT 0,
  transport_allowance DECIMAL(12,3) DEFAULT 0,
  other_allowance DECIMAL(12,3) DEFAULT 0,
  gross_salary DECIMAL(12,3) NOT NULL,
  deductions DECIMAL(12,3) DEFAULT 0,
  deduction_reason TEXT,
  net_salary DECIMAL(12,3) NOT NULL,
  payment_date DATE,
  payment_mode_id UUID REFERENCES payment_modes(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, payroll_month)
);

-- ============================================================
-- LEAVE MANAGEMENT
-- ============================================================

CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  days_per_year INTEGER,
  is_paid BOOLEAN DEFAULT TRUE
);

INSERT INTO leave_types (name, name_ar, days_per_year, is_paid) VALUES
  ('Annual Leave', 'إجازة سنوية', 30, TRUE),
  ('Sick Leave', 'إجازة مرضية', 15, TRUE),
  ('Emergency Leave', 'إجازة طارئة', 5, TRUE),
  ('Unpaid Leave', 'إجازة بدون راتب', NULL, FALSE),
  ('Maternity Leave', 'إجازة أمومة', 70, TRUE),
  ('Paternity Leave', 'إجازة أبوة', 3, TRUE);

CREATE TABLE leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PARTNERS / ACCOUNTING
-- ============================================================

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200),
  contribution DECIMAL(12,3) DEFAULT 0,
  share_percentage DECIMAL(5,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partner_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) CHECK (transaction_type IN ('contribution', 'withdrawal', 'profit_share')),
  amount DECIMAL(12,3) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VIEWS FOR REPORTING
-- ============================================================

CREATE VIEW v_contract_summary AS
SELECT
  c.id,
  c.contract_no,
  cu.full_name AS customer_name,
  cu.customer_no,
  cat.name AS category,
  c.sale_price,
  c.duration_months,
  c.installment_value,
  c.status,
  c.start_date,
  COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.paid_amount ELSE 0 END), 0) AS total_paid,
  c.sale_price - COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.paid_amount ELSE 0 END), 0) AS remaining_amount
FROM contracts c
JOIN customers cu ON c.customer_id = cu.id
LEFT JOIN categories cat ON c.category_id = cat.id
LEFT JOIN installments i ON i.contract_id = c.id
GROUP BY c.id, cu.full_name, cu.customer_no, cat.name;

CREATE VIEW v_monthly_report AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  'sales' AS type,
  SUM(sale_price) AS amount
FROM contracts
GROUP BY DATE_TRUNC('month', created_at)
UNION ALL
SELECT
  DATE_TRUNC('month', purchase_date) AS month,
  'purchase' AS type,
  SUM(purchase_price) AS amount
FROM purchases
GROUP BY DATE_TRUNC('month', purchase_date)
UNION ALL
SELECT
  DATE_TRUNC('month', expense_date) AS month,
  'expense' AS type,
  SUM(amount) AS amount
FROM expenses
GROUP BY DATE_TRUNC('month', expense_date);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "authenticated_read" ON customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read" ON contracts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read" ON purchases FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read" ON expenses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read" ON employees FOR SELECT TO authenticated USING (TRUE);

-- Only owner/admin can insert/update/delete
CREATE POLICY "admin_write" ON customers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "admin_write" ON contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- Payroll: owner only
CREATE POLICY "owner_only" ON payroll FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner'));

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-generate installment schedule when contract is created
CREATE OR REPLACE FUNCTION generate_installments()
RETURNS TRIGGER AS $$
DECLARE
  i INTEGER;
  due DATE;
BEGIN
  -- Delete existing installments if any
  DELETE FROM installments WHERE contract_id = NEW.id;

  -- Generate new installments
  FOR i IN 1..NEW.duration_months LOOP
    due := NEW.first_installment_date + ((i - 1) * INTERVAL '1 month');
    INSERT INTO installments (contract_id, installment_no, due_date, amount)
    VALUES (NEW.id, i, due, NEW.installment_value);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_installments
AFTER INSERT OR UPDATE OF duration_months, first_installment_date, installment_value
ON contracts
FOR EACH ROW EXECUTE FUNCTION generate_installments();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-number sequences
CREATE OR REPLACE FUNCTION next_customer_no() RETURNS TEXT AS $$
  SELECT 'C-' || LPAD(nextval('customer_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_contract_no() RETURNS TEXT AS $$
  SELECT 'CON-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('contract_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_employee_no() RETURNS TEXT AS $$
  SELECT 'EMP-' || LPAD(nextval('employee_seq')::TEXT, 3, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_expense_no() RETURNS TEXT AS $$
  SELECT 'EXP-' || LPAD(nextval('expense_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_daily_sale_no() RETURNS TEXT AS $$
  SELECT 'DS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('daily_sales_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_petty_cash_no() RETURNS TEXT AS $$
  SELECT 'PC-' || LPAD(nextval('petty_cash_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_internal_transfer_no() RETURNS TEXT AS $$
  SELECT 'TR-' || LPAD(nextval('internal_transfer_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_receipt_no() RETURNS TEXT AS $$
  SELECT 'RCV-' || LPAD(nextval('receipt_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION next_legal_no() RETURNS TEXT AS $$
  SELECT 'LC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('legal_seq')::TEXT, 3, '0');
$$ LANGUAGE sql;

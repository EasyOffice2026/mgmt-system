-- Migration: Add missing columns for v2 frontend
-- Run this in Supabase SQL Editor

-- Add missing columns to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS item_name TEXT DEFAULT '';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS model_type TEXT DEFAULT '';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(12,3) DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS installment_schedule JSONB DEFAULT '[]'::jsonb;

-- Copy data from old installments column to new installment_schedule column if it exists
UPDATE contracts SET installment_schedule = installments WHERE installments IS NOT NULL AND installments != '[]'::jsonb;

-- Add missing columns to legal_cases table
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(12,3) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS claimed_amount NUMERIC(12,3) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,3) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS case_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS court_fees NUMERIC(12,3) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS court_schedule JSONB DEFAULT '[]'::jsonb;

-- Add missing columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS related_case_no TEXT DEFAULT '';

-- ============================================
-- Now seed dummy data
-- ============================================

-- Clear existing data (in correct order due to foreign keys)
DELETE FROM receipt_vouchers;
DELETE FROM expenses;
DELETE FROM legal_cases;
DELETE FROM contracts;
DELETE FROM purchases;
DELETE FROM customers;
DELETE FROM partners;

-- Reset sequences by deleting all and re-inserting

-- Insert customers
INSERT INTO customers (name, civil_id, mobile, passport_no, email, area_name, block_no, street_no, house_no) VALUES
  ('Ahmed Al-Rashidi', '298501234567', '97654321', 'P1234567', 'ahmed@email.com', 'Salmiya', '3', '12', '45'),
  ('Mohammed Hassan', '298512345678', '96543210', 'P2345678', 'mohammed@email.com', 'Hawalli', '5', '8', '22'),
  ('Fatima Al-Sabah', '298523456789', '95432109', 'P3456789', 'fatima@email.com', 'Kuwait City', '1', '3', '10'),
  ('Khalid Al-Mutairi', '298534567890', '94321098', 'P4567890', 'khalid@email.com', 'Jabriya', '2', '15', '33'),
  ('Sara Al-Kandari', '298545678901', '93210987', 'P5678901', 'sara@email.com', 'Mishref', '4', '7', '18'),
  ('Omar Al-Enezi', '298556789012', '92109876', 'P6789012', 'omar@email.com', 'Fahaheel', '6', '20', '55'),
  ('Noura Al-Azmi', '298567890123', '91098765', 'P7890123', 'noura@email.com', 'Mangaf', '8', '11', '27'),
  ('Yousef Al-Shammari', '298578901234', '90987654', 'P8901234', 'yousef@email.com', 'Farwaniya', '7', '9', '41');

-- Insert purchases
INSERT INTO purchases (purchase_date, supplier_name, invoice_no, shop_location, category, item_name, model_type, purchase_price, payment_mode, status) VALUES
  ('2025-01-15', 'Mobile World', 'INV-1001', 'Salmiya Mall', 'Mobile', 'iPhone 16 Pro Max', '256GB Gold', 450.000, 'cash', 'sold'),
  ('2025-01-20', 'Mobile World', 'INV-1002', 'Salmiya Mall', 'Mobile', 'Samsung Galaxy S25', '512GB Black', 380.000, 'bank_transfer', 'sold'),
  ('2025-02-01', 'Auto Gallery', 'INV-2001', 'Shuwaikh Industrial', 'Car', 'Toyota Camry 2025', 'GLE Full Option', 8500.000, 'bank_transfer', 'sold'),
  ('2025-02-10', 'Auto Gallery', 'INV-2002', 'Shuwaikh Industrial', 'Car', 'Nissan Patrol 2025', 'Platinum V8', 15000.000, 'bank_transfer', 'in_stock'),
  ('2025-03-01', 'Home Center', 'INV-3001', 'Avenues Mall', 'Furniture', 'Italian Sofa Set', 'L-Shape Brown', 1200.000, 'cash', 'sold'),
  ('2025-03-15', 'Mobile World', 'INV-1003', 'Salmiya Mall', 'Mobile', 'iPhone 16', '128GB Blue', 350.000, 'cash', 'in_stock'),
  ('2025-04-01', 'Tech Store', 'INV-4001', 'Marina Mall', 'Electronics', 'MacBook Pro M4', '16inch 512GB', 800.000, 'bank_transfer', 'sold'),
  ('2025-04-10', 'Home Center', 'INV-3002', 'Avenues Mall', 'Furniture', 'Dining Table Set', '8 Chairs Oak', 650.000, 'cash', 'in_stock'),
  ('2025-05-01', 'Mobile World', 'INV-1004', 'Salmiya Mall', 'Mobile', 'Samsung Galaxy Z Fold', '256GB', 520.000, 'cash', 'in_stock'),
  ('2025-05-15', 'Auto Gallery', 'INV-2003', 'Shuwaikh Industrial', 'Car', 'Kia Sportage 2025', 'GT-Line AWD', 9200.000, 'bank_transfer', 'in_stock');

-- Get customer IDs and purchase IDs for contracts
DO $$
DECLARE
  cust1_id UUID; cust2_id UUID; cust3_id UUID; cust4_id UUID; cust5_id UUID;
  pur1_id UUID; pur2_id UUID; pur3_id UUID; pur5_id UUID; pur7_id UUID;
  con1_id UUID; con2_id UUID; con3_id UUID; con4_id UUID; con5_id UUID;
BEGIN
  SELECT id INTO cust1_id FROM customers WHERE civil_id = '298501234567';
  SELECT id INTO cust2_id FROM customers WHERE civil_id = '298512345678';
  SELECT id INTO cust3_id FROM customers WHERE civil_id = '298523456789';
  SELECT id INTO cust4_id FROM customers WHERE civil_id = '298534567890';
  SELECT id INTO cust5_id FROM customers WHERE civil_id = '298545678901';
  SELECT id INTO pur1_id FROM purchases WHERE invoice_no = 'INV-1001';
  SELECT id INTO pur2_id FROM purchases WHERE invoice_no = 'INV-1002';
  SELECT id INTO pur3_id FROM purchases WHERE invoice_no = 'INV-2001';
  SELECT id INTO pur5_id FROM purchases WHERE invoice_no = 'INV-3001';
  SELECT id INTO pur7_id FROM purchases WHERE invoice_no = 'INV-4001';

  -- Contract 1: Ahmed - iPhone 16 Pro Max (12 months, 3 paid)
  INSERT INTO contracts (customer_id, customer_name, category, item_name, model_type, items, purchase_price, sale_price, file_opening_charges, client_type, duration_months, start_date, first_installment_date, last_installment_date, end_date, installment_amount, paid_amount, remaining_amount, payment_mode, status, installment_schedule)
  VALUES (cust1_id, 'Ahmed Al-Rashidi', 'Mobile', 'iPhone 16 Pro Max', '256GB Gold',
    ('[{"purchase_id":"' || pur1_id || '","item_name":"iPhone 16 Pro Max","model_type":"256GB Gold","category":"Mobile","purchase_price":450,"sale_price":650}]')::jsonb,
    450.000, 650.000, 50.000, 'new', 12, '2025-01-20', '2025-02-20', '2026-01-20', '2026-01-20', 50.000, 150.000, 500.000, 'cash', 'ongoing',
    ('[' ||
      '{"month":1,"due_date":"2025-02-20","amount":50,"status":"paid","paid_date":"2025-02-20"},' ||
      '{"month":2,"due_date":"2025-03-20","amount":50,"status":"paid","paid_date":"2025-03-18"},' ||
      '{"month":3,"due_date":"2025-04-20","amount":50,"status":"paid","paid_date":"2025-04-20"},' ||
      '{"month":4,"due_date":"2025-05-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":5,"due_date":"2025-06-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":6,"due_date":"2025-07-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":7,"due_date":"2025-08-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":8,"due_date":"2025-09-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":9,"due_date":"2025-10-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":10,"due_date":"2025-11-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":11,"due_date":"2025-12-20","amount":50,"status":"pending","paid_date":null},' ||
      '{"month":12,"due_date":"2026-01-20","amount":50,"status":"pending","paid_date":null}' ||
    ']')::jsonb
  ) RETURNING id INTO con1_id;

  -- Contract 2: Mohammed - Samsung Galaxy S25 (6 months, 5 paid)
  INSERT INTO contracts (customer_id, customer_name, category, item_name, model_type, items, purchase_price, sale_price, file_opening_charges, client_type, duration_months, start_date, first_installment_date, last_installment_date, end_date, installment_amount, paid_amount, remaining_amount, payment_mode, status, installment_schedule)
  VALUES (cust2_id, 'Mohammed Hassan', 'Mobile', 'Samsung Galaxy S25', '512GB Black',
    ('[{"purchase_id":"' || pur2_id || '","item_name":"Samsung Galaxy S25","model_type":"512GB Black","category":"Mobile","purchase_price":380,"sale_price":520}]')::jsonb,
    380.000, 520.000, 30.000, 'new', 6, '2025-02-01', '2025-03-01', '2025-08-01', '2025-08-01', 81.667, 408.335, 111.665, 'bank_transfer', 'ongoing',
    ('[' ||
      '{"month":1,"due_date":"2025-03-01","amount":81.667,"status":"paid","paid_date":"2025-03-01"},' ||
      '{"month":2,"due_date":"2025-04-01","amount":81.667,"status":"paid","paid_date":"2025-04-02"},' ||
      '{"month":3,"due_date":"2025-05-01","amount":81.667,"status":"paid","paid_date":"2025-05-01"},' ||
      '{"month":4,"due_date":"2025-06-01","amount":81.667,"status":"paid","paid_date":"2025-06-01"},' ||
      '{"month":5,"due_date":"2025-07-01","amount":81.667,"status":"paid","paid_date":"2025-07-03"},' ||
      '{"month":6,"due_date":"2025-08-01","amount":81.665,"status":"pending","paid_date":null}' ||
    ']')::jsonb
  ) RETURNING id INTO con2_id;

  -- Contract 3: Fatima - Toyota Camry (24 months, 6 paid)
  INSERT INTO contracts (customer_id, customer_name, category, item_name, model_type, items, purchase_price, sale_price, file_opening_charges, client_type, duration_months, start_date, first_installment_date, last_installment_date, end_date, installment_amount, paid_amount, remaining_amount, payment_mode, status, installment_schedule)
  VALUES (cust3_id, 'Fatima Al-Sabah', 'Car', 'Toyota Camry 2025', 'GLE Full Option',
    ('[{"purchase_id":"' || pur3_id || '","item_name":"Toyota Camry 2025","model_type":"GLE Full Option","category":"Car","purchase_price":8500,"sale_price":11500}]')::jsonb,
    8500.000, 11500.000, 200.000, 'new', 24, '2025-02-15', '2025-03-15', '2027-02-15', '2027-02-15', 470.833, 2825.000, 8675.000, 'bank_transfer', 'ongoing',
    ('[' ||
      '{"month":1,"due_date":"2025-03-15","amount":470.833,"status":"paid","paid_date":"2025-03-15"},' ||
      '{"month":2,"due_date":"2025-04-15","amount":470.833,"status":"paid","paid_date":"2025-04-14"},' ||
      '{"month":3,"due_date":"2025-05-15","amount":470.833,"status":"paid","paid_date":"2025-05-15"},' ||
      '{"month":4,"due_date":"2025-06-15","amount":470.833,"status":"paid","paid_date":"2025-06-16"},' ||
      '{"month":5,"due_date":"2025-07-15","amount":470.833,"status":"paid","paid_date":"2025-07-15"},' ||
      '{"month":6,"due_date":"2025-08-15","amount":470.833,"status":"paid","paid_date":"2025-08-15"},' ||
      '{"month":7,"due_date":"2025-09-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":8,"due_date":"2025-10-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":9,"due_date":"2025-11-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":10,"due_date":"2025-12-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":11,"due_date":"2026-01-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":12,"due_date":"2026-02-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":13,"due_date":"2026-03-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":14,"due_date":"2026-04-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":15,"due_date":"2026-05-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":16,"due_date":"2026-06-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":17,"due_date":"2026-07-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":18,"due_date":"2026-08-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":19,"due_date":"2026-09-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":20,"due_date":"2026-10-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":21,"due_date":"2026-11-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":22,"due_date":"2026-12-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":23,"due_date":"2027-01-15","amount":470.833,"status":"pending","paid_date":null},' ||
      '{"month":24,"due_date":"2027-02-15","amount":470.837,"status":"pending","paid_date":null}' ||
    ']')::jsonb
  ) RETURNING id INTO con3_id;

  -- Contract 4: Khalid - Italian Sofa (12 months, all paid - finished)
  INSERT INTO contracts (customer_id, customer_name, category, item_name, model_type, items, purchase_price, sale_price, file_opening_charges, client_type, duration_months, start_date, first_installment_date, last_installment_date, end_date, installment_amount, paid_amount, remaining_amount, payment_mode, status, installment_schedule)
  VALUES (cust4_id, 'Khalid Al-Mutairi', 'Furniture', 'Italian Sofa Set', 'L-Shape Brown',
    ('[{"purchase_id":"' || pur5_id || '","item_name":"Italian Sofa Set","model_type":"L-Shape Brown","category":"Furniture","purchase_price":1200,"sale_price":1800}]')::jsonb,
    1200.000, 1800.000, 100.000, 'existing', 12, '2025-01-10', '2025-02-10', '2026-01-10', '2026-01-10', 141.667, 1800.000, 0.000, 'cash', 'finished',
    ('[' ||
      '{"month":1,"due_date":"2025-02-10","amount":141.667,"status":"paid","paid_date":"2025-02-10"},' ||
      '{"month":2,"due_date":"2025-03-10","amount":141.667,"status":"paid","paid_date":"2025-03-10"},' ||
      '{"month":3,"due_date":"2025-04-10","amount":141.667,"status":"paid","paid_date":"2025-04-09"},' ||
      '{"month":4,"due_date":"2025-05-10","amount":141.667,"status":"paid","paid_date":"2025-05-10"},' ||
      '{"month":5,"due_date":"2025-06-10","amount":141.667,"status":"paid","paid_date":"2025-06-10"},' ||
      '{"month":6,"due_date":"2025-07-10","amount":141.667,"status":"paid","paid_date":"2025-07-12"},' ||
      '{"month":7,"due_date":"2025-08-10","amount":141.667,"status":"paid","paid_date":"2025-08-10"},' ||
      '{"month":8,"due_date":"2025-09-10","amount":141.667,"status":"paid","paid_date":"2025-09-10"},' ||
      '{"month":9,"due_date":"2025-10-10","amount":141.667,"status":"paid","paid_date":"2025-10-10"},' ||
      '{"month":10,"due_date":"2025-11-10","amount":141.667,"status":"paid","paid_date":"2025-11-10"},' ||
      '{"month":11,"due_date":"2025-12-10","amount":141.667,"status":"paid","paid_date":"2025-12-10"},' ||
      '{"month":12,"due_date":"2026-01-10","amount":141.663,"status":"paid","paid_date":"2026-01-10"}' ||
    ']')::jsonb
  ) RETURNING id INTO con4_id;

  -- Contract 5: Sara - MacBook Pro (6 months, 2 paid, converted to legal case)
  INSERT INTO contracts (customer_id, customer_name, category, item_name, model_type, items, purchase_price, sale_price, file_opening_charges, client_type, duration_months, start_date, first_installment_date, last_installment_date, end_date, installment_amount, paid_amount, remaining_amount, payment_mode, status, installment_schedule)
  VALUES (cust5_id, 'Sara Al-Kandari', 'Electronics', 'MacBook Pro M4', '16inch 512GB',
    ('[{"purchase_id":"' || pur7_id || '","item_name":"MacBook Pro M4","model_type":"16inch 512GB","category":"Electronics","purchase_price":800,"sale_price":1100}]')::jsonb,
    800.000, 1100.000, 50.000, 'new', 6, '2025-04-15', '2025-05-15', '2025-10-15', '2025-10-15', 175.000, 350.000, 750.000, 'link', 'legal_case',
    ('[' ||
      '{"month":1,"due_date":"2025-05-15","amount":175,"status":"paid","paid_date":"2025-05-15"},' ||
      '{"month":2,"due_date":"2025-06-15","amount":175,"status":"paid","paid_date":"2025-06-17"},' ||
      '{"month":3,"due_date":"2025-07-15","amount":175,"status":"pending","paid_date":null},' ||
      '{"month":4,"due_date":"2025-08-15","amount":175,"status":"pending","paid_date":null},' ||
      '{"month":5,"due_date":"2025-09-15","amount":175,"status":"pending","paid_date":null},' ||
      '{"month":6,"due_date":"2025-10-15","amount":175,"status":"pending","paid_date":null}' ||
    ']')::jsonb
  ) RETURNING id INTO con5_id;

  -- Legal Case for Sara's contract
  INSERT INTO legal_cases (customer_id, customer_name, contract_id, contract_no, case_no, purchase_price, original_amount, actual_amount, claimed_amount, remaining_from_customer, case_amount, rcvd_from_customer, rcvd_from_court, balance_amount, case_date, court_schedule)
  SELECT cust5_id, 'Sara Al-Kandari', con5_id, contract_no, 'CASE-2025-001', 800.000, 1100.000, 750.000, 900.000, 750.000, 900.000, 350.000, 100.000, 450.000, '2025-08-01',
    '[{"date":"2025-09-01","amount_due":150,"amount_rcvd":100,"balance":50},{"date":"2025-10-01","amount_due":150,"amount_rcvd":0,"balance":150},{"date":"2025-11-01","amount_due":150,"amount_rcvd":0,"balance":150}]'::jsonb
  FROM contracts WHERE id = con5_id;

  -- Expenses
  INSERT INTO expenses (expense_date, expense_type, amount, description, customer_id, customer_name, contract_id, contract_no, related_case_no) VALUES
    ('2025-01-01', 'rent', 500.000, 'Office rent January', NULL, '', NULL, '', ''),
    ('2025-02-01', 'rent', 500.000, 'Office rent February', NULL, '', NULL, '', ''),
    ('2025-03-01', 'rent', 500.000, 'Office rent March', NULL, '', NULL, '', ''),
    ('2025-01-25', 'salaries', 1200.000, 'Staff salaries January', NULL, '', NULL, '', ''),
    ('2025-02-25', 'salaries', 1200.000, 'Staff salaries February', NULL, '', NULL, '', ''),
    ('2025-03-25', 'salaries', 1200.000, 'Staff salaries March', NULL, '', NULL, '', '');

  INSERT INTO expenses (expense_date, expense_type, amount, description, customer_id, customer_name, contract_id, contract_no, related_case_no)
  SELECT '2025-08-15', 'court_fees', 150.000, 'Court filing fees', cust5_id, 'Sara Al-Kandari', con5_id, c.contract_no, 'CASE-2025-001'
  FROM contracts c WHERE c.id = con5_id;

  INSERT INTO expenses (expense_date, expense_type, amount, description, customer_id, customer_name, contract_id, contract_no, related_case_no)
  SELECT '2025-08-20', 'lawyer_fees', 300.000, 'Lawyer retainer fee', cust5_id, 'Sara Al-Kandari', con5_id, c.contract_no, 'CASE-2025-001'
  FROM contracts c WHERE c.id = con5_id;

  INSERT INTO expenses (expense_date, expense_type, amount, description) VALUES
    ('2025-04-01', 'utilities', 85.000, 'Electricity bill April'),
    ('2025-05-01', 'utilities', 92.000, 'Electricity bill May'),
    ('2025-04-15', 'office', 120.000, 'Printer and stationery');

  -- Receipt Vouchers
  INSERT INTO receipt_vouchers (receipt_date, receipt_type, customer_id, customer_name, contract_id, contract_no, received_amount, payment_mode, notes)
  SELECT '2025-01-20', 'file_opening', cust1_id, 'Ahmed Al-Rashidi', con1_id, c.contract_no, 50.000, 'cash', 'File opening charges'
  FROM contracts c WHERE c.id = con1_id;

  INSERT INTO receipt_vouchers (receipt_date, receipt_type, customer_id, customer_name, contract_id, contract_no, received_amount, payment_mode, notes)
  SELECT '2025-02-20', 'installment', cust1_id, 'Ahmed Al-Rashidi', con1_id, c.contract_no, 50.000, 'cash', 'Installment 1'
  FROM contracts c WHERE c.id = con1_id;

  INSERT INTO receipt_vouchers (receipt_date, receipt_type, customer_id, customer_name, contract_id, contract_no, received_amount, payment_mode, notes)
  SELECT '2025-03-18', 'installment', cust1_id, 'Ahmed Al-Rashidi', con1_id, c.contract_no, 50.000, 'cash', 'Installment 2'
  FROM contracts c WHERE c.id = con1_id;

  INSERT INTO receipt_vouchers (receipt_date, receipt_type, customer_id, customer_name, contract_id, contract_no, received_amount, payment_mode, notes)
  SELECT '2025-04-20', 'installment', cust1_id, 'Ahmed Al-Rashidi', con1_id, c.contract_no, 50.000, 'cash', 'Installment 3'
  FROM contracts c WHERE c.id = con1_id;

  INSERT INTO receipt_vouchers (receipt_date, receipt_type, customer_id, customer_name, contract_id, contract_no, received_amount, payment_mode, notes)
  SELECT '2025-02-01', 'file_opening', cust3_id, 'Fatima Al-Sabah', con3_id, c.contract_no, 200.000, 'bank_transfer', 'File opening charges'
  FROM contracts c WHERE c.id = con3_id;

  INSERT INTO receipt_vouchers (receipt_date, receipt_type, customer_id, customer_name, contract_id, contract_no, court_case_no, received_amount, payment_mode, notes)
  SELECT '2025-09-01', 'court_money', cust5_id, 'Sara Al-Kandari', con5_id, c.contract_no, 'CASE-2025-001', 100.000, 'bank_transfer', 'Court payment received'
  FROM contracts c WHERE c.id = con5_id;

  -- Partners
  INSERT INTO partners (partner_name, contribution, amount_received, share_percentage) VALUES
    ('Abdullah Al-Rashidi', 50000.000, 8000.000, 40.00),
    ('Mansour Al-Otaibi', 30000.000, 5000.000, 25.00),
    ('Fahad Al-Dosari', 25000.000, 4000.000, 20.00),
    ('Nasser Al-Hajri', 20000.000, 3000.000, 15.00);

END;
$$;

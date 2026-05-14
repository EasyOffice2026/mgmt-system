-- Migration V6: Add quantity fields to purchases + update contracts status constraint
-- Run this in Supabase SQL Editor
-- This migration is REQUIRED for the following features:
--   1. Quantity tracking in purchases/inventory
--   2. "Legal Cases Closed" (case_closed) status option in contracts

-- ============================================
-- 1. Add quantity columns to purchases table
-- ============================================
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT 1;

-- Set quantity_available = quantity for existing rows
UPDATE purchases SET quantity_available = quantity WHERE quantity_available IS NULL OR quantity_available = 1;

-- ============================================
-- 2. Update contracts status CHECK constraint
-- ============================================
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('ongoing', 'finished', 'legal_case', 'case_closed'));

-- ============================================
-- 3. Create storage buckets for attachments
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-docs', 'customer-docs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('purchases', 'purchases', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('expenses', 'expenses', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('legal', 'legal', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read from all buckets
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated reads" ON storage.objects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Allow public reads" ON storage.objects
  FOR SELECT TO anon USING (true);

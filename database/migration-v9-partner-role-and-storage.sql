-- Migration V9: Add partner role and create storage buckets
-- Run this in Supabase SQL Editor

-- 1. Update user_profiles role CHECK constraint to include 'partner'
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superadmin', 'owner', 'salesman', 'accountant', 'partner'));

-- 2. Create storage buckets for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-docs', 'customer-docs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('expenses', 'expenses', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('legal', 'legal', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('purchases', 'purchases', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for authenticated users (all operations)
DROP POLICY IF EXISTS "Allow all operations for authenticated" ON storage.objects;
CREATE POLICY "Allow all operations for authenticated" ON storage.objects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Allow public read access for viewing attachments
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
CREATE POLICY "Allow public reads" ON storage.objects
  FOR SELECT TO anon USING (true);

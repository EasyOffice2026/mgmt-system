-- Migration V7: Fix storage policies for attachments
-- Run this in Supabase SQL Editor
-- The previous migration (V6) only added INSERT and SELECT policies.
-- Supabase storage also needs UPDATE and DELETE policies to work properly.

-- Drop old narrow policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- Create a single comprehensive policy for authenticated users (all operations)
DROP POLICY IF EXISTS "Allow all operations for authenticated" ON storage.objects;
CREATE POLICY "Allow all operations for authenticated" ON storage.objects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow public read access for viewing attachments
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
CREATE POLICY "Allow public reads" ON storage.objects
  FOR SELECT TO anon USING (true);

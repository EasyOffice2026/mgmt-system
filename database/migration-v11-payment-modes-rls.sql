-- Migration V11: Fix payment_modes RLS policies + seed default data
-- Enable RLS and add policies for payment_modes table

ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read payment modes
CREATE POLICY "authenticated_read" ON payment_modes FOR SELECT TO authenticated USING (TRUE);

-- Allow all authenticated users to insert/update/delete payment modes
CREATE POLICY "authenticated_write" ON payment_modes FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated_update" ON payment_modes FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "authenticated_delete" ON payment_modes FOR DELETE TO authenticated USING (TRUE);

-- Add UNIQUE constraint on name if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_modes_name_key') THEN
    ALTER TABLE payment_modes ADD CONSTRAINT payment_modes_name_key UNIQUE (name);
  END IF;
END $$;

-- Seed default payment modes if table is empty
INSERT INTO payment_modes (name, name_ar) VALUES
  ('cash', 'نقدي'),
  ('bank_transfer', 'تحويل بنكي'),
  ('link', 'رابط'),
  ('wamd', 'وامد')
ON CONFLICT (name) DO NOTHING;

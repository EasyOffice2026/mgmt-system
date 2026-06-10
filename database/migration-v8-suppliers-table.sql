-- Migration V8: Create suppliers table for supplier management

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
DROP POLICY IF EXISTS "Allow authenticated full access" ON suppliers;
CREATE POLICY "Allow authenticated full access" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

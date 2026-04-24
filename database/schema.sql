-- ============================================================
-- RESTAURANT MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Platform: Supabase (PostgreSQL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOOKUPS / SETTINGS
-- ============================================================

CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO menu_categories (name) VALUES
  ('Appetizer'),
  ('Main Course'),
  ('Dessert'),
  ('Beverage');

CREATE TABLE course_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO course_types (name) VALUES
  ('Starter'),
  ('Main'),
  ('Dessert'),
  ('Drink');

CREATE TABLE table_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO table_zones (name) VALUES
  ('Indoor'),
  ('Outdoor'),
  ('VIP');

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO payment_methods (name) VALUES
  ('Cash'),
  ('Card'),
  ('Online');

-- ============================================================
-- GUESTS
-- ============================================================

CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_no VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(200),
  loyalty_tier VARCHAR(20) DEFAULT 'regular' CHECK (loyalty_tier IN ('regular', 'silver', 'gold', 'vip')),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vip')),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE guest_seq START 1;

CREATE OR REPLACE FUNCTION next_guest_no() RETURNS TEXT AS $$
  SELECT 'GST-' || LPAD(nextval('guest_seq')::TEXT, 5, '0');
$$ LANGUAGE sql;

-- ============================================================
-- MENU
-- ============================================================

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(12,3) NOT NULL CHECK (price >= 0),
  prep_time_minutes INTEGER CHECK (prep_time_minutes >= 0),
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLES / FLOOR
-- ============================================================

CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_no VARCHAR(20) UNIQUE NOT NULL,
  table_name VARCHAR(100),
  section_name VARCHAR(100),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no VARCHAR(30) UNIQUE NOT NULL,
  guest_id UUID REFERENCES guests(id),
  table_id UUID REFERENCES restaurant_tables(id),
  order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  status VARCHAR(20) NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'preparing', 'ready', 'served', 'paid', 'completed', 'cancelled')),
  subtotal DECIMAL(12,3) DEFAULT 0,
  service_charge DECIMAL(12,3) DEFAULT 0,
  tax_amount DECIMAL(12,3) DEFAULT 0,
  total_amount DECIMAL(12,3) NOT NULL DEFAULT 0,
  ordered_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE order_seq START 1;

CREATE OR REPLACE FUNCTION next_order_no() RETURNS TEXT AS $$
  SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('order_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,3) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(12,3) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESERVATIONS
-- ============================================================

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id UUID REFERENCES guests(id),
  table_id UUID REFERENCES restaurant_tables(id),
  reservation_time TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status VARCHAR(20) DEFAULT 'booked' CHECK (status IN ('booked', 'seated', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KITCHEN
-- ============================================================

CREATE TABLE kitchen_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_no VARCHAR(30) UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id),
  table_id UUID REFERENCES restaurant_tables(id),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'ready', 'served')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE ticket_seq START 1;

CREATE OR REPLACE FUNCTION next_ticket_no() RETURNS TEXT AS $$
  SELECT 'KOT-' || LPAD(nextval('ticket_seq')::TEXT, 5, '0');
$$ LANGUAGE sql;

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name VARCHAR(200) NOT NULL,
  item_category VARCHAR(100),
  unit VARCHAR(30) NOT NULL,
  current_stock DECIMAL(12,3) DEFAULT 0 CHECK (current_stock >= 0),
  reorder_level DECIMAL(12,3) DEFAULT 0 CHECK (reorder_level >= 0),
  cost_per_unit DECIMAL(12,3) DEFAULT 0 CHECK (cost_per_unit >= 0),
  supplier_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAFF
-- ============================================================

CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'waiter' CHECK (role IN ('manager', 'chef', 'waiter', 'cashier', 'host')),
  phone VARCHAR(30),
  shift VARCHAR(20) DEFAULT 'morning' CHECK (shift IN ('morning', 'afternoon', 'evening', 'night')),
  hourly_rate DECIMAL(12,3) DEFAULT 0 CHECK (hourly_rate >= 0),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE staff_seq START 1;

CREATE OR REPLACE FUNCTION next_staff_code() RETURNS TEXT AS $$
  SELECT 'STF-' || LPAD(nextval('staff_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

-- ============================================================
-- REPORTING VIEWS
-- ============================================================

CREATE VIEW v_daily_sales AS
SELECT
  DATE(ordered_at) AS sales_date,
  COUNT(*) AS orders_count,
  SUM(total_amount) AS total_sales
FROM orders
WHERE status IN ('paid', 'completed')
GROUP BY DATE(ordered_at)
ORDER BY DATE(ordered_at) DESC;

CREATE VIEW v_low_stock AS
SELECT
  id,
  item_name,
  item_category,
  current_stock,
  reorder_level,
  unit
FROM inventory_items
WHERE current_stock <= reorder_level
ORDER BY item_name;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_guests" ON guests FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_menu_items" ON menu_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_tables" ON restaurant_tables FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_orders" ON orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_order_items" ON order_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_reservations" ON reservations FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_kitchen_tickets" ON kitchen_tickets FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_inventory_items" ON inventory_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated_read_staff_members" ON staff_members FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "admin_write_guests" ON guests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "admin_write_menu_items" ON menu_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "admin_write_tables" ON restaurant_tables FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "admin_write_orders" ON orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')));
CREATE POLICY "admin_write_order_items" ON order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')));
CREATE POLICY "admin_write_reservations" ON reservations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')));
CREATE POLICY "admin_write_kitchen_tickets" ON kitchen_tickets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')));
CREATE POLICY "admin_write_inventory" ON inventory_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "admin_write_staff" ON staff_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_restaurant_tables_updated BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_kitchen_tickets_updated BEFORE UPDATE ON kitchen_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_items_updated BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_members_updated BEFORE UPDATE ON staff_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

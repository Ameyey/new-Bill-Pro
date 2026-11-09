-- ============================================================
-- BillPro Supabase (PostgreSQL) Database Schema & Initial Data
-- 100% Compatible with Supabase SQL Editor
-- ============================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  login_allowed SMALLINT DEFAULT 1,
  password_plain VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL DEFAULT 'trial',
  trial_start TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  amount_paid NUMERIC(10,2) DEFAULT 0.00,
  payment_date TIMESTAMPTZ DEFAULT NULL,
  transaction_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  payment_method VARCHAR(100) DEFAULT 'UPI / Card',
  status VARCHAR(50) DEFAULT 'completed',
  payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- 4. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL DEFAULT 'My Business',
  tagline VARCHAR(255) DEFAULT NULL,
  works_address TEXT,
  address TEXT,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  state_code VARCHAR(10) DEFAULT NULL,
  pincode VARCHAR(20) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  website VARCHAR(255) DEFAULT NULL,
  gstin VARCHAR(50) DEFAULT NULL,
  pan VARCHAR(50) DEFAULT NULL,
  bank_name VARCHAR(255) DEFAULT NULL,
  bank_branch VARCHAR(255) DEFAULT NULL,
  account_no VARCHAR(100) DEFAULT NULL,
  ifsc_code VARCHAR(50) DEFAULT NULL,
  account_holder VARCHAR(255) DEFAULT NULL,
  invoice_prefix VARCHAR(50) DEFAULT 'INV-',
  next_invoice_no INT DEFAULT 1,
  default_gst_rate NUMERIC(5,2) DEFAULT 18.00,
  terms_conditions TEXT,
  footer_text TEXT,
  logo_url TEXT,
  signature_url TEXT,
  signature_title VARCHAR(100) DEFAULT 'Proprietor',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  address TEXT,
  city VARCHAR(100) DEFAULT NULL,
  state VARCHAR(100) DEFAULT NULL,
  state_code VARCHAR(10) DEFAULT NULL,
  pincode VARCHAR(20) DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- 6. Customer GST Numbers Table (Supports Multiple GSTs per Customer)
CREATE TABLE IF NOT EXISTS customer_gst_numbers (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  gst_number VARCHAR(50) NOT NULL,
  branch_name VARCHAR(255) DEFAULT NULL,
  state_name VARCHAR(100) DEFAULT NULL,
  is_default SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_gst_numbers_customer_id ON customer_gst_numbers(customer_id);

-- 7. Products Table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) DEFAULT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(50) DEFAULT 'Nos',
  gst_rate NUMERIC(5,2) DEFAULT 18.00,
  hsn_sac VARCHAR(50) DEFAULT NULL,
  stock_qty NUMERIC(12,2) DEFAULT 100.00,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);

-- 8. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_gst_id INT DEFAULT NULL,
  selected_gst_number VARCHAR(50) DEFAULT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE DEFAULT NULL,
  in_dc_no VARCHAR(100) DEFAULT NULL,
  in_dc_date DATE DEFAULT NULL,
  out_dc_no VARCHAR(100) DEFAULT NULL,
  out_dc_date DATE DEFAULT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_address TEXT,
  customer_phone VARCHAR(50) DEFAULT NULL,
  customer_email VARCHAR(255) DEFAULT NULL,
  customer_city VARCHAR(100) DEFAULT NULL,
  customer_state VARCHAR(100) DEFAULT NULL,
  customer_state_code VARCHAR(10) DEFAULT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_total NUMERIC(12,2) DEFAULT 0.00,
  taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cgst_amount NUMERIC(12,2) DEFAULT 0.00,
  sgst_amount NUMERIC(12,2) DEFAULT 0.00,
  igst_amount NUMERIC(12,2) DEFAULT 0.00,
  total_gst NUMERIC(12,2) DEFAULT 0.00,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  amount_in_words TEXT,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  payment_mode VARCHAR(100) DEFAULT NULL,
  notes TEXT,
  terms TEXT,
  image1_url TEXT,
  image2_url TEXT,
  column_preferences JSONB DEFAULT NULL,
  header_preferences JSONB DEFAULT NULL,
  custom_dc_values JSONB DEFAULT NULL,
  is_inter_state BOOLEAN DEFAULT FALSE,
  bill_gst_rate NUMERIC(5,2) DEFAULT 18.00,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- 9. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INT DEFAULT NULL,
  item_no INT DEFAULT 1,
  description TEXT NOT NULL,
  sq_ft NUMERIC(12,2) DEFAULT 0.00,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50) DEFAULT 'Nos',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(12,2) DEFAULT 0.00,
  taxable_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5,2) DEFAULT 18.00,
  gst_amount NUMERIC(12,2) DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  custom_fields JSONB DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- 10. Invoice Images Table
CREATE TABLE IF NOT EXISTS invoice_images (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id INT DEFAULT NULL,
  invoice_id_or_user_id INT DEFAULT NULL,
  image_slot INT DEFAULT 1,
  image_type VARCHAR(50) DEFAULT 'general',
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT DEFAULT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoice_images_user_id ON invoice_images(user_id);

-- ============================================================
-- Default Initial Seed Data (Admin Login: admin@billpro.com / admin123)
-- ============================================================

INSERT INTO users (id, name, email, password_hash, phone, role, login_allowed, password_plain)
VALUES 
(1, 'Admin User', 'admin@billpro.com', '$2b$10$QWHcgTzKn6yrGTvLgJoXBuVapLKrR7tfXPwJ3u1wbHgSsA/MpH3aK', '9371101561', 'admin', 1, 'admin123'),
(2, '7-Day Trial User', 'trial7@billpro.com', '$2b$10$5R51aVjiFWOBlKVMNr.QxOGxVI5M9NfDC42zTB.th0LPL/R19tAni', '9876543210', 'admin', 1, 'trial123')
ON CONFLICT (email) DO NOTHING;

INSERT INTO subscriptions (id, user_id, plan_type, trial_start, trial_end, status, amount_paid)
VALUES 
(1, 1, 'trial', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '29 days', 'active', 0.00),
(2, 2, 'trial_7d', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active', 0.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO company_settings (
  id, user_id, company_name, tagline, works_address, address, city, state, state_code, pincode,
  phone, email, website, gstin, pan, bank_name, bank_branch, account_no, ifsc_code, account_holder,
  invoice_prefix, next_invoice_no, default_gst_rate, terms_conditions, footer_text, signature_title
) VALUES 
(
  1, 1, 'Vaishali Industries', 'POWDER COATING SPECIALISTS',
  'Works : Sr.NO ; 25/3 Nanded Phata Near Savali Dhaba\nSinhgad Road , Pune - 411 041\nTel : 9371101561',
  'Sinhgad Road, Pune - 411041', 'Pune', 'Maharashtra', '27', '411041',
  '9371101561', 'contact@vaishaliindustries.com', 'www.vaishaliindustries.com',
  '27AAACV1234F1Z5', 'CDBPB8308N', 'Janata Sahakari Bank Ltd.', 'Sinhagad Road , Pune',
  '037230100003478', 'JSBP0000037', 'Vaishali Industries', 'INV-', 119, 18.00,
  '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within due date.\n3. Subject to Pune jurisdiction.',
  'Thank you for your business!', 'Proprietor'
),
(
  2, 2, '7-Day Trial Enterprise', '7-DAY ACCESS DEMO',
  'Works Address Line 1, Industrial Area\nPune - 411001',
  'Business Park, Pune', 'Pune', 'Maharashtra', '27', '411001',
  '9876543210', 'trial7@billpro.com', 'www.trial7.com',
  '27ABCDE1234F1Z5', 'ABCDE1234F', 'HDFC Bank', 'Main Branch',
  '50200012345678', 'HDFC0001234', '7-Day Trial Enterprise', 'INV-', 1, 18.00,
  '1. Valid for 7-day trial demo.\n2. Invoices and customer data are removed once the 7 days expire.',
  'Thank you for testing BillPro!', 'Proprietor'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO customers (id, user_id, name, contact_person, phone, email, address, city, state, state_code, pincode, notes)
VALUES 
(1, 1, 'Kalsons Fabricators & Engineers', 'Rajesh Kulkarni', '9822001122', 'accounts@kalsons.com', 'Plot No. 44, Hadapsar Industrial Estate', 'Pune', 'Maharashtra', '27', '411013', 'Long-time industrial fabrication partner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_gst_numbers (id, customer_id, gst_number, branch_name, state_name, is_default)
VALUES
(1, 1, '27ABCDE1234F1Z5', 'Pune Head Office & Works', 'Maharashtra', 1),
(2, 1, '24ABCDE1234F1Z9', 'Gujarat Assembly Depot', 'Gujarat', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, user_id, name, sku, description, price, unit, gst_rate, hsn_sac, stock_qty)
VALUES
(1, 1, 'Powder Coating - Matt Black', 'PC-BLK-01', 'Epoxy polyester powder coating with pre-treatment', 4.50, 'Sq.Ft', 18.00, '9988', 5000.00),
(2, 1, 'Sheet Metal Fabrication Assembly', 'SM-FAB-10', 'Industrial grade mild steel enclosure sheet metal work', 5294.00, 'Nos', 18.00, '7326', 150.00),
(3, 1, 'CNC Laser Cutting Service', 'CNC-LC-05', 'High precision laser cutting up to 12mm thickness', 850.00, 'Pcs', 18.00, '9988', 200.00)
ON CONFLICT (id) DO NOTHING;

-- Synchronize sequences so future inserts don't collide with existing IDs
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('subscriptions_id_seq', COALESCE((SELECT MAX(id) FROM subscriptions), 1));
SELECT setval('company_settings_id_seq', COALESCE((SELECT MAX(id) FROM company_settings), 1));
SELECT setval('customers_id_seq', COALESCE((SELECT MAX(id) FROM customers), 1));
SELECT setval('customer_gst_numbers_id_seq', COALESCE((SELECT MAX(id) FROM customer_gst_numbers), 1));
SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1));

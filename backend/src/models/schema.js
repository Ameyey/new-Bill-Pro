const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function createSchema() {
  await db.testConnection();

  if (db.isPostgres()) {
    console.log('[Supabase PostgreSQL] Checking/Verifying PostgreSQL tables in Supabase...');
    const check = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'");
    if (check.length === 0) {
      console.log('[Supabase PostgreSQL] Initializing Supabase schema from supabase_schema.sql...');
      const schemaSql = fs.readFileSync(path.join(__dirname, '../../../supabase_schema.sql'), 'utf8');
      await db.exec(schemaSql);
      console.log('[Supabase PostgreSQL] All tables created and initialized in Supabase.');
    } else {
      console.log('[Supabase PostgreSQL] All tables verified in Supabase.');
    }

    // Clean up phantom / deleted custom DC columns from customers and invoices
    try {
      const custsWithPrefs = await db.query("SELECT id, column_preferences FROM customers WHERE column_preferences IS NOT NULL");
      for (const c of (custsWithPrefs || [])) {
        let prefs = c.column_preferences;
        if (typeof prefs === 'string') {
          try { prefs = JSON.parse(prefs); } catch(e){}
        }
        if (prefs && Array.isArray(prefs.dcFields)) {
          const originalLen = prefs.dcFields.length;
          prefs.dcFields = prefs.dcFields.filter(f => {
            if (!f.isCustom) return true;
            if (!f.label || !f.label.trim()) return false;
            if (f.id?.includes('1794281193756') || f.id?.includes('1794281232013')) return false;
            if (f.key?.includes('1794281193756') || f.key?.includes('1794281232013')) return false;
            return true;
          }).map(f => f.isCustom ? { ...f, deletable: true } : f);

          if (prefs.dcFields.length !== originalLen) {
            await db.run("UPDATE customers SET column_preferences = ? WHERE id = ?", [JSON.stringify(prefs), c.id]);
          }
        }
      }

      const invs = await db.query("SELECT id, custom_dc_values FROM invoices WHERE custom_dc_values IS NOT NULL");
      for (const inv of (invs || [])) {
        let vals = inv.custom_dc_values;
        if (typeof vals === 'string') {
          try { vals = JSON.parse(vals); } catch(e){}
        }
        if (vals && typeof vals === 'object') {
          let changed = false;
          Object.keys(vals).forEach(k => {
            if (k.includes('1794281193756') || k.includes('1794281232013')) {
              delete vals[k];
              changed = true;
            }
          });
          if (changed) {
            await db.run("UPDATE invoices SET custom_dc_values = ? WHERE id = ?", [JSON.stringify(vals), inv.id]);
          }
        }
      }
    } catch (cleanErr) {
      console.warn('Phantom column cleanup warning:', cleanErr);
    }

    return;
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      login_allowed TINYINT(1) DEFAULT 1,
      password_plain VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      plan_type VARCHAR(50) NOT NULL DEFAULT 'trial',
      trial_start DATETIME NOT NULL,
      trial_end DATETIME NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      amount_paid DECIMAL(10,2) DEFAULT 0.00,
      payment_date DATETIME DEFAULT NULL,
      transaction_id VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      transaction_id VARCHAR(255) NOT NULL UNIQUE,
      payment_method VARCHAR(100) DEFAULT 'UPI / Card',
      status VARCHAR(50) DEFAULT 'completed',
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      INDEX (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS company_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
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
      default_gst_rate DECIMAL(5,2) DEFAULT 18.00,
      terms_conditions TEXT,
      footer_text TEXT,
      logo_url TEXT,
      signature_url TEXT,
      signature_title VARCHAR(100) DEFAULT 'Proprietor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS customer_gst_numbers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      gst_number VARCHAR(50) NOT NULL,
      branch_name VARCHAR(255) DEFAULT NULL,
      state_name VARCHAR(100) DEFAULT NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (customer_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100) DEFAULT NULL,
      description TEXT,
      price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      unit VARCHAR(50) DEFAULT 'Nos',
      gst_rate DECIMAL(5,2) DEFAULT 18.00,
      hsn_sac VARCHAR(50) DEFAULT NULL,
      stock_qty DECIMAL(12,2) DEFAULT 100.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      customer_id INT NOT NULL,
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
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      discount_total DECIMAL(12,2) DEFAULT 0.00,
      taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      cgst_amount DECIMAL(12,2) DEFAULT 0.00,
      sgst_amount DECIMAL(12,2) DEFAULT 0.00,
      igst_amount DECIMAL(12,2) DEFAULT 0.00,
      total_gst DECIMAL(12,2) DEFAULT 0.00,
      grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      amount_in_words TEXT,
      payment_status VARCHAR(50) DEFAULT 'unpaid',
      payment_mode VARCHAR(100) DEFAULT NULL,
      notes TEXT,
      terms TEXT,
      image1_url TEXT,
      image2_url TEXT,
      column_preferences TEXT,
      header_preferences TEXT,
      is_inter_state TINYINT(1) DEFAULT 0,
      bill_gst_rate DECIMAL(5,2) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (user_id),
      INDEX (customer_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      product_id INT DEFAULT NULL,
      item_no INT DEFAULT 1,
      description TEXT NOT NULL,
      sq_ft DECIMAL(12,2) DEFAULT 0.00,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
      unit VARCHAR(50) DEFAULT 'Nos',
      rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      discount DECIMAL(12,2) DEFAULT 0.00,
      taxable_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      gst_rate DECIMAL(5,2) DEFAULT 18.00,
      gst_amount DECIMAL(12,2) DEFAULT 0.00,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      INDEX (invoice_id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS invoice_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      invoice_id INT DEFAULT NULL,
      image_slot INT DEFAULT 1,
      image_type VARCHAR(50) DEFAULT 'general',
      file_path TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size INT DEFAULT NULL,
      mime_type VARCHAR(100) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const tableSql of tables) {
    await db.exec(tableSql);
  }

  // Safe column migrations for existing databases
  try {
    await db.exec('ALTER TABLE invoice_images ADD COLUMN image_slot INT DEFAULT 1');
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE invoice_images ADD COLUMN invoice_id INT DEFAULT NULL');
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE invoice_images ADD COLUMN invoice_id_or_user_id INT DEFAULT NULL');
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE users ADD COLUMN login_allowed TINYINT(1) DEFAULT 1');
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE users ADD COLUMN password_plain VARCHAR(255) DEFAULT NULL');
  } catch (e) {}

  console.log('[MySQL] All 10 tables verified/created successfully in MySQL.');
}

module.exports = { createSchema };

const db = require('../config/db');

// Get company settings
exports.getCompanySettings = async (req, res) => {
  try {
    let settings = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [req.user.id]);
    if (!settings) {
      const user = await db.get('SELECT name, email, phone FROM users WHERE id = ?', [req.user.id]);
      await db.run(
        `INSERT INTO company_settings (
          user_id, company_name, email, phone, invoice_prefix, next_invoice_no, default_gst_rate
        ) VALUES (?, ?, ?, ?, 'INV-', 1, 18.00)`,
        [
          req.user.id,
          user?.name ? `${user.name}'s Business` : 'My Business',
          user?.email || null,
          user?.phone || null
        ]
      );
      settings = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [req.user.id]);
    }
    if (settings && !settings.logo_url) {
      const logoImg = await db.get(
        "SELECT file_path FROM invoice_images WHERE user_id = ? AND (image_slot = 1 OR image_type = 'logo') ORDER BY id DESC LIMIT 1",
        [req.user.id]
      );
      if (logoImg?.file_path) {
        settings.logo_url = logoImg.file_path;
        try {
          await db.run('UPDATE company_settings SET logo_url = ? WHERE user_id = ?', [logoImg.file_path, req.user.id]);
        } catch (e) {}
      }
    }
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update company settings
exports.updateCompanySettings = async (req, res) => {
  try {
    const {
      company_name, tagline, works_address, address, city, state, state_code, pincode,
      phone, email, website, gstin, pan, bank_name, bank_branch, account_no, ifsc_code,
      account_holder, invoice_prefix, next_invoice_no, default_gst_rate, terms_conditions,
      footer_text, logo_url, signature_url, signature_title
    } = req.body;

    let settings = await db.get('SELECT id FROM company_settings WHERE user_id = ?', [req.user.id]);

    if (!settings) {
      await db.run(
        `INSERT INTO company_settings (
          user_id, company_name, tagline, works_address, address, city, state, state_code, pincode,
          phone, email, website, gstin, pan, bank_name, bank_branch, account_no, ifsc_code, account_holder,
          invoice_prefix, next_invoice_no, default_gst_rate, terms_conditions, footer_text, logo_url,
          signature_url, signature_title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, company_name, tagline || '', works_address || '', address || '', city || '', state || '',
          state_code || '', pincode || '', phone || '', email || '', website || '', gstin || '', pan || '',
          bank_name || '', bank_branch || '', account_no || '', ifsc_code || '', account_holder || '',
          invoice_prefix || 'INV-', parseInt(next_invoice_no, 10) > 0 ? parseInt(next_invoice_no, 10) : 1, parseFloat(default_gst_rate) || 18,
          terms_conditions || '', footer_text || '', logo_url || '', signature_url || '', signature_title || 'Proprietor'
        ]
      );
    } else {
      await db.run(
        `UPDATE company_settings SET
          company_name = ?, tagline = ?, works_address = ?, address = ?, city = ?, state = ?, state_code = ?, pincode = ?,
          phone = ?, email = ?, website = ?, gstin = ?, pan = ?, bank_name = ?, bank_branch = ?, account_no = ?, ifsc_code = ?,
          account_holder = ?, invoice_prefix = ?, next_invoice_no = ?, default_gst_rate = ?, terms_conditions = ?,
          footer_text = ?, logo_url = ?, signature_url = ?, signature_title = ?
        WHERE user_id = ?`,
        [
          company_name, tagline || '', works_address || '', address || '', city || '', state || '', state_code || '', pincode || '',
          phone || '', email || '', website || '', gstin || '', pan || '', bank_name || '', bank_branch || '', account_no || '', ifsc_code || '',
          account_holder || '', invoice_prefix || 'INV-', parseInt(next_invoice_no, 10) > 0 ? parseInt(next_invoice_no, 10) : 1, parseFloat(default_gst_rate) || 18,
          terms_conditions || '', footer_text || '', logo_url || '', signature_url || '', signature_title || 'Proprietor',
          req.user.id
        ]
      );
    }

    const updated = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [req.user.id]);
    return res.json({ success: true, message: 'Settings saved successfully.', settings: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


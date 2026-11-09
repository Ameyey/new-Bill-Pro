const db = require('../config/db');

function safeParse(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return fallback; }
  }
  return fallback;
}

// Get all customers with their GST numbers
exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers WHERE user_id = ?';
    const params = [req.user.id];

    if (search) {
      sql += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ' ORDER BY name ASC';

    const customers = await db.query(sql, params);

    // Attach GST numbers
    const customersWithGst = await Promise.all(
      customers.map(async (cust) => {
        const gstList = await db.query(
          'SELECT * FROM customer_gst_numbers WHERE customer_id = ? ORDER BY is_default DESC, id ASC',
          [cust.id]
        );
        const defaultGst = gstList.find((g) => g.is_default === 1) || gstList[0] || null;
        return {
          ...cust,
          column_preferences: safeParse(cust.column_preferences),
          gst_numbers: gstList,
          default_gst_number: defaultGst ? defaultGst.gst_number : ''
        };
      })
    );

    return res.json({ success: true, customers: customersWithGst });
  } catch (error) {
    console.error('getCustomers error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single customer
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await db.get('SELECT * FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const gst_numbers = await db.query(
      'SELECT * FROM customer_gst_numbers WHERE customer_id = ? ORDER BY is_default DESC, id ASC',
      [id]
    );

    return res.json({
      success: true,
      customer: {
        ...customer,
        column_preferences: safeParse(customer.column_preferences),
        gst_numbers
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Create new customer
exports.createCustomer = async (req, res) => {
  try {
    const { name, contact_person, phone, email, address, city, state, state_code, pincode, notes, gst_numbers } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Customer/Company name is required.' });
    }

    const result = await db.run(
      `INSERT INTO customers (user_id, name, contact_person, phone, email, address, city, state, state_code, pincode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, contact_person || '', phone || '', email || '', address || '', city || '', state || '', state_code || '', pincode || '', notes || '']
    );

    const customerId = result.lastInsertRowid;

    // Insert GST numbers if provided
    if (Array.isArray(gst_numbers) && gst_numbers.length > 0) {
      for (let i = 0; i < gst_numbers.length; i++) {
        const gst = gst_numbers[i];
        const gstVal = typeof gst === 'string' ? gst : gst.gst_number;
        const branch = typeof gst === 'object' ? (gst.branch_name || '') : '';
        const stateName = typeof gst === 'object' ? (gst.state_name || '') : '';
        const isDefault = i === 0 || (typeof gst === 'object' && gst.is_default) ? 1 : 0;

        if (gstVal && gstVal.trim()) {
          await db.run(
            `INSERT INTO customer_gst_numbers (customer_id, gst_number, branch_name, state_name, is_default)
             VALUES (?, ?, ?, ?, ?)`,
            [customerId, gstVal.trim().toUpperCase(), branch, stateName, isDefault]
          );
        }
      }
    }

    const newCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
    const savedGstList = await db.query('SELECT * FROM customer_gst_numbers WHERE customer_id = ?', [customerId]);

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully.',
      customer: { ...newCustomer, gst_numbers: savedGstList }
    });
  } catch (error) {
    console.error('createCustomer error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address, city, state, state_code, pincode, notes, gst_numbers } = req.body;

    const existing = await db.get('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    await db.run(
      `UPDATE customers SET 
         name = ?, contact_person = ?, phone = ?, email = ?, 
         address = ?, city = ?, state = ?, state_code = ?, pincode = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [name, contact_person || '', phone || '', email || '', address || '', city || '', state || '', state_code || '', pincode || '', notes || '', id, req.user.id]
    );

    if (Array.isArray(gst_numbers)) {
      await db.run('DELETE FROM customer_gst_numbers WHERE customer_id = ?', [id]);
      for (let i = 0; i < gst_numbers.length; i++) {
        const gst = gst_numbers[i];
        const gstVal = typeof gst === 'string' ? gst : gst.gst_number;
        const branch = typeof gst === 'object' ? (gst.branch_name || '') : '';
        const stateName = typeof gst === 'object' ? (gst.state_name || '') : '';
        const isDefault = (typeof gst === 'object' && gst.is_default) || i === 0 ? 1 : 0;

        if (gstVal && gstVal.trim()) {
          await db.run(
            `INSERT INTO customer_gst_numbers (customer_id, gst_number, branch_name, state_name, is_default)
             VALUES (?, ?, ?, ?, ?)`,
            [id, gstVal.trim().toUpperCase(), branch, stateName, isDefault]
          );
        }
      }
    }

    const updated = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    const savedGstList = await db.query('SELECT * FROM customer_gst_numbers WHERE customer_id = ?', [id]);

    return res.json({
      success: true,
      message: 'Customer updated successfully.',
      customer: { ...updated, gst_numbers: savedGstList }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    await db.run('DELETE FROM customer_gst_numbers WHERE customer_id = ?', [id]);
    await db.run('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);

    return res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Add single GST number to existing customer
exports.addCustomerGstNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const { gst_number, branch_name, state_name, is_default } = req.body;

    if (!gst_number || !gst_number.trim()) {
      return res.status(400).json({ success: false, message: 'GST number is required.' });
    }

    const customer = await db.get('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (is_default) {
      await db.run('UPDATE customer_gst_numbers SET is_default = 0 WHERE customer_id = ?', [id]);
    }

    const result = await db.run(
      `INSERT INTO customer_gst_numbers (customer_id, gst_number, branch_name, state_name, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [id, gst_number.trim().toUpperCase(), branch_name || '', state_name || '', is_default ? 1 : 0]
    );

    const newGst = await db.get('SELECT * FROM customer_gst_numbers WHERE id = ?', [result.lastInsertRowid]);
    const allGsts = await db.query('SELECT * FROM customer_gst_numbers WHERE customer_id = ? ORDER BY is_default DESC, id ASC', [id]);

    return res.status(201).json({
      success: true,
      message: 'GST number added successfully.',
      gst: newGst,
      gst_numbers: allGsts
    });
  } catch (error) {
    console.error('addCustomerGstNumber error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete single GST number from customer
exports.deleteCustomerGstNumber = async (req, res) => {
  try {
    const { id, gstId } = req.params;
    const customer = await db.get('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    await db.run('DELETE FROM customer_gst_numbers WHERE id = ? AND customer_id = ?', [gstId, id]);
    const remainingGsts = await db.query('SELECT * FROM customer_gst_numbers WHERE customer_id = ? ORDER BY is_default DESC, id ASC', [id]);

    return res.json({
      success: true,
      message: 'GST number deleted successfully.',
      gst_numbers: remainingGsts
    });
  } catch (error) {
    console.error('deleteCustomerGstNumber error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get previous invoice configuration, DC fields, column preferences, and previous items for a customer
exports.getCustomerPreviousConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await db.get(
      'SELECT id, name, column_preferences FROM customers WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    const lastInvoice = await db.get(
      'SELECT * FROM invoices WHERE customer_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [id, req.user.id]
    );

    let items = [];
    if (lastInvoice) {
      items = await db.query(
        'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_no ASC, id ASC',
        [lastInvoice.id]
      );
    }

    const customerPrefs = customer ? safeParse(customer.column_preferences) : null;
    const invoicePrefs = lastInvoice ? safeParse(lastInvoice.column_preferences) : null;
    const resolvedPrefs = customerPrefs || invoicePrefs || null;

    return res.json({
      success: true,
      hasPreviousInvoice: Boolean(lastInvoice),
      hasCustomerConfig: Boolean(customerPrefs || invoicePrefs),
      lastInvoiceId: lastInvoice ? lastInvoice.id : null,
      invoice_number: lastInvoice ? lastInvoice.invoice_number : '',
      column_preferences: resolvedPrefs,
      custom_dc_values: lastInvoice ? safeParse(lastInvoice.custom_dc_values, {}) : {},
      in_dc_no: lastInvoice ? (lastInvoice.in_dc_no || '') : '',
      out_dc_no: lastInvoice ? (lastInvoice.out_dc_no || '') : '',
      payment_mode: lastInvoice ? (lastInvoice.payment_mode || 'Bank Transfer') : 'Bank Transfer',
      notes: lastInvoice ? (lastInvoice.notes || '') : '',
      terms: lastInvoice ? (lastInvoice.terms || '') : '',
      items: items.map(it => ({
        product_id: it.product_id || '',
        description: it.description || '',
        sq_ft: it.sq_ft !== null && it.sq_ft !== undefined ? String(it.sq_ft) : '',
        quantity: String(it.quantity || 1),
        unit: it.unit || 'Nos',
        rate: String(it.rate || 0),
        taxable_amount: it.taxable_amount || 0,
        gst_rate: it.gst_rate || '',
        discount: it.discount || '',
        custom_fields: safeParse(it.custom_fields, {})
      }))
    });
  } catch (error) {
    console.error('getCustomerPreviousConfig error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Save customer-specific column preferences
exports.saveCustomerColumnPreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const { column_preferences } = req.body;
    const colPrefsStr = column_preferences
      ? (typeof column_preferences === 'string' ? column_preferences : JSON.stringify(column_preferences))
      : null;

    await db.run(
      'UPDATE customers SET column_preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [colPrefsStr, id, req.user.id]
    );

    return res.json({ success: true, message: 'Company column preferences saved successfully.' });
  } catch (error) {
    console.error('saveCustomerColumnPreferences error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { calculateInvoiceTotals } = require('../utils/gstCalculator');
const { generateInvoicePdf } = require('../utils/pdfGenerator');

// Safe JSON parser that handles both strings and objects (PostgreSQL returns JSONB as parsed objects)
function safeParseJson(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
}

// Helper to stringify JSON safely for DB insertion
function safeStringifyJson(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

// Get next invoice number
exports.getNextInvoiceNumber = async (req, res) => {
  try {
    const company = await db.get('SELECT invoice_prefix, next_invoice_no FROM company_settings WHERE user_id = ?', [req.user.id]);
    const prefix = company ? (company.invoice_prefix || 'INV-') : 'INV-';
    const nextNo = company && company.next_invoice_no !== null && company.next_invoice_no !== undefined ? company.next_invoice_no : 1;
    const formatted = `${prefix}${nextNo}`;
    return res.json({ success: true, nextNumber: formatted, rawNumber: nextNo, prefix });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// List all invoices with filters
exports.getInvoices = async (req, res) => {
  try {
    const { search, customer_id, payment_status, start_date, end_date } = req.query;

    let sql = `
      SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.in_dc_no, i.out_dc_no,
             i.customer_id, i.customer_name, i.customer_city, i.customer_phone,
             i.selected_gst_number, i.subtotal, i.discount_total, i.taxable_amount,
             i.total_gst, i.grand_total, i.payment_status, i.payment_mode, i.created_at,
             c.name as customer_company_name, 
             c.phone as customer_phone_contact,
             (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.user_id = ?
    `;
    const params = [req.user.id];

    if (search) {
      sql += ' AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.selected_gst_number LIKE ? OR i.out_dc_no LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (customer_id) {
      sql += ' AND i.customer_id = ?';
      params.push(customer_id);
    }

    if (payment_status && payment_status !== 'all') {
      sql += ' AND i.payment_status = ?';
      params.push(payment_status);
    }

    if (start_date) {
      sql += ' AND i.invoice_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND i.invoice_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY i.id DESC';

    const invoices = await db.query(sql, params);

    return res.json({
      success: true,
      invoices,
      total: invoices.length
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, req.user.id]);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_no ASC, id ASC', [id]);
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [invoice.customer_id]);
    const company = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [req.user.id]);
    const images = await db.query('SELECT * FROM invoice_images WHERE invoice_id = ? OR user_id = ?', [id, req.user.id]);

    const parsedColumnPreferences = safeParseJson(invoice.column_preferences);
    const parsedCustomDcValues = safeParseJson(invoice.custom_dc_values, {});
    const parsedHeaderPreferences = safeParseJson(invoice.header_preferences);

    const parsedItems = items.map(it => {
      const customFields = safeParseJson(it.custom_fields, {});
      return { ...customFields, ...it };
    });

    const checkFileExists = (url) => {
      if (!url) return false;
      if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        return true;
      }
      try {
        const cleanPath = url.replace(/^\/+/, '');
        const absPath = path.join(__dirname, '../../', cleanPath);
        return fs.existsSync(absPath);
      } catch (e) {
        return false;
      }
    };

    let resolvedImage1 = '';
    if (invoice.image1_url && checkFileExists(invoice.image1_url)) {
      resolvedImage1 = invoice.image1_url;
    } else if (company && company.logo_url && checkFileExists(company.logo_url)) {
      resolvedImage1 = company.logo_url;
    } else {
      const activeLogo = images.find(img => (img.image_slot === 1 || img.image_type === 'logo') && checkFileExists(img.file_path));
      resolvedImage1 = activeLogo ? activeLogo.file_path : (company ? company.logo_url : '') || '';
    }

    let resolvedImage2 = '';
    if (invoice.image2_url && checkFileExists(invoice.image2_url)) {
      resolvedImage2 = invoice.image2_url;
    } else if (company && company.signature_url && checkFileExists(company.signature_url)) {
      resolvedImage2 = company.signature_url;
    } else {
      const activeSig = images.find(img => (img.image_slot === 2 || img.image_type === 'signature') && checkFileExists(img.file_path));
      resolvedImage2 = activeSig ? activeSig.file_path : (company ? company.signature_url : '') || '';
    }

    return res.json({
      success: true,
      invoice: {
        ...invoice,
        image1_url: resolvedImage1,
        image2_url: resolvedImage2,
        column_preferences: parsedColumnPreferences,
        custom_dc_values: parsedCustomDcValues,
        header_preferences: parsedHeaderPreferences,
        customer_phone: invoice.customer_phone || (customer ? customer.phone : ''),
        items: parsedItems,
        customer,
        company,
        images
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Create new invoice
exports.createInvoice = async (req, res) => {
  try {
    const {
      customer_id,
      customer_gst_id,
      selected_gst_number,
      invoice_number,
      invoice_date,
      due_date,
      in_dc_no,
      in_dc_date,
      out_dc_no,
      out_dc_date,
      customer_name,
      customer_address,
      customer_phone,
      customer_email,
      customer_city,
      customer_state,
      customer_state_code,
      items = [],
      is_inter_state,
      payment_status,
      payment_mode,
      notes,
      terms,
      image1_url,
      image2_url,
      bill_gst_rate,
      apply_gst_on_total,
      column_preferences,
      custom_dc_values,
      header_preferences
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Please select a customer.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product item is required in the invoice.' });
    }

    const company = await db.get('SELECT state_code, invoice_prefix, next_invoice_no, terms_conditions, logo_url, signature_url FROM company_settings WHERE user_id = ?', [req.user.id]);
    const companyStateCode = company ? company.state_code : '27';

    // Calculate all totals
    const calc = calculateInvoiceTotals(
      items,
      companyStateCode,
      customer_state_code || (customer_state ? customer_state.substring(0, 2) : '27'),
      is_inter_state !== undefined ? is_inter_state : null,
      bill_gst_rate,
      apply_gst_on_total !== undefined ? apply_gst_on_total : true
    );

    // Determine final invoice number
    let finalInvoiceNumber = invoice_number;
    if (!finalInvoiceNumber) {
      const prefix = company ? (company.invoice_prefix || 'INV-') : 'INV-';
      const nextNo = company && company.next_invoice_no !== null && company.next_invoice_no !== undefined ? company.next_invoice_no : 1;
      finalInvoiceNumber = `${prefix}${nextNo}`;
    }

    const finalDate = invoice_date || new Date().toISOString().split('T')[0];

    const colPrefsStr = safeStringifyJson(column_preferences);
    const customDcStr = safeStringifyJson(custom_dc_values);
    const headerPrefsStr = safeStringifyJson(header_preferences);

    // Keep invoice records light: only store image1/image2 if it is a custom override differing from company settings
    const finalImage1 = (image1_url && image1_url !== company?.logo_url) ? image1_url : '';
    const finalImage2 = (image2_url && image2_url !== company?.signature_url) ? image2_url : '';

    const result = await db.run(
      `INSERT INTO invoices (
        user_id, customer_id, customer_gst_id, selected_gst_number, invoice_number,
        invoice_date, due_date, in_dc_no, in_dc_date, out_dc_no, out_dc_date,
        customer_name, customer_address, customer_phone, customer_email,
        customer_city, customer_state, customer_state_code,
        subtotal, discount_total, taxable_amount, cgst_amount, sgst_amount, igst_amount,
        total_gst, grand_total, amount_in_words, payment_status, payment_mode, notes, terms,
        image1_url, image2_url, column_preferences, custom_dc_values, header_preferences,
        is_inter_state, bill_gst_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        customer_id,
        customer_gst_id || null,
        selected_gst_number || '',
        finalInvoiceNumber,
        finalDate,
        due_date || null,
        in_dc_no || '',
        in_dc_date || null,
        out_dc_no || '',
        out_dc_date || null,
        customer_name || '',
        customer_address || '',
        customer_phone || '',
        customer_email || '',
        customer_city || '',
        customer_state || '',
        customer_state_code || '',
        calc.subtotal,
        calc.discount_total,
        calc.taxable_amount,
        calc.cgst_amount,
        calc.sgst_amount,
        calc.igst_amount,
        calc.total_gst,
        calc.grand_total,
        calc.amount_in_words,
        payment_status || 'unpaid',
        payment_mode || 'Bank Transfer',
        notes || '',
        terms || (company ? company.terms_conditions : ''),
        finalImage1,
        finalImage2,
        colPrefsStr,
        customDcStr,
        headerPrefsStr,
        is_inter_state ? 1 : 0,
        bill_gst_rate || null
      ]
    );

    const invoiceId = result.lastInsertRowid;

    // Batch insert invoice items in a single fast query
    if (calc.items && calc.items.length > 0) {
      const placeholders = [];
      const itemParams = [];
      for (let idx = 0; idx < calc.items.length; idx++) {
        const item = calc.items[idx];
        const standardKeys = ['product_id', 'item_no', 'description', 'sq_ft', 'quantity', 'unit', 'rate', 'discount', 'taxable_value', 'gst_rate', 'gst_amount', 'total_amount'];
        const extra = {};
        Object.keys(item).forEach(k => {
          if (!standardKeys.includes(k) && item[k] !== undefined) {
            extra[k] = item[k];
          }
        });
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        itemParams.push(
          invoiceId,
          item.product_id || null,
          idx + 1,
          item.description || '',
          item.sq_ft || 0,
          item.quantity || 1,
          item.unit || 'Nos',
          item.rate || 0,
          item.discount || 0,
          item.taxable_value || 0,
          item.gst_rate || 0,
          item.gst_amount || 0,
          item.total_amount || 0,
          Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
        );
      }
      await db.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, item_no, description, sq_ft, quantity, unit,
          rate, discount, taxable_value, gst_rate, gst_amount, total_amount, custom_fields
        ) VALUES ${placeholders.join(', ')}`,
        itemParams
      );
    }

    // Update next invoice number in company settings if numerical
    if (company && company.next_invoice_no !== null && company.next_invoice_no !== undefined) {
      await db.run('UPDATE company_settings SET next_invoice_no = next_invoice_no + 1 WHERE user_id = ?', [req.user.id]);
    }

    const createdInvoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    const createdItems = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    return res.status(201).json({
      success: true,
      message: 'Invoice generated successfully!',
      invoice: {
        ...createdInvoice,
        image1_url: createdInvoice.image1_url || company?.logo_url || '',
        image2_url: createdInvoice.image2_url || company?.signature_url || '',
        items: createdItems
      }
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update invoice
exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const {
      customer_id,
      customer_gst_id,
      selected_gst_number,
      invoice_number,
      invoice_date,
      due_date,
      in_dc_no,
      in_dc_date,
      out_dc_no,
      out_dc_date,
      customer_name,
      customer_address,
      customer_phone,
      customer_email,
      customer_city,
      customer_state,
      customer_state_code,
      items = [],
      is_inter_state,
      payment_status,
      payment_mode,
      notes,
      terms,
      image1_url,
      image2_url,
      bill_gst_rate,
      apply_gst_on_total,
      column_preferences,
      custom_dc_values,
      header_preferences
    } = req.body;

    const company = await db.get('SELECT state_code, invoice_prefix, next_invoice_no, terms_conditions, logo_url, signature_url FROM company_settings WHERE user_id = ?', [req.user.id]);
    const companyStateCode = company ? company.state_code : '27';

    // Calculate totals
    const calc = calculateInvoiceTotals(
      items,
      companyStateCode,
      customer_state_code || (customer_state ? customer_state.substring(0, 2) : '27'),
      is_inter_state !== undefined ? is_inter_state : null,
      bill_gst_rate,
      apply_gst_on_total !== undefined ? apply_gst_on_total : true
    );

    const colPrefsStr = column_preferences !== undefined ? safeStringifyJson(column_preferences) : safeStringifyJson(existing.column_preferences);
    const customDcStr = custom_dc_values !== undefined ? safeStringifyJson(custom_dc_values) : safeStringifyJson(existing.custom_dc_values);
    const headerPrefsStr = header_preferences !== undefined ? safeStringifyJson(header_preferences) : safeStringifyJson(existing.header_preferences);

    const finalImage1 = image1_url !== undefined
      ? ((image1_url && image1_url !== company?.logo_url) ? image1_url : '')
      : existing.image1_url;
    const finalImage2 = image2_url !== undefined
      ? ((image2_url && image2_url !== company?.signature_url) ? image2_url : '')
      : existing.image2_url;

    await db.run(
      `UPDATE invoices SET
        customer_id = ?, customer_gst_id = ?, selected_gst_number = ?, invoice_number = ?,
        invoice_date = ?, due_date = ?, in_dc_no = ?, in_dc_date = ?, out_dc_no = ?, out_dc_date = ?,
        customer_name = ?, customer_address = ?, customer_phone = ?, customer_email = ?,
        customer_city = ?, customer_state = ?, customer_state_code = ?,
        subtotal = ?, discount_total = ?, taxable_amount = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?,
        total_gst = ?, grand_total = ?, amount_in_words = ?, payment_status = ?, payment_mode = ?, notes = ?, terms = ?,
        image1_url = ?, image2_url = ?, column_preferences = ?, custom_dc_values = ?, header_preferences = ?,
        is_inter_state = ?, bill_gst_rate = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        customer_id || existing.customer_id,
        customer_gst_id || null,
        selected_gst_number || '',
        invoice_number || existing.invoice_number,
        invoice_date || existing.invoice_date,
        due_date || null,
        in_dc_no || '',
        in_dc_date || null,
        out_dc_no || '',
        out_dc_date || null,
        customer_name || existing.customer_name,
        customer_address || '',
        customer_phone || '',
        customer_email || '',
        customer_city || '',
        customer_state || '',
        customer_state_code || '',
        calc.subtotal,
        calc.discount_total,
        calc.taxable_amount,
        calc.cgst_amount,
        calc.sgst_amount,
        calc.igst_amount,
        calc.total_gst,
        calc.grand_total,
        calc.amount_in_words,
        payment_status || existing.payment_status,
        payment_mode || existing.payment_mode,
        notes || '',
        terms || existing.terms,
        finalImage1,
        finalImage2,
        colPrefsStr,
        customDcStr,
        headerPrefsStr,
        is_inter_state ? 1 : 0,
        bill_gst_rate || null,
        id,
        req.user.id
      ]
    );

    // Delete old items and batch insert updated items in a single query
    await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    if (calc.items && calc.items.length > 0) {
      const placeholders = [];
      const itemParams = [];
      for (let idx = 0; idx < calc.items.length; idx++) {
        const item = calc.items[idx];
        const standardKeys = ['product_id', 'item_no', 'description', 'sq_ft', 'quantity', 'unit', 'rate', 'discount', 'taxable_value', 'gst_rate', 'gst_amount', 'total_amount'];
        const extra = {};
        Object.keys(item).forEach(k => {
          if (!standardKeys.includes(k) && item[k] !== undefined) {
            extra[k] = item[k];
          }
        });
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        itemParams.push(
          id,
          item.product_id || null,
          idx + 1,
          item.description || '',
          item.sq_ft || 0,
          item.quantity || 1,
          item.unit || 'Nos',
          item.rate || 0,
          item.discount || 0,
          item.taxable_value || 0,
          item.gst_rate || 0,
          item.gst_amount || 0,
          item.total_amount || 0,
          Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
        );
      }
      await db.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, item_no, description, sq_ft, quantity, unit,
          rate, discount, taxable_value, gst_rate, gst_amount, total_amount, custom_fields
        ) VALUES ${placeholders.join(', ')}`,
        itemParams
      );
    }

    const updated = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    const updatedItems = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);

    return res.json({
      success: true,
      message: 'Invoice updated successfully!',
      invoice: {
        ...updated,
        image1_url: updated.image1_url || company?.logo_url || '',
        image2_url: updated.image2_url || company?.signature_url || '',
        items: updatedItems
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    await db.run('DELETE FROM invoices WHERE id = ?', [id]);

    return res.json({ success: true, message: 'Invoice deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update payment status quickly
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_mode } = req.body;

    const existing = await db.get('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    await db.run(
      'UPDATE invoices SET payment_status = ?, payment_mode = COALESCE(?, payment_mode) WHERE id = ?',
      [payment_status, payment_mode, id]
    );

    return res.json({ success: true, message: 'Payment status updated.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Stream PDF generation
exports.generatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_no ASC, id ASC', [id]);
    const company = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [req.user.id]);

    const parsedItems = items.map(it => {
      const customFields = safeParseJson(it.custom_fields, {});
      return { ...customFields, ...it };
    });
    const parsedColumnPreferences = safeParseJson(invoice.column_preferences);
    const parsedInvoice = {
      ...invoice,
      column_preferences: parsedColumnPreferences
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${invoice.invoice_number}.pdf"`);

    generateInvoicePdf(parsedInvoice, company, parsedItems, res);
  } catch (error) {
    console.error('PDF error:', error);
    return res.status(500).json({ success: false, message: 'PDF generation failed: ' + error.message });
  }
};

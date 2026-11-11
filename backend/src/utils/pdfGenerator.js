const PDFDocument = require('pdfkit');

function generateInvoicePdf(invoice, company, items, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  // Header
  doc.fontSize(20).text(company?.company_name || 'TAX INVOICE', { align: 'center', bold: true });
  if (company?.tagline) {
    doc.fontSize(10).text(company.tagline, { align: 'center' });
  }
  if (company?.address) {
    doc.fontSize(9).text(`${company.address}, ${company.city || ''} - ${company.pincode || ''}`, { align: 'center' });
  }
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // Invoice & Customer Info
  const startY = doc.y;
  doc.fontSize(10).font('Helvetica-Bold').text('Invoice Details:');
  doc.font('Helvetica').fontSize(9)
    .text(`Invoice No: ${invoice.invoice_number || 'N/A'}`)
    .text(`Date: ${invoice.invoice_date || ''}`)
    .text(`Payment Status: ${invoice.payment_status || 'Pending'}`);

  if (invoice.out_dc_no) {
    doc.text(`Out D.C. No: ${invoice.out_dc_no}${invoice.out_dc_date ? ` (${invoice.out_dc_date})` : ''}`);
  }
  if (invoice.in_dc_no) {
    doc.text(`In D.C. No: ${invoice.in_dc_no}${invoice.in_dc_date ? ` (${invoice.in_dc_date})` : ''}`);
  }

  doc.font('Helvetica-Bold').fontSize(10).text('Bill To (Customer):', 300, startY);
  doc.font('Helvetica').fontSize(9)
    .text(invoice.customer_name || 'Valued Customer', 300)
    .text(`GSTIN: ${invoice.selected_gst_number || invoice.customer_gst_number || 'N/A'}`, 300)
    .text(`Address: ${invoice.customer_address || ''}`, 300);

  doc.moveDown(1.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // Parse column preferences if available
  let colPrefs = invoice.column_preferences;
  if (typeof colPrefs === 'string') {
    try { colPrefs = JSON.parse(colPrefs); } catch (e) { colPrefs = null; }
  }

  let visibleCols = [];
  if (colPrefs && Array.isArray(colPrefs.itemColumns)) {
    const rawCols = colPrefs.itemColumns.filter(c => c.visible && c.id !== 'catalog');
    const totalCol = rawCols.find(c => c.id === 'total') || { id: 'total', key: 'total', label: 'Total (INR)' };
    visibleCols = [...rawCols.filter(c => c.id !== 'total'), totalCol];
  }

  // Fallback default columns if none configured
  if (visibleCols.length === 0) {
    visibleCols = [
      { id: 'item_no', key: 'item_no', label: 'Sr' },
      { id: 'description', key: 'description', label: 'Description' },
      { id: 'quantity', key: 'quantity', label: 'Qty' },
      { id: 'rate', key: 'rate', label: 'Rate' },
      { id: 'gst_rate', key: 'gst_rate', label: 'GST %' },
      { id: 'total', key: 'total', label: 'Total (INR)' }
    ];
  }

  // Calculate dynamic column widths (Total available width: 515 from X=40 to X=555)
  const fixedWidths = {
    item_no: 25,
    sq_ft: 40,
    quantity: 35,
    unit: 30,
    rate: 55,
    discount: 40,
    gst_rate: 45,
    total: 75
  };

  let nonDescWidth = 0;
  visibleCols.forEach(col => {
    if (col.id !== 'description') {
      const w = fixedWidths[col.id] || 50;
      col.width = w;
      nonDescWidth += w;
    }
  });

  const descCol = visibleCols.find(c => c.id === 'description');
  if (descCol) {
    descCol.width = Math.max(100, 515 - nonDescWidth);
  }

  let currX = 40;
  visibleCols.forEach(col => {
    col.x = currX;
    if (col.id === 'item_no' || col.id === 'unit' || col.id === 'sq_ft' || col.isCustom) {
      col.align = 'center';
    } else if (col.id === 'rate' || col.id === 'quantity' || col.id === 'discount' || col.id === 'gst_rate' || col.id === 'total') {
      col.align = 'right';
    } else {
      col.align = 'left';
    }
    currX += col.width;
  });

  // Items Table Header
  const tableTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(8.5);
  visibleCols.forEach(col => {
    doc.text(col.label, col.x, tableTop, { width: col.width, align: col.align });
  });

  doc.moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).stroke();

  let y = tableTop + 22;
  doc.font('Helvetica').fontSize(8.5);
  (items || []).forEach((item, index) => {
    visibleCols.forEach(col => {
      let val = '';
      if (col.id === 'item_no') {
        val = (index + 1).toString();
      } else if (col.id === 'description') {
        val = item.description || item.product_name || 'Item';
      } else if (col.id === 'sq_ft') {
        val = item.sq_ft > 0 ? String(item.sq_ft) : '-';
      } else if (col.id === 'quantity') {
        val = (item.quantity !== undefined && item.quantity !== null) ? String(item.quantity) : '1';
      } else if (col.id === 'unit') {
        val = item.unit || 'Nos';
      } else if (col.id === 'rate') {
        val = Number(item.rate || 0).toFixed(2);
      } else if (col.id === 'discount') {
        val = item.discount > 0 ? Number(item.discount).toFixed(2) : '-';
      } else if (col.id === 'gst_rate') {
        val = `${item.gst_rate || 0}%`;
      } else if (col.id === 'total') {
        val = Number(item.total_amount || (item.quantity * item.rate) || 0).toFixed(2);
      } else {
        val = item[col.key] || item[col.id] || '-';
      }

      doc.text(String(val), col.x, y, { width: col.width, align: col.align });
    });
    y += 18;
  });

  doc.moveTo(40, y + 5).lineTo(555, y + 5).stroke();
  y += 15;

  // Summary Totals
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(`Subtotal: Rs. ${Number(invoice.subtotal || 0).toFixed(2)}`, 350, y, { align: 'right', width: 205 });
  y += 15;
  doc.text(`Total GST: Rs. ${Number(invoice.total_gst || 0).toFixed(2)}`, 350, y, { align: 'right', width: 205 });
  y += 15;
  doc.fontSize(11).text(`Grand Total: Rs. ${Number(invoice.grand_total || 0).toFixed(2)}`, 350, y, { align: 'right', width: 205 });
  y += 20;

  if (invoice.amount_in_words) {
    doc.font('Helvetica-Oblique').fontSize(9).text(`Amount in Words: ${invoice.amount_in_words}`, 40, y);
  }

  doc.end();
}

module.exports = { generateInvoicePdf };

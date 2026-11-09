const db = require('../config/db');

exports.getReports = async (req, res) => {
  try {
    const { range = 'month' } = req.query;

    const invoices = await db.query(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY invoice_date DESC',
      [req.user.id]
    );

    let totalSales = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    invoices.forEach(inv => {
      totalSales += parseFloat(inv.grand_total) || 0;
      totalTaxable += parseFloat(inv.taxable_amount) || 0;
      totalCgst += parseFloat(inv.cgst_amount) || 0;
      totalSgst += parseFloat(inv.sgst_amount) || 0;
      totalIgst += parseFloat(inv.igst_amount) || 0;
      if (inv.payment_status === 'paid') {
        paidAmount += parseFloat(inv.grand_total) || 0;
      } else {
        pendingAmount += parseFloat(inv.grand_total) || 0;
      }
    });

    const customersCountRes = await db.get('SELECT COUNT(*) as count FROM customers WHERE user_id = ?', [req.user.id]);
    const productsCountRes = await db.get('SELECT COUNT(*) as count FROM products WHERE user_id = ?', [req.user.id]);
    const recentCustomers = await db.query(
      'SELECT * FROM customers WHERE user_id = ? ORDER BY id DESC LIMIT 5',
      [req.user.id]
    );

    const totalBills = invoices.length;
    const roundedSales = Math.round(totalSales * 100) / 100;
    const roundedTaxable = Math.round(totalTaxable * 100) / 100;
    const roundedCgst = Math.round(totalCgst * 100) / 100;
    const roundedSgst = Math.round(totalSgst * 100) / 100;
    const roundedIgst = Math.round(totalIgst * 100) / 100;
    const roundedGst = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;
    const roundedPaid = Math.round(paidAmount * 100) / 100;
    const roundedPending = Math.round(pendingAmount * 100) / 100;
    const totalCustomers = customersCountRes ? (customersCountRes.count || 0) : 0;
    const totalProducts = productsCountRes ? (productsCountRes.count || 0) : 0;

    const statsObj = {
      total_bills: totalBills,
      total_sales: roundedSales,
      total_taxable: roundedTaxable,
      total_gst: roundedGst,
      total_cgst: roundedCgst,
      total_sgst: roundedSgst,
      total_igst: roundedIgst,
      paid_amount: roundedPaid,
      unpaid_amount: roundedPending,
      total_customers: totalCustomers,
      total_products: totalProducts
    };

    return res.json({
      success: true,
      stats: statsObj,
      summary: {
        totalInvoices: totalBills,
        totalSales: roundedSales,
        totalTaxable: roundedTaxable,
        totalGst: roundedGst,
        totalCgst: roundedCgst,
        totalSgst: roundedSgst,
        totalIgst: roundedIgst,
        paidAmount: roundedPaid,
        pendingAmount: roundedPending,
        totalCustomers: totalCustomers,
        totalProducts: totalProducts
      },
      recent_bills: invoices.slice(0, 10),
      recentInvoices: invoices.slice(0, 10),
      recent_customers: recentCustomers || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDetailedReports = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [req.user.id];

    if (start_date) {
      dateFilter += ' AND invoice_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND invoice_date <= ?';
      params.push(end_date);
    }

    const isPg = typeof db.isPostgres === 'function' ? db.isPostgres() : !!db.isPostgres;
    const dateExpr = isPg ? "TO_CHAR(invoice_date, 'YYYY-MM-DD')" : "DATE_FORMAT(invoice_date, '%Y-%m-%d')";
    const castNum = isPg ? '::numeric' : '';

    // 1. Daily / Date-wise sales
    const dailySales = await db.query(
      `SELECT 
        ${dateExpr} as date,
        COUNT(*) as invoice_count,
        ROUND(COALESCE(SUM(taxable_amount), 0)${castNum}, 2) as taxable,
        ROUND(COALESCE(SUM(total_gst), 0)${castNum}, 2) as gst,
        ROUND(COALESCE(SUM(grand_total), 0)${castNum}, 2) as total
       FROM invoices
       WHERE user_id = ? ${dateFilter}
       GROUP BY ${dateExpr}
       ORDER BY date DESC`,
      params
    );

    // 2. Customer-wise sales
    const customerSales = await db.query(
      `SELECT 
        customer_name,
        COUNT(*) as total_invoices,
        ROUND(COALESCE(SUM(grand_total), 0)${castNum}, 2) as total_spent,
        ROUND(COALESCE(SUM(total_gst), 0)${castNum}, 2) as total_gst
       FROM invoices
       WHERE user_id = ? ${dateFilter}
       GROUP BY customer_name
       ORDER BY total_spent DESC`,
      params
    );

    // 3. Product / Item-wise sales
    const itemFilterParams = [req.user.id];
    let itemDateFilter = '';
    if (start_date) {
      itemDateFilter += ' AND inv.invoice_date >= ?';
      itemFilterParams.push(start_date);
    }
    if (end_date) {
      itemDateFilter += ' AND inv.invoice_date <= ?';
      itemFilterParams.push(end_date);
    }

    const productSales = await db.query(
      `SELECT 
        ii.description as product_name,
        ROUND(COALESCE(SUM(ii.quantity), 0)${castNum}, 2) as total_quantity,
        ROUND(COALESCE(SUM(ii.sq_ft), 0)${castNum}, 2) as total_sq_ft,
        ROUND(COALESCE(SUM(ii.total_amount), 0)${castNum}, 2) as total_revenue
       FROM invoice_items ii
       JOIN invoices inv ON ii.invoice_id = inv.id
       WHERE inv.user_id = ? ${itemDateFilter}
       GROUP BY ii.description
       ORDER BY total_revenue DESC`,
      itemFilterParams
    );

    return res.json({
      success: true,
      daily_sales: dailySales || [],
      customer_sales: customerSales || [],
      product_sales: productSales || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


const { numberToIndianWords } = require('./numberToIndianWords');

function calculateInvoiceTotals(
  items = [],
  companyStateCode = '27',
  customerStateCode = '27',
  manualIsInterState = null,
  billGstRate = null,
  applyGstOnTotal = true
) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableAmount = 0;
  let totalGst = 0;

  // Determine effective bill GST rate if applying GST on total bill
  const isBillGst = applyGstOnTotal && billGstRate !== null && billGstRate !== undefined;
  const effectiveBillGstRate = isBillGst ? parseFloat(billGstRate) : null;

  const processedItems = items.map((item, index) => {
    const qty = isNaN(parseFloat(item.quantity)) ? 0 : parseFloat(item.quantity);
    const rate = parseFloat(item.rate) || 0;
    const sqFt = parseFloat(item.sq_ft) || 0;
    const discount = parseFloat(item.discount) || 0;
    const itemGstRate = isBillGst ? effectiveBillGstRate : (parseFloat(item.gst_rate) || 0);

    const multiplier = sqFt > 0 ? sqFt : qty;
    const rawTotal = multiplier * rate;
    const lineDiscount = discount;
    const lineTaxable = Math.max(0, rawTotal - lineDiscount);
    const lineGst = (lineTaxable * itemGstRate) / 100;
    // Row total is base taxable amount (quantity * rate - discount)
    const lineTotal = lineTaxable;

    subtotal += rawTotal;
    discountTotal += lineDiscount;
    taxableAmount += lineTaxable;
    totalGst += lineGst;

    return {
      ...item,
      item_no: item.item_no || index + 1,
      product_id: item.product_id || null,
      description: item.description || '',
      sq_ft: sqFt,
      quantity: qty,
      unit: item.unit || 'Nos',
      rate: rate,
      discount: lineDiscount,
      taxable_value: Math.round(lineTaxable * 100) / 100,
      gst_rate: itemGstRate,
      gst_amount: Math.round(lineGst * 100) / 100,
      total_amount: Math.round(lineTotal * 100) / 100
    };
  });

  // If applying GST on total bill, calculate GST directly from total taxable amount
  if (isBillGst) {
    totalGst = Math.round(((taxableAmount * effectiveBillGstRate) / 100) * 100) / 100;
  }

  const isInterState = manualIsInterState !== null
    ? Boolean(manualIsInterState)
    : (companyStateCode && customerStateCode && companyStateCode.trim().toLowerCase() !== customerStateCode.trim().toLowerCase());

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = Math.round(totalGst * 100) / 100;
  } else {
    cgstAmount = Math.round((totalGst / 2) * 100) / 100;
    sgstAmount = Math.round((totalGst / 2) * 100) / 100;
  }

  const grandTotal = Math.round((taxableAmount + totalGst) * 100) / 100;
  const amountInWords = numberToIndianWords(grandTotal);

  return {
    items: processedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    discount_total: Math.round(discountTotal * 100) / 100,
    taxable_amount: Math.round(taxableAmount * 100) / 100,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    total_gst: Math.round(totalGst * 100) / 100,
    grand_total: grandTotal,
    amount_in_words: amountInWords,
    is_inter_state: isInterState,
    bill_gst_rate: effectiveBillGstRate
  };
}

module.exports = { calculateInvoiceTotals };

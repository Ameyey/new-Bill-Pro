export const DEFAULT_ITEM_COLUMNS = [
  { id: 'item_no', key: 'item_no', label: '#', defaultLabel: '#', visible: true, fixed: true, width: 'w-8 text-center' },
  { id: 'catalog', key: 'catalog', label: 'Catalog Select', defaultLabel: 'Catalog Select', visible: true, deletable: true, width: 'w-44' },
  { id: 'description', key: 'description', label: 'Description', defaultLabel: 'Description', visible: true, required: true, width: 'min-w-[180px]' },
  { id: 'sq_ft', key: 'sq_ft', label: 'Sq.Ft', defaultLabel: 'Sq.Ft', visible: true, deletable: true, isNumeric: true, width: 'w-20 text-center' },
  { id: 'quantity', key: 'quantity', label: 'Qty', defaultLabel: 'Qty', visible: true, required: true, isNumeric: true, width: 'w-16 text-center' },
  { id: 'unit', key: 'unit', label: 'Unit', defaultLabel: 'Unit', visible: true, deletable: true, width: 'w-16 text-center' },
  { id: 'rate', key: 'rate', label: 'Rate (₹)', defaultLabel: 'Rate (₹)', visible: true, required: true, isNumeric: true, width: 'w-20 text-right' },
  { id: 'discount', key: 'discount', label: 'Disc', defaultLabel: 'Disc', visible: false, deletable: true, isNumeric: true, width: 'w-16 text-right' },
  { id: 'gst_rate', key: 'gst_rate', label: 'GST %', defaultLabel: 'GST %', visible: false, deletable: true, width: 'w-20 text-center' },
  { id: 'total', key: 'total', label: 'Total (₹)', defaultLabel: 'Total (₹)', visible: true, fixed: true, width: 'w-24 text-right' }
];

export const DEFAULT_DC_FIELDS = [
  { id: 'invoice_no', key: 'invoiceNumber', label: 'Invoice No.', defaultLabel: 'Invoice No.', visible: true, required: true },
  { id: 'invoice_date', key: 'invoiceDate', label: 'Invoice Dated', defaultLabel: 'Invoice Dated', visible: true, required: true, type: 'date' },
  { id: 'in_dc_no', key: 'inDcNo', label: 'IN D.C. No.', defaultLabel: 'IN D.C. No.', visible: true, deletable: true, placeholder: 'e.g. IN-104' },
  { id: 'in_dc_date', key: 'inDcDate', label: 'IN D.C. Date', defaultLabel: 'IN D.C. Date', visible: true, deletable: true, type: 'date' },
  { id: 'out_dc_no', key: 'outDcNo', label: 'OUT D.C. No.', defaultLabel: 'OUT D.C. No.', visible: true, deletable: true, placeholder: '432' },
  { id: 'out_dc_date', key: 'outDcDate', label: 'OUT D.C. Date', defaultLabel: 'OUT D.C. Date', visible: true, deletable: true, type: 'date' }
];

export const DEFAULT_HEADER_PREFERENCES = {
  showInvoiceTitle: true,
  invoiceTitle: 'INVOICE',
  showCenterDivider: true,
  showLogo: true,
  logoUrl: '',
  showCompanyName: true,
  companyFontSize: 24, // px value, default 24
  companyFontWeight: 'black', // 'normal', 'bold', 'black'
  companyFontFamily: 'serif', // 'sans', 'serif', 'mono'
  companyItalic: false, // boolean
  companyUppercase: true, // boolean
  companyAlign: 'center', // 'left', 'center', 'right'
  taglineFontSize: 11, // px value, default 11
  showAddress: true,
  hideHeader: false,
  logoWidth: 180,
  logoHeight: 65,
  addressFontSize: 11.5, // numeric px value or 'xs', 'sm', 'md'
  addressFontWeight: 'semibold', // 'normal', 'semibold', 'bold'
  addressAlign: 'right', // 'left', 'center', 'right'
  addressFontFamily: 'sans', // 'sans', 'serif', 'mono'
  addressItalic: false, // boolean
  addressUppercase: false, // boolean
  customWorksAddress: ''
};

export const STORAGE_KEY = 'billpro_column_preferences';
export const CUSTOMER_PREFS_PREFIX = 'billpro_company_prefs_';

/**
 * Normalizes item columns to guarantee:
 * 1. 'Total (₹)' is ALWAYS the final rightmost column.
 * 2. Standard columns follow logical business order:
 *    [item_no, catalog, description, sq_ft, (custom_columns), quantity, unit, rate, discount, gst_rate, total]
 * 3. Never duplicates columns or leaves unit/discount/gst after total.
 */
export function normalizeItemColumns(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return JSON.parse(JSON.stringify(DEFAULT_ITEM_COLUMNS));
  }

  // Find or construct the fixed total column
  const existingTotal = columns.find(c => c.id === 'total');
  const defaultTotal = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'total');
  const totalCol = {
    ...defaultTotal,
    ...(existingTotal || {}),
    id: 'total',
    key: 'total',
    label: existingTotal?.label || 'Total (₹)',
    defaultLabel: 'Total (₹)',
    visible: true,
    fixed: true,
    deletable: false,
    width: 'w-24 text-right'
  };

  const STANDARD_WEIGHTS = {
    item_no: 10,
    catalog: 20,
    description: 30,
    sq_ft: 40,
    quantity: 60,
    unit: 70,
    rate: 80,
    discount: 90,
    gst_rate: 100
  };

  const withoutTotal = columns.filter(c => c.id !== 'total');
  const standardCols = [];
  const customCols = [];

  withoutTotal.forEach(col => {
    if (STANDARD_WEIGHTS[col.id] !== undefined) {
      const def = DEFAULT_ITEM_COLUMNS.find(d => d.id === col.id);
      standardCols.push({
        ...def,
        ...col,
        weight: STANDARD_WEIGHTS[col.id]
      });
    } else {
      customCols.push({
        ...col,
        isCustom: true,
        deletable: true,
        weight: 50 // Placed between sq_ft (40) and quantity (60)
      });
    }
  });

  standardCols.sort((a, b) => a.weight - b.weight);

  const beforeCustom = standardCols.filter(c => c.weight <= 40);
  const afterCustom = standardCols.filter(c => c.weight >= 60);

  const cleanItem = (c) => {
    const { weight, ...rest } = c;
    return rest;
  };

  return [
    ...beforeCustom.map(cleanItem),
    ...customCols.map(cleanItem),
    ...afterCustom.map(cleanItem),
    totalCol
  ];
}

export function getCompanyColumnPreferences(companyId) {
  if (!companyId) return null;
  try {
    const raw = localStorage.getItem(`${CUSTOMER_PREFS_PREFIX}${companyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.itemColumns)) {
        parsed.itemColumns = normalizeItemColumns(parsed.itemColumns);
      }
      return parsed;
    }
  } catch (e) {}
  return null;
}

export function saveCompanyColumnPreferences(companyId, preferences) {
  if (!companyId || !preferences) return;
  try {
    const toSave = {
      ...preferences,
      itemColumns: preferences.itemColumns ? normalizeItemColumns(preferences.itemColumns) : undefined
    };
    localStorage.setItem(`${CUSTOMER_PREFS_PREFIX}${companyId}`, JSON.stringify(toSave));
  } catch (e) {}
}

export function getStoredPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        itemColumns: DEFAULT_ITEM_COLUMNS,
        dcFields: DEFAULT_DC_FIELDS,
        headerPreferences: DEFAULT_HEADER_PREFERENCES
      };
    }
    const parsed = JSON.parse(raw);
    return {
      itemColumns: normalizeItemColumns(parsed.itemColumns),
      dcFields: Array.isArray(parsed.dcFields) 
        ? parsed.dcFields.map(f => {
            if (f.label === 'Invoice .No') return { ...f, label: 'Invoice No.', defaultLabel: 'Invoice No.' };
            if (f.label === 'IN D.C.No') return { ...f, label: 'IN D.C. No.', defaultLabel: 'IN D.C. No.' };
            if (f.label === 'OUT D.C No') return { ...f, label: 'OUT D.C. No.', defaultLabel: 'OUT D.C. No.' };
            return f;
          })
        : DEFAULT_DC_FIELDS,
      headerPreferences: {
        ...DEFAULT_HEADER_PREFERENCES,
        ...(parsed.headerPreferences || {})
      }
    };
  } catch (e) {
    return {
      itemColumns: DEFAULT_ITEM_COLUMNS,
      dcFields: DEFAULT_DC_FIELDS,
      headerPreferences: DEFAULT_HEADER_PREFERENCES
    };
  }
}

export function saveStoredPreferences(preferences) {
  try {
    const existing = getStoredPreferences();
    const merged = {
      itemColumns: normalizeItemColumns(preferences.itemColumns || existing.itemColumns),
      dcFields: preferences.dcFields || existing.dcFields,
      headerPreferences: {
        ...existing.headerPreferences,
        ...(preferences.headerPreferences || {})
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Failed to save column preferences:', e);
  }
}

/**
 * Resolves the effective column preferences for an invoice.
 * Guarantees that historical invoices preserve columns that have data,
 * while respecting any explicit user customization on new bills and templates.
 */
export function getInvoiceEffectivePreferences(invoice) {
  const hasExplicitPrefs = Boolean(
    invoice?.column_preferences &&
    typeof invoice.column_preferences === 'object' &&
    Array.isArray(invoice.column_preferences.itemColumns)
  );

  const basePrefs = hasExplicitPrefs
    ? invoice.column_preferences
    : getStoredPreferences();

  let prefs;
  try {
    prefs = JSON.parse(JSON.stringify(basePrefs || {}));
  } catch (e) {
    prefs = {};
  }

  // Ensure default structures exist and are normalized
  if (!Array.isArray(prefs.itemColumns) || prefs.itemColumns.length === 0) {
    prefs.itemColumns = JSON.parse(JSON.stringify(DEFAULT_ITEM_COLUMNS));
  } else {
    prefs.itemColumns = normalizeItemColumns(prefs.itemColumns);
  }
  if (!Array.isArray(prefs.dcFields) || prefs.dcFields.length === 0) {
    prefs.dcFields = JSON.parse(JSON.stringify(DEFAULT_DC_FIELDS));
  }

  if (invoice) {
    // 1. Core DC fields preservation on saved invoices with an id
    const isSavedHistoricalBill = Boolean(invoice.id);

    const dcDataChecks = [
      { id: 'invoice_no', hasData: Boolean(invoice.invoice_number) },
      { id: 'invoice_date', hasData: Boolean(invoice.invoice_date) },
      { id: 'in_dc_no', hasData: Boolean(invoice.in_dc_no && String(invoice.in_dc_no).trim()) },
      { id: 'in_dc_date', hasData: Boolean(invoice.in_dc_date && String(invoice.in_dc_date).trim()) },
      { id: 'out_dc_no', hasData: Boolean(invoice.out_dc_no && String(invoice.out_dc_no).trim()) },
      { id: 'out_dc_date', hasData: Boolean(invoice.out_dc_date && String(invoice.out_dc_date).trim()) }
    ];

    dcDataChecks.forEach(({ id, hasData }) => {
      if (hasData) {
        let field = prefs.dcFields.find(f => f.id === id);
        if (field) {
          // If field exists, only force visible if historical bill without explicit prefs
          if (!hasExplicitPrefs || isSavedHistoricalBill) {
            field.visible = true;
          }
        } else if (isSavedHistoricalBill) {
          const defaultField = DEFAULT_DC_FIELDS.find(f => f.id === id);
          if (defaultField) {
            prefs.dcFields.push({ ...defaultField, visible: true });
          }
        }
      }
    });

    // 2. Custom DC values (Only preserve on existing historical saved invoices with an id)
    const customValues = invoice.custom_dc_values || {};
    if (isSavedHistoricalBill && typeof customValues === 'object') {
      Object.entries(customValues).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim().length > 0) {
          const field = prefs.dcFields.find(f => f.id === k || f.key === k);
          if (field) {
            field.visible = true;
            field.deletable = true;
          } else {
            const cleanLabel = k.replace(/^custom_dc_/i, '').replace(/_\d+$/, '').replace(/_/g, ' ').toUpperCase();
            if (cleanLabel) {
              prefs.dcFields.push({
                id: k,
                key: k,
                label: cleanLabel,
                visible: true,
                isCustom: true,
                deletable: true
              });
            }
          }
        }
      });
    }

    // Filter out any custom DC fields that have empty or blank labels
    prefs.dcFields = (prefs.dcFields || []).filter(f => !f.isCustom || (f.label && f.label.trim().length > 0));
    prefs.dcFields = prefs.dcFields.map(f => f.isCustom ? { ...f, deletable: true } : f);

    // 3. Product / Item Columns preservation:
    // If the invoice already has explicit column_preferences, RESPECT THEM (do not force deleted columns back!)
    // Only resurrect missing columns if it's a saved historical bill that lacked saved column_preferences!
    if (isSavedHistoricalBill && !hasExplicitPrefs && Array.isArray(invoice.items) && invoice.items.length > 0) {
      const hasSqFt = invoice.items.some(it => it.sq_ft !== null && it.sq_ft !== undefined && String(it.sq_ft).trim() !== '' && Number(it.sq_ft) !== 0);
      if (hasSqFt) {
        let col = prefs.itemColumns.find(c => c.id === 'sq_ft');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'sq_ft');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      const hasUnit = invoice.items.some(it => it.unit && String(it.unit).trim().length > 0);
      if (hasUnit) {
        let col = prefs.itemColumns.find(c => c.id === 'unit');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'unit');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      const hasDisc = invoice.items.some(it => it.discount !== null && it.discount !== undefined && Number(it.discount) > 0);
      if (hasDisc) {
        let col = prefs.itemColumns.find(c => c.id === 'discount');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'discount');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      const hasGst = invoice.items.some(it => it.gst_rate !== null && it.gst_rate !== undefined && String(it.gst_rate).trim() !== '');
      if (hasGst) {
        let col = prefs.itemColumns.find(c => c.id === 'gst_rate');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'gst_rate');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      // Check for any custom item properties
      invoice.items.forEach(it => {
        if (!it || typeof it !== 'object') return;
        Object.keys(it).forEach(k => {
          if (k.startsWith('custom_') && it[k] !== null && it[k] !== undefined && String(it[k]).trim().length > 0) {
            let col = prefs.itemColumns.find(c => c.key === k || c.id === k);
            if (!col) {
              const cleanLabel = k.replace(/^custom_/i, '').replace(/_\d+$/, '').replace(/_/g, ' ').toUpperCase();
              prefs.itemColumns.push({
                id: k,
                key: k,
                label: cleanLabel || 'Custom',
                defaultLabel: cleanLabel || 'Custom',
                visible: true,
                deletable: true,
                isCustom: true,
                width: 'w-24 text-center'
              });
            } else {
              col.visible = true;
            }
          }
        });
      });
    }
  }

  // Always ensure strict normalized order with 'total' as the final rightmost column
  prefs.itemColumns = normalizeItemColumns(prefs.itemColumns);

  return prefs;
}

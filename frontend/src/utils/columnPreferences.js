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

export function getCompanyColumnPreferences(companyId) {
  if (!companyId) return null;
  try {
    const raw = localStorage.getItem(`${CUSTOMER_PREFS_PREFIX}${companyId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

export function saveCompanyColumnPreferences(companyId, preferences) {
  if (!companyId || !preferences) return;
  try {
    localStorage.setItem(`${CUSTOMER_PREFS_PREFIX}${companyId}`, JSON.stringify(preferences));
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
      itemColumns: Array.isArray(parsed.itemColumns) 
        ? parsed.itemColumns
        : DEFAULT_ITEM_COLUMNS,
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
      itemColumns: preferences.itemColumns || existing.itemColumns,
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
 * Guarantees that historical invoices preserve all columns and DC fields that have data.
 * Adding/removing/hiding columns on new bills will NEVER hide or change data on existing bills.
 */
export function getInvoiceEffectivePreferences(invoice) {
  // If invoice has its own saved column_preferences, prioritize them
  const basePrefs = invoice?.column_preferences && typeof invoice.column_preferences === 'object'
    ? invoice.column_preferences
    : getStoredPreferences();

  // Deep clone so we do not mutate stored preferences
  let prefs;
  try {
    prefs = JSON.parse(JSON.stringify(basePrefs || {}));
  } catch (e) {
    prefs = {};
  }

  // Ensure default structures exist
  if (!Array.isArray(prefs.itemColumns) || prefs.itemColumns.length === 0) {
    prefs.itemColumns = JSON.parse(JSON.stringify(DEFAULT_ITEM_COLUMNS));
  }
  if (!Array.isArray(prefs.dcFields) || prefs.dcFields.length === 0) {
    prefs.dcFields = JSON.parse(JSON.stringify(DEFAULT_DC_FIELDS));
  }

  // HISTORICAL PRESERVATION GUARANTEE:
  // If this invoice historically contains data in any DC field, ensure that field is VISIBLE!
  if (invoice) {
    // 1. Core DC fields
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
          field.visible = true;
        } else {
          // If field was deleted from template, restore it from defaults as visible
          const defaultField = DEFAULT_DC_FIELDS.find(f => f.id === id);
          if (defaultField) {
            prefs.dcFields.push({ ...defaultField, visible: true });
          }
        }
      }
    });

    // 2. Custom DC values
    const customValues = invoice.custom_dc_values || {};
    if (typeof customValues === 'object') {
      Object.entries(customValues).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim().length > 0) {
          const field = prefs.dcFields.find(f => f.id === k || f.key === k);
          if (field) {
            field.visible = true;
          } else {
            // Restore custom field into list so its label and value render
            prefs.dcFields.push({
              id: k,
              key: k,
              label: k.replace(/_/g, ' ').toUpperCase(),
              visible: true,
              isCustom: true
            });
          }
        }
      });
    }

    // 3. Product / Item Columns preservation
    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      // Check sq_ft
      const hasSqFt = invoice.items.some(it => it.sq_ft !== null && it.sq_ft !== undefined && String(it.sq_ft).trim() !== '' && Number(it.sq_ft) !== 0);
      if (hasSqFt) {
        let col = prefs.itemColumns.find(c => c.id === 'sq_ft');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'sq_ft');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      // Check unit
      const hasUnit = invoice.items.some(it => it.unit && String(it.unit).trim().length > 0);
      if (hasUnit) {
        let col = prefs.itemColumns.find(c => c.id === 'unit');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'unit');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      // Check discount
      const hasDisc = invoice.items.some(it => it.discount !== null && it.discount !== undefined && Number(it.discount) > 0);
      if (hasDisc) {
        let col = prefs.itemColumns.find(c => c.id === 'discount');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'discount');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }

      // Check gst_rate
      const hasGst = invoice.items.some(it => it.gst_rate !== null && it.gst_rate !== undefined && String(it.gst_rate).trim() !== '');
      if (hasGst) {
        let col = prefs.itemColumns.find(c => c.id === 'gst_rate');
        if (col) col.visible = true;
        else {
          const def = DEFAULT_ITEM_COLUMNS.find(c => c.id === 'gst_rate');
          if (def) prefs.itemColumns.push({ ...def, visible: true });
        }
      }
    }
  }

  return prefs;
}

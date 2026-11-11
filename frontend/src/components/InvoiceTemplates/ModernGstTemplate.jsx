import React from 'react';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import { getStoredPreferences, getInvoiceEffectivePreferences } from '../../utils/columnPreferences';

export default function ModernGstTemplate({ invoice, company, headerPreferences }) {
  if (!invoice) return null;

  const comp = { ...(invoice.company || {}), ...(company || {}) };
  if (!comp.logo_url && invoice?.company?.logo_url) {
    comp.logo_url = invoice.company.logo_url;
  }
  if (!comp.company_name && invoice?.company?.company_name) {
    comp.company_name = invoice.company.company_name;
  }
  const items = invoice.items || [];
  const prefs = getInvoiceEffectivePreferences(invoice);
  const rawVisibleCols = (prefs?.itemColumns || []).filter(c => c.visible && c.id !== 'catalog');
  const existingTotal = rawVisibleCols.find(c => c.id === 'total');
  const totalCol = existingTotal || { id: 'total', key: 'total', label: 'Total (₹)', defaultLabel: 'Total (₹)', visible: true };
  const visibleCols = [...rawVisibleCols.filter(c => c.id !== 'total'), totalCol];

  const inDcField = prefs?.dcFields?.find(f => f.id === 'in_dc_no');
  const showInDc = Boolean((inDcField && inDcField.visible) || (invoice.in_dc_no && String(invoice.in_dc_no).trim()));
  const inDcDateField = prefs?.dcFields?.find(f => f.id === 'in_dc_date');
  const showInDcDate = Boolean((inDcDateField && inDcDateField.visible) || (invoice.in_dc_date && String(invoice.in_dc_date).trim()));

  const outDcField = prefs?.dcFields?.find(f => f.id === 'out_dc_no');
  const showOutDc = Boolean((outDcField && outDcField.visible) || (invoice.out_dc_no && String(invoice.out_dc_no).trim()));
  const outDcDateField = prefs?.dcFields?.find(f => f.id === 'out_dc_date');
  const showOutDcDate = Boolean((outDcDateField && outDcDateField.visible) || (invoice.out_dc_date && String(invoice.out_dc_date).trim()));

  const customDcRows = (prefs?.dcFields || []).filter(f => f.isCustom && f.visible);

  const headerPrefs = headerPreferences || invoice.header_preferences || prefs.headerPreferences || {
    showLogo: true,
    showCompanyName: false,
    showAddress: true,
    hideHeader: false,
    logoWidth: 180,
    logoHeight: 65
  };

  const logoSrc =
    headerPrefs?.logoUrl ||
    (Array.isArray(invoice?.images) ? invoice.images.find(img => img.image_slot === 1 || img.image_type === 'logo')?.file_path : '') ||
    comp?.logo_url ||
    comp?.logo ||
    company?.logo_url ||
    invoice?.company?.logo_url ||
    invoice?.image1_url ||
    invoice?.logo_url ||
    '';
  const logoWidth = Number(headerPrefs?.logoWidth) || 180;
  const logoHeight = Number(headerPrefs?.logoHeight) || 65;

  const displayCompanyName = comp.company_name || '';
  const displayTagline = comp.tagline || '';

  const companyFontSizePx =
    typeof headerPrefs.companyFontSize === 'number'
      ? headerPrefs.companyFontSize
      : headerPrefs.companyFontSize === 'sm'
        ? 18
        : headerPrefs.companyFontSize === 'md'
          ? 24
          : headerPrefs.companyFontSize === 'lg'
            ? 30
            : headerPrefs.companyFontSize === 'xl'
              ? 36
              : parseFloat(headerPrefs.companyFontSize) || 24;

  const taglineFontSizePx =
    typeof headerPrefs.taglineFontSize === 'number'
      ? headerPrefs.taglineFontSize
      : parseFloat(headerPrefs.taglineFontSize) || 11;

  const companyFontFamilyClass =
    headerPrefs.companyFontFamily === 'mono'
      ? 'font-mono'
      : headerPrefs.companyFontFamily === 'sans'
        ? 'font-sans'
        : 'font-serif';

  const companyFontWeightStyle =
    headerPrefs.companyFontWeight === 'normal'
      ? '400'
      : headerPrefs.companyFontWeight === 'bold'
        ? '700'
        : '900';

  const companyAlignClass =
    headerPrefs.companyAlign === 'left'
      ? 'text-left items-start'
      : headerPrefs.companyAlign === 'right'
        ? 'text-right items-end'
        : 'text-left items-start';

  const companyTransform = headerPrefs.companyUppercase !== false ? 'uppercase' : 'normal-case';
  const companyItalicClass = headerPrefs.companyItalic ? 'italic' : '';

  return (
    <div className="invoice-paper bg-white text-slate-800 font-sans text-xs leading-relaxed min-w-[720px] max-w-[820px] w-full mx-auto border border-slate-300 rounded-lg shadow-sm p-6 select-text">
      {/* Top Header */}
      {!headerPrefs.hideHeader ? (
        <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-5">
          <div className="flex items-center gap-4">
            {headerPrefs.showLogo && logoSrc && (
              <img
                src={logoSrc}
                alt="Logo"
                style={{
                  width: `${logoWidth}px`,
                  height: `${logoHeight}px`,
                  maxWidth: '100%',
                  objectFit: 'contain',
                  objectPosition: 'left center'
                }}
                className="object-contain rounded"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div>
              {headerPrefs.showCompanyName && (
                <div className="py-0.5">
                  <h1
                    style={{
                      fontSize: `${companyFontSizePx}px`,
                      fontWeight: companyFontWeightStyle,
                      lineHeight: 1.15
                    }}
                    className={`tracking-tight text-slate-900 ${companyFontFamilyClass} ${companyTransform} ${companyItalicClass}`}
                  >
                    {displayCompanyName}
                  </h1>
                  {displayTagline && (
                    <p
                      style={{
                        fontSize: `${taglineFontSizePx}px`,
                        lineHeight: 1.25
                      }}
                      className="text-slate-500 font-medium mt-0.5"
                    >
                      {displayTagline}
                    </p>
                  )}
                </div>
              )}
              {headerPrefs.showAddress !== false && (
                <div
                  style={{
                    fontSize: `${typeof headerPrefs.addressFontSize === 'number'
                        ? headerPrefs.addressFontSize
                        : headerPrefs.addressFontSize === 'xs'
                          ? 10
                          : headerPrefs.addressFontSize === 'md'
                            ? 13.5
                            : parseFloat(headerPrefs.addressFontSize) || 11.5
                      }px`
                  }}
                  className={`mt-1 max-w-sm ${headerPrefs.addressAlign === 'center'
                      ? 'text-center'
                      : headerPrefs.addressAlign === 'right'
                        ? 'text-right'
                        : 'text-left'
                    } ${headerPrefs.addressFontWeight === 'normal'
                      ? 'font-normal'
                      : headerPrefs.addressFontWeight === 'bold'
                        ? 'font-bold'
                        : 'font-medium'
                    } ${headerPrefs.addressFontFamily === 'serif'
                      ? 'font-serif'
                      : headerPrefs.addressFontFamily === 'mono'
                        ? 'font-mono'
                        : 'font-sans'
                    } ${headerPrefs.addressItalic ? 'italic' : ''} ${headerPrefs.addressUppercase ? 'uppercase' : ''
                    }`}
                >
                  <p className="text-slate-600 whitespace-pre-line">
                    {headerPrefs.customWorksAddress || comp.works_address || comp.address}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600 mt-1.5 font-medium">
                    <span><strong>GSTIN:</strong> {comp.gstin || '-'}</span>
                    <span><strong>PAN:</strong> {comp.pan || '-'}</span>
                    <span><strong>Phone:</strong> {comp.phone}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 font-extrabold text-sm uppercase rounded-lg border border-brand-200">
              {headerPrefs?.invoiceTitle || invoice.invoice_title || 'TAX INVOICE'}
            </span>
            <div className="mt-3 space-y-1 text-xs">
              <div><span className="text-slate-500">Invoice No:</span> <strong className="text-slate-900 font-mono text-sm">{invoice.invoice_number}</strong></div>
              <div><span className="text-slate-500">Date:</span> <span className="font-semibold">{formatDate(invoice.invoice_date)}</span></div>
              {invoice.due_date && <div><span className="text-slate-500">Due Date:</span> <span>{formatDate(invoice.due_date)}</span></div>}
              {invoice.out_dc_no && <div><span className="text-slate-500">Out D.C No:</span> <strong className="font-mono">{invoice.out_dc_no}</strong></div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-20 border-b border-slate-200 pb-2 mb-5 flex justify-between items-end">
          <span className="text-[11px] font-bold text-slate-400 italic">Pre-printed Letterhead Margin</span>
          <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 font-extrabold text-sm uppercase rounded-lg border border-brand-200">
            {headerPrefs?.invoiceTitle || invoice.invoice_title || 'TAX INVOICE'}
          </span>
        </div>
      )}

      {/* Bill To & Dispatch */}
      <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Billed To (Customer)</span>
          <h4 className="text-sm font-bold text-slate-900">{invoice.customer_name}</h4>
          <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">{invoice.customer_address}</p>
          <p className="text-xs text-slate-600">{invoice.customer_city} {invoice.customer_state ? `(${invoice.customer_state})` : ''} - {invoice.customer_pincode}</p>
          <div className="mt-2 text-xs font-semibold text-brand-900 bg-white p-2 rounded-lg border border-slate-200">
            GSTIN: <span className="font-mono">{invoice.selected_gst_number || invoice.customer_gst_number || 'URP / Not Registered'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Challan & Place of Supply</span>
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Place of Supply:</span>
              <span className="font-semibold">{invoice.customer_state || comp.state || 'Maharashtra'}</span>
            </div>
            {(showInDc || showInDcDate) && (
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {showInDc ? (inDcField?.label || 'In D.C. No') : (inDcDateField?.label || 'In D.C. Date')}:
                </span>
                <span className="font-mono">
                  {showInDc && (invoice.in_dc_no || '-')}
                  {showInDc && showInDcDate && invoice.in_dc_date ? ` (${formatDate(invoice.in_dc_date)})` : ''}
                  {!showInDc && showInDcDate && (invoice.in_dc_date ? formatDate(invoice.in_dc_date) : '-')}
                </span>
              </div>
            )}
            {(showOutDc || showOutDcDate) && (
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {showOutDc ? (outDcField?.label || 'Out D.C. No') : (outDcDateField?.label || 'Out D.C. Date')}:
                </span>
                <span className="font-mono">
                  {showOutDc && (invoice.out_dc_no || '-')}
                  {showOutDc && showOutDcDate && invoice.out_dc_date ? ` (${formatDate(invoice.out_dc_date)})` : ''}
                  {!showOutDc && showOutDcDate && (invoice.out_dc_date ? formatDate(invoice.out_dc_date) : '-')}
                </span>
              </div>
            )}
            {customDcRows.map(f => (
              <div key={f.id} className="flex justify-between">
                <span className="text-slate-500">{f.label}:</span>
                <span className="font-mono">{f.type === 'date' && invoice.custom_dc_values?.[f.key] ? formatDate(invoice.custom_dc_values[f.key]) : (invoice.custom_dc_values?.[f.key] || invoice[f.key] || '-')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-xs border-collapse mb-5">
        <thead>
          <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
            {visibleCols.map((col) => (
              <th
                key={col.id}
                className={`py-2 px-2.5 ${col.id === 'item_no' ? 'text-center w-8' :
                    col.id === 'description' ? 'text-left' :
                      col.id === 'total' ? 'text-right w-24' :
                        col.isNumeric ? 'text-right w-16' :
                          'text-center w-16'
                  }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-slate-50/50">
              {visibleCols.map((col) => {
                if (col.id === 'item_no') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center text-slate-400 font-mono">
                      {item.item_no || idx + 1}
                    </td>
                  );
                }
                if (col.id === 'description') {
                  return (
                    <td key={col.id} className="py-2.5 px-2.5 font-medium text-slate-900">
                      {item.description}
                      {item.hsn_sac && <span className="block text-[10px] text-slate-400">HSN/SAC: {item.hsn_sac}</span>}
                    </td>
                  );
                }
                if (col.id === 'sq_ft') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center font-mono">
                      {item.sq_ft > 0 ? `${item.sq_ft}` : '-'}
                    </td>
                  );
                }
                if (col.id === 'quantity') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center font-mono">
                      {item.quantity} {item.unit ? <span className="text-[10px] text-slate-500">{item.unit}</span> : ''}
                    </td>
                  );
                }
                if (col.id === 'unit') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center font-mono">
                      {item.unit || 'Nos'}
                    </td>
                  );
                }
                if (col.id === 'rate') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-right font-mono">
                      {formatNumber(item.rate)}
                    </td>
                  );
                }
                if (col.id === 'discount') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-right font-mono">
                      {item.discount > 0 ? formatNumber(item.discount) : '-'}
                    </td>
                  );
                }
                if (col.id === 'gst_rate') {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center font-mono">
                      {item.gst_rate || 0}%
                    </td>
                  );
                }
                if (col.id === 'total') {
                  return (
                    <td key={col.id} className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900">
                      {formatNumber(item.total_amount || (item.quantity * item.rate))}
                    </td>
                  );
                }

                // Custom columns
                return (
                  <td key={col.id} className="py-2.5 px-2 text-center font-mono">
                    {item[col.key] ?? item[col.id] ?? '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tax Breakdown & Totals */}
      <div className="grid grid-cols-12 gap-6 border-t border-slate-200 pt-4 mb-4">
        {/* Left: Bank details & Amount in words */}
        <div className="col-span-7 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Bank Payment Details</span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700">
              <div><strong className="text-slate-500">Bank:</strong> {comp.bank_name}</div>
              <div><strong className="text-slate-500">Branch:</strong> {comp.bank_branch}</div>
              <div><strong className="text-slate-500">A/c No:</strong> <span className="font-mono font-bold">{comp.account_no}</span></div>
              <div><strong className="text-slate-500">IFSC:</strong> <span className="font-mono font-bold">{comp.ifsc_code}</span></div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block mb-0.5">Amount In Words</span>
            <p className="text-xs font-bold text-blue-950 capitalize">{invoice.amount_in_words}</p>
          </div>
        </div>

        {/* Right: Calculations */}
        <div className="col-span-5 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.discount_total > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Discount:</span>
              <span className="font-mono">- {formatCurrency(invoice.discount_total)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Taxable Amount:</span>
            <span className="font-mono">{formatCurrency(invoice.taxable_amount)}</span>
          </div>

          {invoice.cgst_amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>CGST:</span>
              <span className="font-mono">{formatCurrency(invoice.cgst_amount)}</span>
            </div>
          )}

          {invoice.sgst_amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>SGST:</span>
              <span className="font-mono">{formatCurrency(invoice.sgst_amount)}</span>
            </div>
          )}

          {invoice.igst_amount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>IGST:</span>
              <span className="font-mono">{formatCurrency(invoice.igst_amount)}</span>
            </div>
          )}

          <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-slate-900">
            <span className="font-black text-sm">Grand Total:</span>
            <span className="text-base font-black font-mono">{formatCurrency(invoice.grand_total)}</span>
          </div>
        </div>
      </div>

      {/* Footer & Signature */}
      <div className="border-t border-slate-200 pt-4 flex justify-between items-end text-xs">
        <div className="max-w-md text-[11px] text-slate-500 whitespace-pre-line">
          <strong>Terms & Conditions:</strong>
          <div>{invoice.terms || comp.terms_conditions || 'Subject to local jurisdiction.'}</div>
        </div>

        <div className="text-center">
          <div className="text-[11px] font-bold text-slate-700 mb-1">For {comp.company_name}</div>
          {(invoice.image2_url || comp.signature_url || (Array.isArray(invoice?.images) && invoice.images.find(img => img.image_slot === 2 || img.image_type === 'signature')?.file_path)) ? (
            <img
              src={
                (Array.isArray(invoice?.images) ? invoice.images.find(img => img.image_slot === 2 || img.image_type === 'signature')?.file_path : '') ||
                comp.signature_url ||
                invoice.image2_url
              }
              alt="Signature"
              className="max-h-12 max-w-[120px] mx-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="h-10"></div>
          )}
          <div className="text-[11px] font-bold text-slate-900 border-t border-slate-300 pt-1">
            {comp.signature_title || 'Authorized Signatory'}
          </div>
        </div>
      </div>
    </div>
  );
}

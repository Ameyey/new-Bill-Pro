import React from 'react';
import { formatDate, formatNumber } from '../../utils/formatters';
import { getStoredPreferences, getInvoiceEffectivePreferences } from '../../utils/columnPreferences';

export default function IndustrialTemplate({ invoice, company, headerPreferences }) {
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
  // Guarantee total is ALWAYS the final column in visibleCols
  const rawVisibleCols = (prefs?.itemColumns || []).filter(c => c.visible && c.id !== 'catalog');
  const existingTotal = rawVisibleCols.find(c => c.id === 'total');
  const totalCol = existingTotal || { id: 'total', key: 'total', label: 'Total (₹)', defaultLabel: 'Total (₹)', visible: true };
  const visibleCols = [...rawVisibleCols.filter(c => c.id !== 'total'), totalCol];
  const totalColIndex = visibleCols.length - 1;
  const labelColIndex = Math.max(0, visibleCols.length - 2);

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
    company?.logo_url ||
    invoice?.company?.logo_url ||
    invoice?.image1_url ||
    invoice?.logo_url ||
    '';

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
        : 'text-center items-center';

  const companyTransform = headerPrefs.companyUppercase !== false ? 'uppercase' : 'normal-case';
  const companyItalicClass = headerPrefs.companyItalic ? 'italic' : '';

  const taxable = Number(invoice.taxable_amount !== undefined && invoice.taxable_amount !== null ? invoice.taxable_amount : (invoice.subtotal || 0));
  const cgstAmt = Number(invoice.cgst_amount || 0);
  const sgstAmt = Number(invoice.sgst_amount || 0);
  const igstAmt = Number(invoice.igst_amount || 0);
  const totalGst = Number(invoice.total_gst || (cgstAmt + sgstAmt + igstAmt) || 0);
  const grandTotal = Number(invoice.grand_total || (taxable + totalGst) || 0);

  let cgstRate = 9;
  let sgstRate = 9;
  let igstRate = 18;
  if (invoice.bill_gst_rate !== undefined && invoice.bill_gst_rate !== null) {
    const br = parseFloat(invoice.bill_gst_rate);
    cgstRate = br / 2;
    sgstRate = br / 2;
    igstRate = br;
  } else if (taxable > 0 && cgstAmt > 0) {
    cgstRate = Math.round((cgstAmt / taxable) * 100 * 10) / 10;
    sgstRate = Math.round((sgstAmt / taxable) * 100 * 10) / 10;
  } else if (items.length > 0 && items[0]?.gst_rate !== undefined) {
    const r = parseFloat(items[0].gst_rate) || 0;
    cgstRate = r / 2;
    sgstRate = r / 2;
    igstRate = r;
  }

  const isInterstate = Boolean(invoice.is_inter_state || igstAmt > 0);

  // Reserve space for items, followed by the exact totals block (Total, blank spacers, CGST, SGST, Grand Total)
  const itemRowCount = Math.max(8, items.length);
  const rows = Array.from({ length: itemRowCount }, (_, i) => items[i] || null);

  const wordsInUpper = (invoice.amount_in_words || '').toUpperCase();

  const invoiceNoField = prefs?.dcFields?.find(f => f.id === 'invoice_no');
  const showInvoiceNo = Boolean(!invoiceNoField || invoiceNoField.visible !== false || invoice.invoice_number);
  const invoiceDateField = prefs?.dcFields?.find(f => f.id === 'invoice_date');
  const showInvoiceDate = Boolean(!invoiceDateField || invoiceDateField.visible !== false || invoice.invoice_date);

  const inDcNoField = prefs?.dcFields?.find(f => f.id === 'in_dc_no');
  const showInDcNo = Boolean((inDcNoField && inDcNoField.visible) || (invoice.in_dc_no && String(invoice.in_dc_no).trim()));
  const inDcDateField = prefs?.dcFields?.find(f => f.id === 'in_dc_date');
  const showInDcDate = Boolean((inDcDateField && inDcDateField.visible) || (invoice.in_dc_date && String(invoice.in_dc_date).trim()));

  const outDcNoField = prefs?.dcFields?.find(f => f.id === 'out_dc_no');
  const outDcField = outDcNoField;
  const showOutDcNo = Boolean((outDcNoField && outDcNoField.visible) || (invoice.out_dc_no && String(invoice.out_dc_no).trim()));
  const outDcDateField = prefs?.dcFields?.find(f => f.id === 'out_dc_date');
  const showOutDcDate = Boolean((outDcDateField && outDcDateField.visible) || (invoice.out_dc_date && String(invoice.out_dc_date).trim()));

  const customDcRows = (prefs?.dcFields || []).filter(f => f.isCustom && f.visible);

  const hasInvoiceRow = showInvoiceNo || showInvoiceDate;
  const hasInDcRow = showInDcNo || showInDcDate;
  const hasOutDcRow = showOutDcNo || showOutDcDate;

  const cleanDcLabel = (label, fallback) => {
    if (!label) return fallback;
    return label
      .trim()
      .replace(/\s+\./g, '.')
      .replace(/^Invoice\s*\.No\.?/i, 'Invoice No.')
      .replace(/^IN\s*D\.?C\.?\s*No\.?/i, 'IN D.C. No.')
      .replace(/^OUT\s*D\.?C\.?\s*No\.?/i, 'OUT D.C. No.');
  };

  return (
    <div className="invoice-paper bg-white text-black font-sans text-[13px] leading-tight min-w-[720px] max-w-[820px] w-full mx-auto border-2 border-black p-4 select-text shadow-sm">
      {/* Top Header */}
      {!headerPrefs.hideHeader ? (
        <div className="border-b-2 border-black mb-0">
          {headerPrefs.showInvoiceTitle !== false && (
            <div className="border-b-2 border-black py-1.5 text-center font-bold text-sm tracking-widest uppercase bg-white leading-normal">
              {headerPrefs.invoiceTitle || invoice.invoice_title || 'INVOICE'}
            </div>
          )}
          <table className="w-full border-collapse table-fixed">
            <tbody>
              <tr>
                {/* Logo & Company Name */}
                <td className="w-1/2 align-middle border-r-2 border-black p-2 text-center">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    {headerPrefs.showLogo && logoSrc ? (
                      <img
                        src={logoSrc}
                        alt={comp.company_name || 'Logo'}
                        style={{
                          width: `${headerPrefs.logoWidth || 180}px`,
                          height: `${headerPrefs.logoHeight || 65}px`,
                          maxWidth: '100%',
                          objectFit: 'contain',
                          objectPosition: 'center'
                        }}
                        className="object-contain"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : null}

                    {/* Show company name if explicitly enabled */}
                    {Boolean(headerPrefs.showCompanyName) && (
                      <div className={`w-full py-1 px-1 flex flex-col ${companyAlignClass}`}>
                        <h1
                          style={{
                            fontSize: `${companyFontSizePx}px`,
                            fontWeight: companyFontWeightStyle,
                            lineHeight: 1.15
                          }}
                          className={`tracking-tight text-black leading-tight ${companyFontFamilyClass} ${companyTransform} ${companyItalicClass}`}
                        >
                          {displayCompanyName}
                        </h1>
                        {displayTagline && (
                          <p
                            style={{
                              fontSize: `${taglineFontSizePx}px`,
                              lineHeight: 1.25
                            }}
                            className={`font-bold tracking-widest uppercase text-slate-800 mt-1 ${companyFontFamilyClass === 'font-mono' ? 'font-mono' : ''}`}
                          >
                            {displayTagline}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Works / Address */}
                <td className="w-1/2 align-middle p-2">
                  {headerPrefs.showAddress !== false ? (
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
                      className={`flex flex-col justify-center px-4 py-1 leading-relaxed ${headerPrefs.addressAlign === 'left'
                        ? 'text-left'
                        : headerPrefs.addressAlign === 'center'
                          ? 'text-center'
                          : 'text-right'
                        } ${headerPrefs.addressFontWeight === 'normal'
                          ? 'font-normal'
                          : headerPrefs.addressFontWeight === 'bold'
                            ? 'font-bold'
                            : 'font-semibold'
                        } ${headerPrefs.addressFontFamily === 'serif'
                          ? 'font-serif'
                          : headerPrefs.addressFontFamily === 'mono'
                            ? 'font-mono'
                            : 'font-sans'
                        } ${headerPrefs.addressItalic ? 'italic' : ''} ${headerPrefs.addressUppercase ? 'uppercase tracking-wide' : ''
                        }`}
                    >
                      {headerPrefs.customWorksAddress ? (
                        headerPrefs.customWorksAddress
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line, idx) => {
                            if (/^works\s*:/i.test(line)) {
                              return (
                                <div key={idx}>
                                  <strong>Works :</strong> {line.replace(/^works\s*:\s*/i, '')}
                                </div>
                              );
                            }
                            if (/^tel\s*:/i.test(line)) {
                              return (
                                <div key={idx}>
                                  <strong>Tel :</strong> {line.replace(/^tel\s*:\s*/i, '')}
                                </div>
                              );
                            }
                            return <div key={idx}>{line}</div>;
                          })
                      ) : (
                        <>
                          {(comp.works_address || comp.address) && (
                            <div>
                              <strong>Works :</strong>{' '}
                              {(comp.works_address || comp.address)
                                .replace(/^Works\s*:\s*/i, '')
                                .split('\n')[0]}
                            </div>
                          )}
                          {(comp.city || comp.state) && (
                            <div>
                              {[comp.city, comp.state, comp.pincode].filter(Boolean).join(' - ')}
                            </div>
                          )}
                          {comp.phone && (
                            <div>
                              <strong>Tel :</strong> {comp.phone}
                            </div>
                          )}
                          {comp.email && (
                            <div>
                              <strong>Email :</strong> {comp.email}
                            </div>
                          )}
                          {comp.gstin && <div><strong>GSTIN :</strong> {comp.gstin}</div>}
                        </>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pt-20 border-b-2 border-black pb-1 mb-0 flex justify-between items-end px-2">
          <span className="text-[11px] font-bold text-slate-400 italic">Pre-printed Letterhead Margin</span>
          <span className="text-sm font-bold uppercase tracking-widest">{headerPrefs.invoiceTitle || invoice.invoice_title || 'INVOICE'}</span>
        </div>
      )}

      {/* Customer & Invoice Meta Table */}
      <table className="w-full text-xs border-collapse border-b-2 border-black table-fixed">
        <tbody>
          <tr>
            {/* Customer To Box */}
            <td className="w-1/2 align-top border-r-2 border-black p-0">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  <tr>
                    <td className="py-2 px-3 border-b border-black leading-normal">
                      <div className="text-[11px] font-bold text-slate-700">To :</div>
                      <div className="font-bold text-sm uppercase text-black mt-0.5">
                        {invoice.customer_name || invoice.customer?.name || '-'}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 leading-normal whitespace-pre-line border-b border-black text-xs">
                      <strong>Address : </strong>
                      <span>
                        {(invoice.customer_address || invoice.customer?.address || 'Nanded Phata Near Savali Dhaba, Sinhgad Road').replace(/^address\s*[:-]*\s*/i, '')}
                        {invoice.customer_city || invoice.customer?.city ? `, ${(invoice.customer_city || invoice.customer?.city).replace(/^city\s*[:-]*\s*/i, '')}` : ''}
                        {invoice.customer_state ? `, ${invoice.customer_state}` : ''}
                      </span>
                    </td>
                  </tr>
                  {(invoice.customer_phone || invoice.customer?.phone) && (
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800 border-b border-black leading-normal text-xs">
                        <div className="flex items-center gap-1">
                          <strong>Tel / Phone :</strong>
                          <span className="font-mono">{invoice.customer_phone || invoice.customer?.phone}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/40">
                    <td className="p-0">
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          <tr>
                            <td className="w-24 border-r border-black py-2 px-3 font-bold shrink-0 leading-normal text-xs">
                              GST.NO :
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-left leading-normal text-xs">
                              {invoice.selected_gst_number || invoice.customer_gst_number || '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* Invoice & DC Numbers */}
            <td className="w-1/2 align-top p-0">
              <table className="w-full text-xs border-collapse table-fixed">
                <tbody>
                  {hasInvoiceRow && (
                    <tr>
                      {showInvoiceNo && showInvoiceDate ? (
                        <>
                          <td className="w-1/2 border-r border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                            <div className="flex items-center justify-between gap-1 w-full leading-normal">
                              <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={invoiceNoField?.label || 'Invoice No.'}>
                                {cleanDcLabel(invoiceNoField?.label, 'Invoice No.')}
                              </span>
                              <span className="font-mono font-bold text-right text-xs text-black">
                                {invoice.invoice_number || '118'}
                              </span>
                            </div>
                          </td>
                          <td className="w-1/2 border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                            <div className="flex items-center justify-between gap-1 w-full leading-normal">
                              <span className="font-bold shrink-0 text-[11px] whitespace-nowrap text-slate-900 select-none" title="Dated">
                                {invoiceDateField?.label && !invoiceDateField.label.toLowerCase().includes('invoice') ? invoiceDateField.label : 'Dated'}
                              </span>
                              <span className="font-mono font-bold text-right text-xs text-black">
                                {invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}
                              </span>
                            </div>
                          </td>
                        </>
                      ) : showInvoiceNo ? (
                        <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                          <div className="flex items-center justify-between gap-2 w-full leading-normal">
                            <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={invoiceNoField?.label || 'Invoice No.'}>
                              {cleanDcLabel(invoiceNoField?.label, 'Invoice No.')}
                            </span>
                            <span className="font-mono font-bold text-xs text-black">
                              {invoice.invoice_number || '118'}
                            </span>
                          </div>
                        </td>
                      ) : (
                        <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                          <div className="flex items-center justify-between gap-2 w-full leading-normal">
                            <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title="Dated">
                              {invoiceDateField?.label && !invoiceDateField.label.toLowerCase().includes('invoice') ? invoiceDateField.label : 'Dated'}
                            </span>
                            <span className="font-mono font-bold text-xs text-black">
                              {invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  )}

                  {hasInDcRow && (
                    <tr>
                      {showInDcNo && showInDcDate ? (
                        <>
                          <td className="w-1/2 border-r border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                            <div className="flex items-center justify-between gap-1 w-full leading-normal">
                              <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={inDcNoField?.label || 'IN D.C. No.'}>
                                {cleanDcLabel(inDcNoField?.label, 'IN D.C. No.')}
                              </span>
                              <span className="font-mono font-bold text-right text-xs text-black">
                                {invoice.in_dc_no || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="w-1/2 border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                            <div className="flex items-center justify-between gap-1 w-full leading-normal">
                              <span className="font-bold shrink-0 text-[11px] whitespace-nowrap text-slate-900 select-none">
                                {inDcDateField?.label && !inDcDateField.label.toLowerCase().includes('in d.c.') ? inDcDateField.label : 'Dated'}
                              </span>
                              <span className="font-mono font-bold text-right text-xs text-black">
                                {invoice.in_dc_date ? formatDate(invoice.in_dc_date) : '-'}
                              </span>
                            </div>
                          </td>
                        </>
                      ) : showInDcNo ? (
                        <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                          <div className="flex items-center justify-between gap-2 w-full leading-normal">
                            <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={inDcNoField?.label || 'IN D.C. No.'}>
                              {cleanDcLabel(inDcNoField?.label, 'IN D.C. No.')}
                            </span>
                            <span className="font-mono font-bold text-xs text-black">
                              {invoice.in_dc_no || '-'}
                            </span>
                          </div>
                        </td>
                      ) : (
                        <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                          <div className="flex items-center justify-between gap-2 w-full leading-normal">
                            <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title="Dated">
                              {inDcDateField?.label && !inDcDateField.label.toLowerCase().includes('in d.c.') ? inDcDateField.label : 'Dated'}
                            </span>
                            <span className="font-mono font-bold text-xs text-black">
                              {invoice.in_dc_date ? formatDate(invoice.in_dc_date) : '-'}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  )}

                  {hasOutDcRow && (
                    <tr>
                      {showOutDcNo && showOutDcDate ? (
                        <>
                          <td className="w-1/2 border-r border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                            <div className="flex items-center justify-between gap-1 w-full leading-normal">
                              <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={outDcNoField?.label || 'OUT D.C. No.'}>
                                {cleanDcLabel(outDcNoField?.label, 'OUT D.C. No.')}
                              </span>
                              <span className="font-mono font-bold text-right text-xs text-black">
                                {invoice.out_dc_no || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="w-1/2 border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                            <div className="flex items-center justify-between gap-1 w-full leading-normal">
                              <span className="font-bold shrink-0 text-[11px] whitespace-nowrap text-slate-900 select-none">
                                {outDcDateField?.label && !outDcDateField.label.toLowerCase().includes('out d.c.') ? outDcDateField.label : 'Dated'}
                              </span>
                              <span className="font-mono font-bold text-right text-xs text-black">
                                {invoice.out_dc_date ? formatDate(invoice.out_dc_date) : '-'}
                              </span>
                            </div>
                          </td>
                        </>
                      ) : showOutDcNo ? (
                        <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                          <div className="flex items-center justify-between gap-2 w-full leading-normal">
                            <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={outDcNoField?.label || 'OUT D.C. No.'}>
                              {cleanDcLabel(outDcNoField?.label, 'OUT D.C. No.')}
                            </span>
                            <span className="font-mono font-bold text-xs text-black">
                              {invoice.out_dc_no || '-'}
                            </span>
                          </div>
                        </td>
                      ) : (
                        <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                          <div className="flex items-center justify-between gap-2 w-full leading-normal">
                            <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title="Dated">
                              {outDcDateField?.label && !outDcDateField.label.toLowerCase().includes('out d.c.') ? outDcDateField.label : 'Dated'}
                            </span>
                            <span className="font-mono font-bold text-xs text-black">
                              {invoice.out_dc_date ? formatDate(invoice.out_dc_date) : '-'}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  )}

                  {customDcRows.map(f => (
                    <tr key={f.id}>
                      <td colSpan={2} className="border-b border-black py-2.5 px-3 align-middle leading-normal bg-white">
                        <div className="flex items-center justify-between gap-2 w-full leading-normal">
                          <span className="font-bold text-[11px] whitespace-nowrap text-slate-900 select-none" title={f.label}>
                            {f.label}
                          </span>
                          <span className="font-mono text-xs text-right font-bold text-black">
                            {f.type === 'date' && invoice.custom_dc_values?.[f.key]
                              ? formatDate(invoice.custom_dc_values[f.key])
                              : (invoice.custom_dc_values?.[f.key] || invoice[f.key] || '-')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Main Items Table */}
      <div className="border-b-2 border-black">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-black font-bold text-center bg-slate-50">
              {visibleCols.map((col, cIdx) => {
                const isLast = cIdx === visibleCols.length - 1;
                const isLabelCol = cIdx === labelColIndex;
                const borderClass = isLast ? '' : 'border-r border-black';
                let widthClass = 'w-16';
                let alignClass = 'text-center';

                if (col.id === 'item_no') {
                  widthClass = 'w-10';
                  alignClass = 'text-center';
                } else if (col.id === 'description') {
                  widthClass = '';
                  alignClass = 'px-2 text-left';
                } else if (isLast || col.id === 'total') {
                  widthClass = 'w-24 min-w-[90px]';
                  alignClass = 'text-right pr-2';
                } else if (isLabelCol) {
                  widthClass = 'w-20 min-w-[75px]';
                  alignClass = 'text-center';
                } else if (col.id === 'unit') {
                  widthClass = 'w-14';
                  alignClass = 'text-center';
                } else if (col.id === 'rate') {
                  widthClass = 'w-20';
                  alignClass = 'text-right pr-1.5';
                } else if (col.id === 'discount') {
                  widthClass = 'w-16';
                  alignClass = 'text-right pr-1.5';
                } else if (col.id === 'gst_rate') {
                  widthClass = 'w-16';
                  alignClass = 'text-center';
                } else if (col.id === 'quantity') {
                  widthClass = 'w-16';
                  alignClass = 'text-center';
                }

                return (
                  <th
                    key={col.id}
                    className={`py-1.5 ${borderClass} ${widthClass} ${alignClass}`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 text-center h-[21px]">
                {visibleCols.map((col, cIdx) => {
                  const isLast = cIdx === visibleCols.length - 1;
                  const borderClass = isLast ? '' : 'border-r border-black';

                  if (col.id === 'item_no') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px] py-0.5`}>
                        {item ? item.item_no || idx + 1 : idx + 1}
                      </td>
                    );
                  }
                  if (col.id === 'description') {
                    return (
                      <td key={col.id} className={`${borderClass} text-left px-2 font-medium break-words max-w-[280px]`}>
                        {item ? item.description : ''}
                      </td>
                    );
                  }
                  if (col.id === 'sq_ft') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px]`}>
                        {item && (item.sq_ft > 0 ? item.sq_ft : (item.quantity && item.unit === 'Sq.Ft' ? item.quantity : ''))}
                      </td>
                    );
                  }
                  if (col.id === 'quantity') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px]`}>
                        {item ? item.quantity : ''}
                      </td>
                    );
                  }
                  if (col.id === 'unit') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px]`}>
                        {item ? item.unit : ''}
                      </td>
                    );
                  }
                  if (col.id === 'rate') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px] text-right pr-1.5`}>
                        {item ? item.rate : ''}
                      </td>
                    );
                  }
                  if (col.id === 'discount') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px] text-right pr-1.5`}>
                        {item && item.discount > 0 ? item.discount : ''}
                      </td>
                    );
                  }
                  if (col.id === 'gst_rate') {
                    return (
                      <td key={col.id} className={`${borderClass} font-mono text-[11px]`}>
                        {item ? `${item.gst_rate || 0}%` : ''}
                      </td>
                    );
                  }
                  if (col.id === 'total') {
                    return (
                      <td key={col.id} className={`${borderClass} text-right pr-2 font-mono text-[11px] font-semibold`}>
                        {item ? formatNumber(item.total_amount || (item.quantity * item.rate)) : '0'}
                      </td>
                    );
                  }

                  // Custom column (e.g. HSN/SAC, Batch No)
                  return (
                    <td key={col.id} className={`${borderClass} font-mono text-[11px]`}>
                      {item ? (item[col.key] ?? item[col.id] ?? '') : ''}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* 1. Subtotal / Total Row */}
            <tr className="border-t-2 border-black font-bold text-xs h-[22px]">
              {visibleCols.map((col, cIdx) => {
                const isLast = cIdx === visibleCols.length - 1;
                const isLabelCol = cIdx === labelColIndex;
                const isTotalCol = cIdx === totalColIndex;
                const borderClass = isLast ? '' : 'border-r border-black';
                if (isLabelCol) {
                  return (
                    <td key={col.id} className={`${borderClass} text-right pr-2 font-bold text-xs`}>
                      Total
                    </td>
                  );
                }
                if (isTotalCol) {
                  return (
                    <td key={col.id} className="text-right pr-2 font-mono font-bold text-xs">
                      {formatNumber(taxable)}
                    </td>
                  );
                }
                return <td key={col.id} className={borderClass}></td>;
              })}
            </tr>

            {/* 2. Blank Grid Spacer Row 1 */}
            <tr className="border-b border-slate-200 h-[21px]">
              {visibleCols.map((col, cIdx) => (
                <td key={col.id} className={cIdx !== visibleCols.length - 1 ? 'border-r border-black' : ''}></td>
              ))}
            </tr>

            {/* 3. Blank Grid Spacer Row 2 */}
            <tr className="border-b border-slate-200 h-[21px]">
              {visibleCols.map((col, cIdx) => (
                <td key={col.id} className={cIdx !== visibleCols.length - 1 ? 'border-r border-black' : ''}></td>
              ))}
            </tr>

            {/* 4 & 5. GST Tax Rows (CGST + SGST or IGST) */}
            {!isInterstate ? (
              <>
                <tr className="border-b border-slate-200 font-bold text-xs h-[21px]">
                  {visibleCols.map((col, cIdx) => {
                    const isLast = cIdx === visibleCols.length - 1;
                    const isLabelCol = cIdx === labelColIndex;
                    const isTotalCol = cIdx === totalColIndex;
                    const borderClass = isLast ? '' : 'border-r border-black';
                    if (isLabelCol) {
                      return (
                        <td key={col.id} className={`${borderClass} text-right pr-2 font-bold text-xs whitespace-nowrap`}>
                          CGST {cgstRate}%
                        </td>
                      );
                    }
                    if (isTotalCol) {
                      return (
                        <td key={col.id} className="text-right pr-2 font-mono font-bold text-xs">
                          {formatNumber(cgstAmt)}
                        </td>
                      );
                    }
                    return <td key={col.id} className={borderClass}></td>;
                  })}
                </tr>

                <tr className="border-b border-slate-200 font-bold text-xs h-[21px]">
                  {visibleCols.map((col, cIdx) => {
                    const isLast = cIdx === visibleCols.length - 1;
                    const isLabelCol = cIdx === labelColIndex;
                    const isTotalCol = cIdx === totalColIndex;
                    const borderClass = isLast ? '' : 'border-r border-black';
                    if (isLabelCol) {
                      return (
                        <td key={col.id} className={`${borderClass} text-right pr-2 font-bold text-xs whitespace-nowrap`}>
                          SGST {sgstRate}%
                        </td>
                      );
                    }
                    if (isTotalCol) {
                      return (
                        <td key={col.id} className="text-right pr-2 font-mono font-bold text-xs">
                          {formatNumber(sgstAmt)}
                        </td>
                      );
                    }
                    return <td key={col.id} className={borderClass}></td>;
                  })}
                </tr>
              </>
            ) : (
              <tr className="border-b border-slate-200 font-bold text-xs h-[21px]">
                {visibleCols.map((col, cIdx) => {
                  const isLast = cIdx === visibleCols.length - 1;
                  const isLabelCol = cIdx === labelColIndex;
                  const isTotalCol = cIdx === totalColIndex;
                  const borderClass = isLast ? '' : 'border-r border-black';
                  if (isLabelCol) {
                    return (
                      <td key={col.id} className={`${borderClass} text-right pr-2 font-bold text-xs whitespace-nowrap`}>
                        IGST {igstRate}%
                      </td>
                    );
                  }
                  if (isTotalCol) {
                    return (
                      <td key={col.id} className="text-right pr-2 font-mono font-bold text-xs">
                        {formatNumber(igstAmt)}
                      </td>
                    );
                  }
                  return <td key={col.id} className={borderClass}></td>;
                })}
              </tr>
            )}

            {/* 6. Grand Total Row */}
            <tr className="border-t-2 border-black font-bold h-[26px] bg-slate-50/30">
              {visibleCols.map((col, cIdx) => {
                const isLast = cIdx === visibleCols.length - 1;
                const isLabelCol = cIdx === labelColIndex;
                const isTotalCol = cIdx === totalColIndex;
                const borderClass = isLast ? '' : 'border-r border-black';
                if (isLabelCol) {
                  return (
                    <td key={col.id} className={`${borderClass} text-right pr-2 font-bold text-xs`}>
                      Total
                    </td>
                  );
                }
                if (isTotalCol) {
                  return (
                    <td key={col.id} className="text-right pr-2 font-mono font-black text-sm">
                      {formatNumber(grandTotal)}
                    </td>
                  );
                }
                return <td key={col.id} className={borderClass}></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bank Details & Totals Section */}
      <table className="w-full border-collapse border-b-2 border-black table-fixed">
        <tbody>
          <tr>
            <td className="w-8/12 align-top border-r-2 border-black p-2 text-xs">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-28 font-bold py-0.5">Bank</td>
                    <td className="w-3 py-0.5">:</td>
                    <td className="font-semibold py-0.5">{comp.bank_name || 'Janata Sahakari Bank Ltd.'}</td>
                  </tr>
                  <tr>
                    <td className="w-28 font-bold py-0.5">Branch</td>
                    <td className="w-3 py-0.5">:</td>
                    <td className="py-0.5">{comp.bank_branch || 'Sinhagad Road , Pune'}</td>
                  </tr>
                  <tr>
                    <td className="w-28 font-bold py-0.5">Current A/c.No.</td>
                    <td className="w-3 py-0.5">:</td>
                    <td className="font-mono font-bold py-0.5">{comp.account_no || '037230100003478'}</td>
                  </tr>
                  <tr>
                    <td className="w-28 font-bold py-0.5">IFSC . Code</td>
                    <td className="w-3 py-0.5">:</td>
                    <td className="font-mono font-bold py-0.5">{comp.ifsc_code || 'JSBP0000037'}</td>
                  </tr>
                  <tr>
                    <td className="w-28 font-bold py-0.5">PAN . NO</td>
                    <td className="w-3 py-0.5">:</td>
                    <td className="font-mono font-bold py-0.5">{comp.pan || 'CDBPB8308N'}</td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* Second Total Box */}
            <td className="w-4/12 align-top p-2 bg-slate-50">
              <div className="flex flex-col justify-between h-full min-h-[90px]">
                <div className="text-right">
                  <span className="text-xs font-bold uppercase text-slate-600 block mb-1">Final Invoice Total</span>
                  <div className="text-xl font-black font-mono">{formatNumber(invoice.grand_total)}</div>
                </div>
                {invoice.total_gst > 0 && (
                  <div className="text-[10.5px] border-t border-slate-300 pt-1 text-slate-700 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Taxable Value:</span>
                      <span className="font-mono">₹{formatNumber(invoice.taxable_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total GST:</span>
                      <span className="font-mono">₹{formatNumber(invoice.total_gst)}</span>
                    </div>
                  </div>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Rupee in Words & Signature */}
      <table className="w-full border-collapse table-fixed">
        <tbody>
          <tr>
            {/* Rupee in words */}
            <td className="w-7/12 align-top border-r-2 border-black p-2">
              <div className="flex flex-col justify-between h-full min-h-[85px]">
                <div>
                  <span className="font-bold text-xs uppercase block mb-1">Rupee in Words :</span>
                  <p className="text-xs font-bold tracking-tight text-slate-900 uppercase leading-relaxed font-mono">
                    {wordsInUpper || 'FIVE THOUSAND TWO HUNDRED NINETY - FOUR RUPEE ONLY.'}
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 italic">
                  Terms: {invoice.terms || comp.terms_conditions || 'Goods once sold will not be taken back.'}
                </div>
              </div>
            </td>

            {/* Proprietor Box */}
            <td className="w-5/12 align-top p-2 text-center">
              <div className="flex flex-col justify-between h-full min-h-[85px]">
                <div className="text-xs font-bold uppercase">
                  for {displayCompanyName || comp.company_name || 'Authorized Signatory'}
                </div>

                {/* Signature Slot */}
                <div className="my-1 flex items-center justify-center">
                  {(invoice.image2_url || comp.signature_url || (Array.isArray(invoice?.images) && invoice.images.find(img => img.image_slot === 2 || img.image_type === 'signature')?.file_path)) ? (
                    <img
                      src={
                        (Array.isArray(invoice?.images) ? invoice.images.find(img => img.image_slot === 2 || img.image_type === 'signature')?.file_path : '') ||
                        comp.signature_url ||
                        invoice.image2_url
                      }
                      alt="Signature"
                      className="max-h-12 max-w-[120px] object-contain"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-8"></div>
                  )}
                </div>

                <div className="text-xs font-bold uppercase border-t border-dotted border-black pt-1">
                  {comp.signature_title || 'Proprietor'}
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

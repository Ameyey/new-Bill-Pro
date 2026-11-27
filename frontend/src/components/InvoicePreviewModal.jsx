import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import IndustrialTemplate from './InvoiceTemplates/IndustrialTemplate';
import ModernGstTemplate from './InvoiceTemplates/ModernGstTemplate';
import {
  Printer,
  Download,
  Share2,
  LayoutTemplate,
  X,
  Check,
  Save,
  RotateCcw,
  CheckCircle2,
  Settings,
  SlidersHorizontal
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { getStoredPreferences, saveStoredPreferences, DEFAULT_HEADER_PREFERENCES } from '../utils/columnPreferences';

const getFontSizePx = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 11.5;
  if (val === 'xs') return 10;
  if (val === 'sm') return 11.5;
  if (val === 'md') return 13.5;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 11.5 : parsed;
};

const getCompanyFontSizePx = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 24;
  if (val === 'sm') return 18;
  if (val === 'md') return 24;
  if (val === 'lg') return 30;
  if (val === 'xl') return 36;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 24 : parsed;
};

export default function InvoicePreviewModal({ isOpen, onClose, invoice, company, onlyBill = false, onSave, saving = false, isEditMode = false }) {
  const [template, setTemplate] = useState('industrial'); // 'industrial' or 'modern'
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(invoice?.payment_status || 'unpaid');
  const [showSettings, setShowSettings] = useState(false);
  const [headerPrefs, setHeaderPrefs] = useState(() => {
    const stored = getStoredPreferences();
    return {
      ...DEFAULT_HEADER_PREFERENCES,
      ...(stored.headerPreferences || {})
    };
  });
  const printRef = useRef(null);
  const containerRef = useRef(null);
  const { success, error } = useToast();

  const [viewMode, setViewMode] = useState('fit'); // 'fit' or 'scroll'
  const [mobileScale, setMobileScale] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const approxW = Math.max(280, window.innerWidth - 32);
      return Math.max(0.32, Math.min(1, Number((approxW / 740).toFixed(4))));
    }
    return 1;
  });

  useEffect(() => {
    const updateScale = () => {
      if (typeof window === 'undefined') return;
      let w = containerRef.current?.clientWidth;
      if (!w || w < 100) {
        // Fallback to window inner width minus modal paddings
        w = window.innerWidth - 32;
      }
      w = w - 8;
      if (w > 0 && w < 740) {
        setMobileScale(Math.max(0.32, Math.min(1, Number((w / 740).toFixed(4)))));
      } else if (w >= 740) {
        setMobileScale(1);
      }
    };

    updateScale();
    const raf = requestAnimationFrame(updateScale);
    const t1 = setTimeout(updateScale, 100);
    const t2 = setTimeout(updateScale, 300);

    let ro;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => updateScale());
      ro.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isOpen, viewMode, showSettings]);

  const [justSaved, setJustSaved] = useState(false);

  const updateHeaderPrefs = (newPrefs) => {
    setHeaderPrefs(newPrefs);
    const stored = getStoredPreferences();
    saveStoredPreferences({ ...stored, headerPreferences: newPrefs });
  };

  const handleSavePermanently = async () => {
    const stored = getStoredPreferences();
    saveStoredPreferences({ ...stored, headerPreferences: headerPrefs });

    // Sync edited company name or tagline back to settings if changed
    if (headerPrefs.companyName) {
      try {
        await api.put('/settings', {
          company_name: headerPrefs.companyName,
          tagline: headerPrefs.companyTagline !== undefined ? headerPrefs.companyTagline : (effectiveCompany?.tagline || '')
        });
        if (setCompany) {
          setCompany(prev => (prev ? {
            ...prev,
            company_name: headerPrefs.companyName,
            tagline: headerPrefs.companyTagline !== undefined ? headerPrefs.companyTagline : prev.tagline
          } : prev));
        }
        if (refreshMe) refreshMe();
      } catch (e) {}
    }

    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
    success('✓ Settings saved permanently! These will be applied by default to all invoices.');
  };

  const handleResetDefaults = () => {
    setHeaderPrefs(DEFAULT_HEADER_PREFERENCES);
    const stored = getStoredPreferences();
    saveStoredPreferences({ ...stored, headerPreferences: DEFAULT_HEADER_PREFERENCES });
    success('Reset to default header settings.');
  };

  useEffect(() => {
    if (invoice) {
      setCurrentStatus(invoice.payment_status || 'unpaid');
      const invHeaderPrefs = invoice.header_preferences || invoice.column_preferences?.headerPreferences;
      if (invHeaderPrefs) {
        setHeaderPrefs({
          ...DEFAULT_HEADER_PREFERENCES,
          ...invHeaderPrefs
        });
      }
    }
  }, [invoice]);

  const { company: authCompany, refreshMe, setCompany } = useAuth();

  const [localLogoUrl, setLocalLogoUrl] = useState(() => {
    return (
      headerPrefs?.logoUrl ||
      authCompany?.logo_url ||
      company?.logo_url ||
      (Array.isArray(invoice?.images) ? invoice.images.find(img => img.image_slot === 1 || img.image_type === 'logo')?.file_path : '') ||
      invoice?.company?.logo_url ||
      invoice?.image1_url ||
      invoice?.logo_url ||
      ''
    );
  });

  useEffect(() => {
    const detected =
      headerPrefs?.logoUrl ||
      authCompany?.logo_url ||
      company?.logo_url ||
      (Array.isArray(invoice?.images) ? invoice.images.find(img => img.image_slot === 1 || img.image_type === 'logo')?.file_path : '') ||
      invoice?.company?.logo_url ||
      invoice?.image1_url ||
      invoice?.logo_url ||
      '';
    if (detected && detected !== localLogoUrl) {
      setLocalLogoUrl(detected);
    }
  }, [invoice, company, authCompany, headerPrefs?.logoUrl]);

  // Automatically sync with uploaded images from Images tab
  useEffect(() => {
    let isMounted = true;
    async function fetchUploadedLogo() {
      try {
        const res = await api.get('/images');
        if (res.success && Array.isArray(res.images) && res.images.length > 0) {
          const logo = res.images.find(img => img.image_slot === 1 || img.image_type === 'logo') || res.images[0];
          if (logo?.file_path && isMounted) {
            setLocalLogoUrl(logo.file_path);
          }
        }
      } catch (e) {}
    }
    if (isOpen) {
      fetchUploadedLogo();
    }
    return () => { isMounted = false; };
  }, [isOpen]);

  const currentLogoSrc =
    localLogoUrl ||
    (Array.isArray(invoice?.images) ? invoice.images.find(img => img.image_slot === 1 || img.image_type === 'logo')?.file_path : '') ||
    authCompany?.logo_url ||
    company?.logo_url ||
    invoice?.company?.logo_url ||
    invoice?.image1_url ||
    '';

  const effectiveCompany = {
    ...(authCompany || {}),
    ...(company || {}),
    ...(invoice?.company || {})
  };

  if (!invoice) return null;

  const handleStatusUpdate = async (newStatus) => {
    setCurrentStatus(newStatus);
    invoice.payment_status = newStatus;
    if (invoice.id) {
      try {
        await api.patch(`/invoices/${invoice.id}/payment`, { payment_status: newStatus });
        success(`Invoice status updated to ${newStatus.toUpperCase()}`);
      } catch (e) {
        error('Failed to update status.');
      }
    }
  };

  const handlePrint = () => {
    const prevZoom = printRef.current?.style?.zoom;
    if (printRef.current) printRef.current.style.zoom = '1';
    window.print();
    if (printRef.current && prevZoom) printRef.current.style.zoom = prevZoom;
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setGeneratingPdf(true);
    const prevZoom = printRef.current?.style?.zoom;
    if (printRef.current) printRef.current.style.zoom = '1';

    try {
      // Allow browser DOM to reflow at 1:1 scale before canvas capture
      await new Promise((resolve) => setTimeout(resolve, 80));

      const paperElement = printRef.current.querySelector('.invoice-paper') || printRef.current;
      if (!paperElement) throw new Error('Invoice document not found');

      const canvas = await html2canvas(paperElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: 0,
        width: paperElement.offsetWidth,
        height: paperElement.offsetHeight,
        onclone: (clonedDoc) => {
          const clonedPaper = clonedDoc.querySelector('.invoice-paper');
          if (clonedPaper) {
            clonedPaper.style.transform = 'none';
            clonedPaper.style.zoom = '1';
            clonedPaper.style.margin = '0 auto';
            clonedPaper.style.boxShadow = 'none';

            // Ensure all text spans avoid character clipping in canvas render
            const spans = clonedPaper.querySelectorAll('span');
            spans.forEach(span => {
              if (span.style.overflow === 'hidden') {
                span.style.overflow = 'visible';
              }
            });
          }
          const allZoomNodes = clonedDoc.querySelectorAll('[style*="zoom"]');
          allZoomNodes.forEach(node => { node.style.zoom = '1'; });
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 8; // 8mm page margin around entire invoice
      const maxW = pageWidth - margin * 2; // 194mm
      const maxH = pageHeight - margin * 2; // 281mm

      let imgW = maxW;
      let imgH = (canvas.height * imgW) / canvas.width;

      if (imgH > maxH) {
        const scale = maxH / imgH;
        imgH = maxH;
        imgW = imgW * scale;
      }

      const posX = margin + (maxW - imgW) / 2;
      const posY = margin;

      pdf.addImage(imgData, 'PNG', posX, posY, imgW, imgH, undefined, 'FAST');

      // Sanitize and format filename: CustomerCompanyName_InvoiceNumber.pdf
      const cleanName = (val) =>
        (val || '')
          .toString()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '_');

      const customerCompany = cleanName(
        invoice?.customer_name ||
        invoice?.customer?.name ||
        invoice?.customer_company_name ||
        'Customer'
      );
      const rawInvNo = cleanName(invoice?.invoice_number || 'INV');
      const invoiceNo = /^inv/i.test(rawInvNo) ? rawInvNo : `Invoice_${rawInvNo}`;

      const fileName = `${customerCompany}_${invoiceNo}.pdf`;

      // Trigger download with robust fallback
      try {
        pdf.save(fileName);
      } catch (saveErr) {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }

      success(`✓ PDF downloaded: ${fileName}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      error('Failed to generate PDF. You can also use the Print button to Save as PDF.');
    } finally {
      if (printRef.current && prevZoom) printRef.current.style.zoom = prevZoom;
      setGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoice_number}`,
          text: `Invoice #${invoice.invoice_number} for ${invoice.customer_name} of amount ₹${invoice.grand_total}`,
          url: window.location.href
        });
        success('Shared successfully!');
      } catch (e) { }
    } else {
      navigator.clipboard.writeText(window.location.href);
      success('Invoice link copied to clipboard!');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {onlyBill ? (
          /* Sleek Minimal Header for Only Bill (Dashboard Action View) */
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 font-mono">
                Invoice #{invoice.invoice_number}
              </span>
              {invoice.customer_name && (
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  • {invoice.customer_name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Mobile View Toggle */}
              <div className="flex sm:hidden items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'fit' ? 'scroll' : 'fit')}
                  className="px-2 py-1 rounded-md bg-white text-slate-700 shadow-xs border border-slate-200"
                  title="Toggle Mobile View"
                >
                  {viewMode === 'fit' ? '🔍 100%' : '📱 Fit'}
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 text-xs shadow-xs transition cursor-pointer"
                title="Print Invoice"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print</span>
              </button>

              {onSave ? (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  title={isEditMode ? 'Update Invoice' : 'Create & Save Invoice'}
                >
                  <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                  <span>{saving ? (isEditMode ? 'Updating...' : 'Generating...') : (isEditMode ? 'Update Invoice' : 'Create & Save Invoice')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  title="Download PDF"
                >
                  <Download className={`w-3.5 h-3.5 ${generatingPdf ? 'animate-bounce' : ''}`} />
                  <span>{generatingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer ml-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Actions Bar */
          <div className="flex flex-col gap-2.5 p-2.5 sm:p-3 bg-slate-100/90 rounded-2xl border border-slate-200 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Template Selector & Status */}
              <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-500 hidden sm:flex items-center gap-1 pl-1">
                    <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />
                    <span>Template:</span>
                  </span>
                  <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-xs text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setTemplate('industrial')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition text-[11px] sm:text-xs font-bold cursor-pointer ${template === 'industrial' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <span className="hidden sm:inline">Industrial / DC Format</span>
                      <span className="sm:hidden">Industrial DC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplate('modern')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition text-[11px] sm:text-xs font-bold cursor-pointer ${template === 'modern' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <span className="hidden sm:inline">Modern GST Format</span>
                      <span className="sm:hidden">Modern GST</span>
                    </button>
                  </div>
                </div>

                {/* Quick Manual Status Selector */}
                {invoice.id && (
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs shrink-0">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">Status:</span>
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusUpdate(e.target.value)}
                      className={`text-[10px] font-black uppercase rounded-lg px-2 py-0.5 border cursor-pointer focus:outline-none transition ${currentStatus === 'paid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : currentStatus === 'partial'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : currentStatus === 'cancelled'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      title="Manually update payment status"
                    >
                      <option value="paid">● Paid</option>
                      <option value="unpaid">● Unpaid</option>
                      <option value="partial">● Partial</option>
                      <option value="cancelled">● Cancelled</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* View Mode Toggle for Mobile Screens */}
            <div className="flex sm:hidden items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-xs">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <span>📱 Bill View:</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({viewMode === 'fit' ? 'Auto-fitted to screen' : '100% swipe pan'})
                </span>
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('fit')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition ${viewMode === 'fit' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Fit Screen
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scroll')}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition ${viewMode === 'scroll' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Full 100% 🔍
                </button>
              </div>
            </div>

            {/* Print / Download or Create & Save / Share / Settings Actions */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full justify-between pt-0.5">
              {onSave ? (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-xs shadow-brand-600/20 transition disabled:opacity-50 cursor-pointer"
                  title={isEditMode ? 'Update Invoice' : 'Create & Save Invoice'}
                >
                  <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                  <span>{saving ? (isEditMode ? 'Updating...' : 'Generating...') : (isEditMode ? 'Update Invoice' : 'Create & Save Invoice')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-xs shadow-brand-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Download className={`w-3.5 h-3.5 ${generatingPdf ? 'animate-bounce' : ''}`} />
                  <span>{generatingPdf ? 'Generating...' : 'Download PDF'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 text-xs shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 text-xs shadow-xs transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 font-bold rounded-xl border text-xs shadow-xs transition cursor-pointer ${showSettings
                  ? 'bg-brand-50 border-brand-300 text-brand-700 ring-2 ring-brand-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                title="Customize header logo, works address, and layout settings"
              >
                <Settings className={`w-3.5 h-3.5 ${showSettings ? 'text-brand-600' : 'text-slate-600'}`} />
                <span>Settings</span>
                {showSettings && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 ml-0.5"></span>}
              </button>
            </div>
          </div>
        )}

        {/* Header Display Controls Bar (Adjustable on/off & Logo Sizing) - Hidden if onlyBill */}
        {!onlyBill && showSettings && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-xs no-print divide-y divide-slate-100 overflow-hidden">
            {/* Settings Top Bar with Permanent Save & Reset buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm">⚙️</span>
                <span className="font-bold text-slate-800 text-xs">
                  <span className="hidden sm:inline">Invoice Header & Layout Settings</span>
                  <span className="sm:hidden">Header & Layout Settings</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Auto-saved
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleSavePermanently}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-bold rounded-lg text-xs shadow-xs transition cursor-pointer ${justSaved
                    ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                  title="Store these header display, font size, and layout settings permanently as your default"
                >
                  {justSaved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Save Settings Permanently</span>
                      <span className="sm:hidden">Save</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg text-xs transition cursor-pointer"
                  title="Reset header settings to default"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="text-[11px] font-semibold text-slate-500">Toggle Elements:</span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={headerPrefs.showInvoiceTitle !== false}
                    onChange={(e) => updateHeaderPrefs({ ...headerPrefs, showInvoiceTitle: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className={`font-bold ${headerPrefs.showInvoiceTitle !== false ? 'text-brand-900' : 'text-slate-600'}`}>
                    Top Text ({headerPrefs.invoiceTitle || 'INVOICE'})
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={headerPrefs.showLogo}
                    onChange={(e) => updateHeaderPrefs({ ...headerPrefs, showLogo: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className={`font-bold ${headerPrefs.showLogo ? 'text-brand-900' : 'text-slate-600'}`}>
                    Logo
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={headerPrefs.showCompanyName}
                    onChange={(e) => updateHeaderPrefs({ ...headerPrefs, showCompanyName: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className={`font-semibold ${headerPrefs.showCompanyName ? 'text-brand-900 font-bold' : 'text-slate-600'}`}>
                    Company Name
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={headerPrefs.showAddress}
                    onChange={(e) => updateHeaderPrefs({ ...headerPrefs, showAddress: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className={`font-semibold ${headerPrefs.showAddress ? 'text-brand-900 font-bold' : 'text-slate-600'}`}>
                    Address & Works
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={headerPrefs.showCenterDivider !== false}
                    onChange={(e) => updateHeaderPrefs({ ...headerPrefs, showCenterDivider: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className={`font-semibold ${headerPrefs.showCenterDivider !== false ? 'text-brand-900 font-bold' : 'text-slate-600'}`}>
                    Center Line
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none pl-3 border-l border-slate-200">
                  <input
                    type="checkbox"
                    checked={headerPrefs.hideHeader}
                    onChange={(e) => updateHeaderPrefs({ ...headerPrefs, hideHeader: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className={`font-semibold ${headerPrefs.hideHeader ? 'text-amber-800 font-bold' : 'text-slate-500'}`}>
                    Blank Letterhead Top
                  </span>
                </label>
              </div>
            </div>

            {/* Dedicated Top Header Text (INVOICE) Control */}
            {headerPrefs.showInvoiceTitle !== false && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 bg-slate-50/80 text-xs border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <span className="text-base">🏷️</span>
                  <span>Top Header Text:</span>
                  <span className="text-[11px] font-normal text-slate-500">(Document title at top)</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Presets */}
                  <div className="flex items-center gap-1">
                    {['INVOICE', 'TAX INVOICE', 'BILL OF SUPPLY', 'DELIVERY CHALLAN'].map((titlePreset) => (
                      <button
                        key={titlePreset}
                        type="button"
                        onClick={() => updateHeaderPrefs({ ...headerPrefs, invoiceTitle: titlePreset })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${(headerPrefs.invoiceTitle || 'INVOICE').toUpperCase() === titlePreset
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {titlePreset}
                      </button>
                    ))}
                  </div>

                  {/* Custom text input */}
                  <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-600 text-[11px]">Custom:</span>
                    <input
                      type="text"
                      value={headerPrefs.invoiceTitle !== undefined ? headerPrefs.invoiceTitle : 'INVOICE'}
                      onChange={(e) => updateHeaderPrefs({ ...headerPrefs, invoiceTitle: e.target.value })}
                      placeholder="e.g. INVOICE"
                      className="w-36 px-2 py-0.5 text-xs font-bold border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-brand-500 uppercase"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Logo Size Adjustment: Width & Height Controls */}
            {headerPrefs.showLogo && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 bg-slate-50/80 text-xs">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <span className="text-base">📐</span>
                  <span>Adjust Logo Size:</span>
                  <span className="text-[11px] font-normal text-slate-500">(Adjust Width & Height live)</span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Width Slider + Input */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700 text-[11px]">Width:</span>
                    <input
                      type="range"
                      min="50"
                      max="400"
                      step="5"
                      value={headerPrefs.logoWidth || 180}
                      onChange={(e) => updateHeaderPrefs({ ...headerPrefs, logoWidth: Number(e.target.value) })}
                      className="w-24 accent-brand-600 cursor-pointer"
                    />
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="30"
                        max="450"
                        value={headerPrefs.logoWidth || 180}
                        onChange={(e) => updateHeaderPrefs({ ...headerPrefs, logoWidth: Number(e.target.value) })}
                        className="w-14 px-1 py-0.5 text-center font-mono font-bold text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-brand-500"
                      />
                      <span className="ml-1 text-[10px] text-slate-500 font-mono">px</span>
                    </div>
                  </div>

                  {/* Height Slider + Input */}
                  <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-700 text-[11px]">Height:</span>
                    <input
                      type="range"
                      min="25"
                      max="160"
                      step="5"
                      value={headerPrefs.logoHeight || 65}
                      onChange={(e) => updateHeaderPrefs({ ...headerPrefs, logoHeight: Number(e.target.value) })}
                      className="w-24 accent-brand-600 cursor-pointer"
                    />
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="20"
                        max="200"
                        value={headerPrefs.logoHeight || 65}
                        onChange={(e) => updateHeaderPrefs({ ...headerPrefs, logoHeight: Number(e.target.value) })}
                        className="w-14 px-1 py-0.5 text-center font-mono font-bold text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-brand-500"
                      />
                      <span className="ml-1 text-[10px] text-slate-500 font-mono">px</span>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <span className="text-[10px] text-slate-400 font-medium mr-0.5">Presets:</span>
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, logoWidth: 120, logoHeight: 45 })}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 transition shadow-xs cursor-pointer"
                    >
                      Small
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, logoWidth: 180, logoHeight: 65 })}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 transition shadow-xs cursor-pointer"
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, logoWidth: 250, logoHeight: 85 })}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 transition shadow-xs cursor-pointer"
                    >
                      Large
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, logoWidth: 320, logoHeight: 105 })}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 transition shadow-xs cursor-pointer"
                    >
                      XL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Company Name Adjustment Controls */}
            {headerPrefs.showCompanyName && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50/80 text-xs border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold shrink-0">
                  <span className="text-base">🏢</span>
                  <span>Adjust Company Name:</span>
                  <span className="text-[11px] font-normal text-slate-500">(Size, weight & style)</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Size Presets + Slider + Number Input */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600 text-[11px]">Size:</span>

                    {/* Presets: SM, MD, LG, XL */}
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'sm', val: 18, label: 'SM' },
                        { id: 'md', val: 24, label: 'MD' },
                        { id: 'lg', val: 30, label: 'LG' },
                        { id: 'xl', val: 36, label: 'XL' }
                      ].map((sz) => {
                        const currentPx = getCompanyFontSizePx(headerPrefs.companyFontSize);
                        const isActive = Math.abs(currentPx - sz.val) < 0.5;
                        return (
                          <button
                            key={sz.id}
                            type="button"
                            onClick={() => updateHeaderPrefs({ ...headerPrefs, companyFontSize: sz.val })}
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] transition cursor-pointer ${isActive
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                          >
                            {sz.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Slider */}
                    <input
                      type="range"
                      min="14"
                      max="48"
                      step="1"
                      value={getCompanyFontSizePx(headerPrefs.companyFontSize)}
                      onChange={(e) => updateHeaderPrefs({ ...headerPrefs, companyFontSize: parseInt(e.target.value, 10) })}
                      className="w-20 accent-brand-600 cursor-pointer"
                      title="Slide to adjust font size"
                    />

                    {/* Number input */}
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="12"
                        max="60"
                        value={getCompanyFontSizePx(headerPrefs.companyFontSize)}
                        onChange={(e) => updateHeaderPrefs({ ...headerPrefs, companyFontSize: parseInt(e.target.value, 10) || 24 })}
                        className="w-12 px-1 py-0.5 text-center font-mono font-bold text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-brand-500"
                      />
                      <span className="ml-0.5 text-[10px] text-slate-500 font-mono">px</span>
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-600 text-[11px] mr-1">Weight:</span>
                    {[
                      { id: 'normal', label: 'Regular' },
                      { id: 'bold', label: 'Bold' },
                      { id: 'black', label: 'Black' }
                    ].map((wt) => (
                      <button
                        key={wt.id}
                        type="button"
                        onClick={() => updateHeaderPrefs({ ...headerPrefs, companyFontWeight: wt.id })}
                        className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${(headerPrefs.companyFontWeight || 'black') === wt.id
                          ? 'bg-brand-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-100'
                          }`}
                      >
                        {wt.label}
                      </button>
                    ))}
                  </div>

                  {/* Style (Font Family) */}
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-600 text-[11px] mr-1">Style:</span>
                    {[
                      { id: 'sans', label: 'Sans' },
                      { id: 'serif', label: 'Serif' },
                      { id: 'mono', label: 'Mono' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => updateHeaderPrefs({ ...headerPrefs, companyFontFamily: st.id })}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${(headerPrefs.companyFontFamily || 'serif') === st.id
                          ? 'bg-brand-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {st.label}
                      </button>
                    ))}

                    {/* Italic */}
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, companyItalic: !headerPrefs.companyItalic })}
                      className={`ml-1 px-2 py-0.5 rounded text-[11px] italic transition cursor-pointer ${headerPrefs.companyItalic
                        ? 'bg-brand-600 text-white font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      title="Toggle Italic"
                    >
                      Italic
                    </button>

                    {/* CAPS */}
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, companyUppercase: headerPrefs.companyUppercase === false ? true : false })}
                      className={`px-2 py-0.5 rounded text-[11px] uppercase transition cursor-pointer ${headerPrefs.companyUppercase !== false
                        ? 'bg-brand-600 text-white font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      title="Toggle CAPS"
                    >
                      CAPS
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Text Adjustment: Typography (XS, S, M, Semi-bold/Bold, Alignment & Styles) */}
            {headerPrefs.showAddress && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50/80 text-xs border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <span className="text-base">✍️</span>
                  <span>Adjust Address Text:</span>
                  <span className="text-[11px] font-normal text-slate-500">(Size, align & style)</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Size Presets + Slider Bar + Number Input */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600 text-[11px]">Size:</span>

                    {/* Presets: XS, SM, MD */}
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'xs', val: 10, label: 'XS' },
                        { id: 'sm', val: 11.5, label: 'SM' },
                        { id: 'md', val: 13.5, label: 'MD' }
                      ].map((sz) => {
                        const currentPx = getFontSizePx(headerPrefs.addressFontSize);
                        const isActive = Math.abs(currentPx - sz.val) < 0.3;
                        return (
                          <button
                            key={sz.id}
                            type="button"
                            onClick={() => updateHeaderPrefs({ ...headerPrefs, addressFontSize: sz.val })}
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] transition cursor-pointer ${isActive
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                          >
                            {sz.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Slider Bar */}
                    <input
                      type="range"
                      min="8"
                      max="22"
                      step="0.5"
                      value={getFontSizePx(headerPrefs.addressFontSize)}
                      onChange={(e) => updateHeaderPrefs({ ...headerPrefs, addressFontSize: parseFloat(e.target.value) })}
                      className="w-18 accent-brand-600 cursor-pointer"
                      title="Slide to adjust font size"
                    />

                    {/* Number Input in px */}
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="8"
                        max="24"
                        step="0.5"
                        value={getFontSizePx(headerPrefs.addressFontSize)}
                        onChange={(e) => updateHeaderPrefs({ ...headerPrefs, addressFontSize: parseFloat(e.target.value) || 11.5 })}
                        className="w-12 px-1 py-0.5 text-center font-mono font-bold text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-brand-500"
                      />
                      <span className="ml-0.5 text-[10px] text-slate-500 font-mono">px</span>
                    </div>
                  </div>

                  {/* Font Weight: Regular, Semi-bold, Bold */}
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-600 text-[11px] mr-1">Weight:</span>
                    {[
                      { id: 'normal', label: 'Regular' },
                      { id: 'semibold', label: 'Semi-bold' },
                      { id: 'bold', label: 'Bold' }
                    ].map((wt) => (
                      <button
                        key={wt.id}
                        type="button"
                        onClick={() => updateHeaderPrefs({ ...headerPrefs, addressFontWeight: wt.id })}
                        className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${(headerPrefs.addressFontWeight || 'semibold') === wt.id
                          ? 'bg-brand-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-100'
                          }`}
                      >
                        {wt.label}
                      </button>
                    ))}
                  </div>

                  {/* Text Alignment: Left, Center, Right */}
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-600 text-[11px] mr-1">Align:</span>
                    {[
                      { id: 'left', label: 'Left' },
                      { id: 'center', label: 'Center' },
                      { id: 'right', label: 'Right' }
                    ].map((al) => (
                      <button
                        key={al.id}
                        type="button"
                        onClick={() => updateHeaderPrefs({ ...headerPrefs, addressAlign: al.id })}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${(headerPrefs.addressAlign || 'right') === al.id
                          ? 'bg-brand-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {al.label}
                      </button>
                    ))}
                  </div>

                  {/* Font Style & Formats */}
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <span className="font-bold text-slate-600 text-[11px] mr-1">Style:</span>
                    {[
                      { id: 'sans', label: 'Sans' },
                      { id: 'serif', label: 'Serif' },
                      { id: 'mono', label: 'Mono' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => updateHeaderPrefs({ ...headerPrefs, addressFontFamily: st.id })}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${(headerPrefs.addressFontFamily || 'sans') === st.id
                          ? 'bg-brand-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {st.label}
                      </button>
                    ))}

                    {/* Italic toggle */}
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, addressItalic: !headerPrefs.addressItalic })}
                      className={`ml-1 px-2 py-0.5 rounded text-[11px] italic transition cursor-pointer ${headerPrefs.addressItalic
                        ? 'bg-brand-600 text-white font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      title="Toggle Italic"
                    >
                      Italic
                    </button>

                    {/* Uppercase toggle */}
                    <button
                      type="button"
                      onClick={() => updateHeaderPrefs({ ...headerPrefs, addressUppercase: !headerPrefs.addressUppercase })}
                      className={`px-2 py-0.5 rounded text-[11px] uppercase transition cursor-pointer ${headerPrefs.addressUppercase
                        ? 'bg-brand-600 text-white font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      title="Toggle Uppercase"
                    >
                      Caps
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoice Paper Document */}
        <div className="bg-slate-100/90 rounded-2xl border border-slate-200/90 p-1 sm:p-4">
          {viewMode === 'scroll' && (
            <div className="sm:hidden mb-2 text-center text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 py-1.5 px-2 rounded-xl no-print animate-pulse">
              👈 Swipe horizontally to view all columns & totals 👉
            </div>
          )}

          <div
            ref={containerRef}
            className={`w-full ${viewMode === 'scroll' ? 'overflow-x-auto touch-pan-x' : 'overflow-hidden'} flex justify-center`}
          >
            <div
              ref={printRef}
              style={{
                width: '740px',
                minWidth: '740px',
                margin: '0 auto',
                zoom: viewMode === 'fit' ? mobileScale : 1
              }}
              className="my-1 sm:my-2"
            >
              {template === 'industrial' ? (
                <IndustrialTemplate
                  invoice={{ ...invoice, image1_url: currentLogoSrc || invoice?.image1_url }}
                  company={{
                    ...effectiveCompany,
                    logo_url: currentLogoSrc || effectiveCompany.logo_url
                  }}
                  headerPreferences={{ ...headerPrefs, logoUrl: currentLogoSrc }}
                />
              ) : (
                <ModernGstTemplate
                  invoice={{ ...invoice, image1_url: currentLogoSrc || invoice?.image1_url }}
                  company={{
                    ...effectiveCompany,
                    logo_url: currentLogoSrc || effectiveCompany.logo_url
                  }}
                  headerPreferences={{ ...headerPrefs, logoUrl: currentLogoSrc }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

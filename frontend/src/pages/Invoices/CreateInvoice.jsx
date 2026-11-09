import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { numberToIndianWords } from '../../utils/numberToIndianWords';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import InvoicePreviewModal from '../../components/InvoicePreviewModal';
import Modal from '../../components/Modal';
import ColumnPreferencesModal from '../../components/ColumnPreferencesModal';
import {
  getStoredPreferences,
  saveStoredPreferences,
  getInvoiceEffectivePreferences,
  DEFAULT_ITEM_COLUMNS,
  DEFAULT_DC_FIELDS
} from '../../utils/columnPreferences';
import {
  FilePlus,
  Trash2,
  Plus,
  Eye,
  Save,
  Building2,
  Calendar,
  Truck,
  Receipt,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  Edit2,
  ExternalLink,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'billpro_create_invoice_draft';

export default function CreateInvoice() {
  const { user, company } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedGstId, setSelectedGstId] = useState('');
  const [selectedGstNumber, setSelectedGstNumber] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  // DC Challan details
  const [inDcNo, setInDcNo] = useState('');
  const [inDcDate, setInDcDate] = useState('');
  const [outDcNo, setOutDcNo] = useState('');
  const [outDcDate, setOutDcDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Items (Initialized empty with 0s for new bills)
  const [items, setItems] = useState([
    {
      product_id: '',
      description: '',
      sq_ft: '',
      quantity: '0',
      unit: 'Nos',
      rate: '0',
      discount: '0',
      gst_rate: 0
    }
  ]);

  const [isInterState, setIsInterState] = useState(false);
  const [applyGstOnTotal, setApplyGstOnTotal] = useState(true);
  const [billGstRate, setBillGstRate] = useState(18); // Default 18% applied on total bill
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(company?.terms_conditions || '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within due date.\n3. Subject to Pune jurisdiction.');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');

  // Preview Modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Quick Customer & GST Modals State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    city: 'Pune',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '',
    initial_gst: '',
    initial_branch: 'Main HO'
  });

  const [showAddGstModal, setShowAddGstModal] = useState(false);
  const [savingGst, setSavingGst] = useState(false);
  const [gstForm, setGstForm] = useState({
    gst_number: '',
    branch_name: '',
    state_name: 'Maharashtra',
    is_default: false
  });

  // Column Preferences State (Customizable Column & Field Names, Show/Hide, Add/Delete)
  const [columnPreferences, setColumnPreferences] = useState(() => {
    const stored = getStoredPreferences();
    return {
      ...stored,
      dcFields: (stored.dcFields || DEFAULT_DC_FIELDS).map(f => ({ ...f, visible: true }))
    };
  });
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [columnModalTab, setColumnModalTab] = useState('items'); // 'items' or 'dc'
  const [customDcValues, setCustomDcValues] = useState({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeLogoUrl, setActiveLogoUrl] = useState(company?.logo_url || '');

  useEffect(() => {
    if (company?.logo_url) {
      setActiveLogoUrl(company.logo_url);
    } else {
      api.get('/images').then(res => {
        if (res.success && Array.isArray(res.images) && res.images.length > 0) {
          const logo = res.images.find(img => img.image_slot === 1 || img.image_type === 'logo') || res.images[0];
          if (logo?.file_path) setActiveLogoUrl(logo.file_path);
        }
      }).catch(() => { });
    }
  }, [company?.logo_url]);

  const handleSaveColumnPreferences = (updated) => {
    setColumnPreferences(updated);
    saveStoredPreferences(updated);
    success('Column preferences saved successfully!');
  };

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      if (isEditMode) {
        const [custRes, prodRes, invRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
          api.get(`/invoices/${id}`)
        ]);

        if (custRes.success) setCustomers(custRes.customers);
        if (prodRes.success) setProducts(prodRes.products);

        if (invRes.success && invRes.invoice) {
          const inv = invRes.invoice;
          setInvoiceNumber(inv.invoice_number);
          setInvoiceDate(inv.invoice_date || '');
          setDueDate(inv.due_date || '');
          setInDcNo(inv.in_dc_no || '');
          setInDcDate(inv.in_dc_date || '');
          setOutDcNo(inv.out_dc_no || '');
          setOutDcDate(inv.out_dc_date || '');
          setSelectedCustomerId(inv.customer_id);
          setSelectedGstId(inv.customer_gst_id || '');
          setSelectedGstNumber(inv.selected_gst_number || '');
          setIsInterState(Boolean(inv.igst_amount > 0));
          setNotes(inv.notes || '');
          setTerms(inv.terms || '');
          setPaymentStatus(inv.payment_status || 'paid');
          setPaymentMode(inv.payment_mode || 'Bank Transfer');

          const effectivePrefs = getInvoiceEffectivePreferences(inv);
          setColumnPreferences(effectivePrefs);

          if (inv.custom_dc_values) {
            setCustomDcValues(inv.custom_dc_values);
          }

          if (inv.items && inv.items.length > 0) {
            setItems(inv.items.map(it => ({
              ...it,
              product_id: it.product_id || '',
              description: it.description || '',
              sq_ft: it.sq_ft !== null && it.sq_ft !== undefined ? String(it.sq_ft) : '',
              quantity: String(it.quantity || 1),
              unit: it.unit || 'Nos',
              rate: String(it.rate || 0),
              discount: String(it.discount || 0),
              gst_rate: it.gst_rate !== undefined ? it.gst_rate : 18
            })));
          }

          const matchedCust = custRes.customers?.find(c => c.id === inv.customer_id);
          if (matchedCust) {
            setSelectedCustomer(matchedCust);
          } else {
            setSelectedCustomer({
              id: inv.customer_id,
              name: inv.customer_name,
              address: inv.customer_address,
              city: inv.customer_city,
              state: inv.customer_state,
              phone: inv.customer_phone,
              email: inv.customer_email
            });
          }
        }
      } else {
        const [custRes, prodRes, nextNoRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
          api.get('/invoices/next-number')
        ]);

        if (custRes.success) setCustomers(custRes.customers);
        if (prodRes.success) setProducts(prodRes.products);
        if (nextNoRes.success) setInvoiceNumber(nextNoRes.nextNumber);

        // Check if there is an auto-saved draft from before refresh
        let hasRestoredDraft = false;
        try {
          const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (rawDraft) {
            const draft = JSON.parse(rawDraft);
            const hasDraftContent = Boolean(
              (draft.items && draft.items.length > 0 && draft.items.some(it => it.description || it.sq_ft || (it.rate && it.rate !== '0') || (it.quantity && it.quantity !== '0'))) ||
              draft.inDcNo ||
              draft.outDcNo ||
              draft.notes ||
              draft.selectedCustomerId
            );

            if (hasDraftContent) {
              if (draft.inDcNo !== undefined) setInDcNo(draft.inDcNo);
              if (draft.inDcDate !== undefined) setInDcDate(draft.inDcDate);
              if (draft.outDcNo !== undefined) setOutDcNo(draft.outDcNo);
              if (draft.outDcDate !== undefined) setOutDcDate(draft.outDcDate);
              if (draft.notes !== undefined) setNotes(draft.notes);
              if (draft.terms !== undefined) setTerms(draft.terms);
              if (draft.paymentStatus !== undefined) setPaymentStatus(draft.paymentStatus);
              if (draft.paymentMode !== undefined) setPaymentMode(draft.paymentMode);
              if (draft.customDcValues) setCustomDcValues(draft.customDcValues);
              if (draft.applyGstOnTotal !== undefined) setApplyGstOnTotal(draft.applyGstOnTotal);
              if (draft.billGstRate !== undefined) setBillGstRate(draft.billGstRate);
              if (draft.isInterState !== undefined) setIsInterState(draft.isInterState);

              if (Array.isArray(draft.items) && draft.items.length > 0) {
                setItems(draft.items);
              }

              if (draft.selectedCustomerId && custRes.customers?.length > 0) {
                handleCustomerSelect(draft.selectedCustomerId, custRes.customers);
                if (draft.selectedGstId) setSelectedGstId(draft.selectedGstId);
                if (draft.selectedGstNumber) setSelectedGstNumber(draft.selectedGstNumber);
              } else if (custRes.customers?.length > 0) {
                handleCustomerSelect(custRes.customers[0].id, custRes.customers);
              }

              hasRestoredDraft = true;
              setDraftRestored(true);
            }
          }
        } catch (e) {
          console.error('Failed to load draft:', e);
        }

        if (!hasRestoredDraft) {
          // Reset all fields to clean 0 / empty for new invoice
          setInDcNo('');
          setInDcDate('');
          setOutDcNo('');
          setOutDcDate(new Date().toISOString().split('T')[0]);
          setNotes('');
          setItems([
            {
              product_id: '',
              description: '',
              sq_ft: '',
              quantity: '0',
              unit: 'Nos',
              rate: '0',
              discount: '0',
              gst_rate: 0
            }
          ]);
          setCustomDcValues({});

          // Auto-select first customer if available
          if (custRes.customers?.length > 0) {
            handleCustomerSelect(custRes.customers[0].id, custRes.customers);
          }
        }
      }
    } catch (err) {
      console.error('Error loading invoice form data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = async (customerId, custList = customers) => {
    if (!customerId) {
      setSelectedCustomerId('');
      setSelectedCustomer(null);
      setSelectedGstId('');
      setSelectedGstNumber('');
      return;
    }

    const custId = parseInt(customerId, 10);
    setSelectedCustomerId(custId);
    const cust = custList.find(c => c.id === custId);
    setSelectedCustomer(cust || null);

    if (cust && cust.gst_numbers && cust.gst_numbers.length > 0) {
      // Auto select default GST or first GST
      const def = cust.gst_numbers.find(g => g.is_default) || cust.gst_numbers[0];
      setSelectedGstId(def.id);
      setSelectedGstNumber(def.gst_number);

      // Auto detect Inter-state vs Intra-state
      const compState = (company?.state || 'Maharashtra').trim().toLowerCase();
      const custState = (cust.state || 'Maharashtra').trim().toLowerCase();
      setIsInterState(compState !== custState);
    } else {
      setSelectedGstId('');
      setSelectedGstNumber('');
    }

    // Automatically configure Invoice & Delivery Challan (DC) Information & Item Columns for this company
    if (!isEditMode && custId) {
      try {
        const res = await api.get(`/customers/${custId}/previous-config`);
        if (res.success && res.hasPreviousInvoice) {
          // Company has a previous invoice: Auto-select its exact DC fields and invoice columns!
          const effective = getInvoiceEffectivePreferences({
            ...res,
            in_dc_no: res.in_dc_no,
            out_dc_no: res.out_dc_no,
            items: res.items,
            custom_dc_values: res.custom_dc_values,
            column_preferences: res.column_preferences
          });
          setColumnPreferences(effective);

          // Populate previous DC details & notes/terms if not already typed
          if (res.custom_dc_values && Object.keys(res.custom_dc_values).length > 0) {
            setCustomDcValues(res.custom_dc_values);
          }
          if (res.in_dc_no && !inDcNo) setInDcNo(res.in_dc_no);
          if (res.out_dc_no && !outDcNo) setOutDcNo(res.out_dc_no);
          if (res.payment_mode) setPaymentMode(res.payment_mode);
          if (res.notes && !notes) setNotes(res.notes);
          if (res.terms && !terms) setTerms(res.terms);

          // Auto-populate prior bill items if current table is empty/untouched
          const isSingleEmptyRow = items.length === 1 && !items[0].description && (!items[0].rate || items[0].rate === '0');
          if (isSingleEmptyRow && res.items && res.items.length > 0) {
            setItems(res.items);
          }
        } else {
          // Company has no prior invoice: Automatically ensure ALL standard Delivery Challan (DC) fields and Invoice Columns are selected & visible!
          setColumnPreferences(prev => {
            const current = prev || getStoredPreferences();
            return {
              ...current,
              dcFields: (current.dcFields || DEFAULT_DC_FIELDS).map(f => ({ ...f, visible: true })),
              itemColumns: (current.itemColumns || DEFAULT_ITEM_COLUMNS).map(c => ({
                ...c,
                visible: c.id === 'discount' || c.id === 'gst_rate' ? Boolean(c.visible) : true
              }))
            };
          });
        }
      } catch (err) {
        // Fallback: ensure standard DC fields are visible
        setColumnPreferences(prev => {
          const current = prev || getStoredPreferences();
          return {
            ...current,
            dcFields: (current.dcFields || DEFAULT_DC_FIELDS).map(f => ({ ...f, visible: true }))
          };
        });
      }
    }
  };

  const handleGstSelect = (gstId) => {
    setSelectedGstId(gstId);
    if (!gstId) {
      setSelectedGstNumber('');
      return;
    }
    const gstObj = selectedCustomer?.gst_numbers?.find(g => g.id === parseInt(gstId, 10));
    if (gstObj) {
      setSelectedGstNumber(gstObj.gst_number);
    }
  };

  // Auto-save invoice draft so refresh / accidental reload never removes user-inserted data
  useEffect(() => {
    if (isEditMode || loading) return;

    const hasContent = Boolean(
      inDcNo ||
      outDcNo ||
      notes ||
      (selectedCustomerId && selectedCustomerId !== '') ||
      items.some(it => it.description || it.sq_ft || (it.rate && it.rate !== '0') || (it.quantity && it.quantity !== '0')) ||
      (customDcValues && Object.keys(customDcValues).length > 0)
    );

    if (hasContent) {
      const draftData = {
        selectedCustomerId,
        selectedGstId,
        selectedGstNumber,
        inDcNo,
        inDcDate,
        outDcNo,
        outDcDate,
        notes,
        terms,
        paymentStatus,
        paymentMode,
        items,
        isInterState,
        applyGstOnTotal,
        billGstRate,
        customDcValues,
        updatedAt: Date.now()
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      } catch (e) {
        console.error('Failed to auto-save draft:', e);
      }
    }
  }, [
    isEditMode,
    loading,
    selectedCustomerId,
    selectedGstId,
    selectedGstNumber,
    inDcNo,
    inDcDate,
    outDcNo,
    outDcDate,
    notes,
    terms,
    paymentStatus,
    paymentMode,
    items,
    isInterState,
    applyGstOnTotal,
    billGstRate,
    customDcValues
  ]);

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) { }
    setDraftRestored(false);
    setInDcNo('');
    setInDcDate('');
    setOutDcNo('');
    setOutDcDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setCustomDcValues({});
    setItems([
      {
        product_id: '',
        description: '',
        sq_ft: '',
        quantity: '0',
        unit: 'Nos',
        rate: '0',
        discount: '0',
        gst_rate: 0
      }
    ]);
    if (customers.length > 0) {
      handleCustomerSelect(customers[0].id, customers);
    }
    success('Invoice draft cleared. Starting fresh.');
  };

  // Quick Add/Edit Customer Handlers
  const handleOpenNewCustomerModal = () => {
    setIsEditingCustomer(false);
    setCustomerForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      city: 'Pune',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '',
      initial_gst: '',
      initial_branch: 'Main HO'
    });
    setShowCustomerModal(true);
  };

  const handleOpenEditCustomerModal = () => {
    if (!selectedCustomer) return;
    setIsEditingCustomer(true);
    setCustomerForm({
      name: selectedCustomer.name || '',
      contact_person: selectedCustomer.contact_person || '',
      phone: selectedCustomer.phone || '',
      email: selectedCustomer.email || '',
      address: selectedCustomer.address || '',
      city: selectedCustomer.city || '',
      state: selectedCustomer.state || 'Maharashtra',
      state_code: selectedCustomer.state_code || '27',
      pincode: selectedCustomer.pincode || '',
      initial_gst: '',
      initial_branch: ''
    });
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      error('Company / Customer name is required.');
      return;
    }
    setSavingCustomer(true);
    try {
      const payload = {
        name: customerForm.name.trim(),
        contact_person: customerForm.contact_person,
        phone: customerForm.phone,
        email: customerForm.email,
        address: customerForm.address,
        city: customerForm.city,
        state: customerForm.state,
        state_code: customerForm.state_code || '27',
        pincode: customerForm.pincode,
        gst_numbers: !isEditingCustomer && customerForm.initial_gst.trim() ? [
          {
            gst_number: customerForm.initial_gst.trim().toUpperCase(),
            branch_name: customerForm.initial_branch || 'Main HO',
            state_name: customerForm.state,
            is_default: 1
          }
        ] : []
      };

      if (isEditingCustomer && selectedCustomerId) {
        const res = await api.put(`/customers/${selectedCustomerId}`, payload);
        if (res.success) {
          success('Customer details updated successfully!');
          setShowCustomerModal(false);
          const custRes = await api.get('/customers');
          if (custRes.success) {
            setCustomers(custRes.customers);
            handleCustomerSelect(selectedCustomerId, custRes.customers);
          }
        }
      } else {
        const res = await api.post('/customers', payload);
        if (res.success && res.customer) {
          success('New company added successfully!');
          setShowCustomerModal(false);
          const newCust = res.customer;
          const updatedList = [newCust, ...customers];
          setCustomers(updatedList);
          handleCustomerSelect(newCust.id, updatedList);
        }
      }
    } catch (err) {
      error(err.message || 'Failed to save customer.');
    } finally {
      setSavingCustomer(false);
    }
  };

  // Quick Add GST Handler
  const handleSaveGst = async (e) => {
    e.preventDefault();
    if (!gstForm.gst_number.trim()) {
      error('GST Number is required.');
      return;
    }
    if (!selectedCustomerId) {
      error('Please select a customer first.');
      return;
    }

    setSavingGst(true);
    try {
      const res = await api.post(`/customers/${selectedCustomerId}/gst-numbers`, {
        gst_number: gstForm.gst_number.trim().toUpperCase(),
        branch_name: gstForm.branch_name || 'Branch Unit',
        state_name: gstForm.state_name || selectedCustomer?.state || 'Maharashtra',
        is_default: gstForm.is_default ? 1 : 0
      });

      if (res.success) {
        success('New GST number added successfully!');
        setShowAddGstModal(false);
        setGstForm({ gst_number: '', branch_name: '', state_name: 'Maharashtra', is_default: false });

        const updatedCustomer = {
          ...selectedCustomer,
          gst_numbers: res.gst_numbers || []
        };
        setSelectedCustomer(updatedCustomer);
        setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? updatedCustomer : c));

        if (res.gst && res.gst.id) {
          setSelectedGstId(res.gst.id);
          setSelectedGstNumber(res.gst.gst_number);
        }
      }
    } catch (err) {
      error(err.message || 'Failed to add GST number.');
    } finally {
      setSavingGst(false);
    }
  };

  // Line Item Handlers
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        product_id: '',
        description: '',
        sq_ft: '',
        quantity: '0',
        unit: 'Nos',
        rate: '0',
        discount: '0',
        gst_rate: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      error('Invoice must have at least one product row.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If product chosen from catalog, auto-fill description, unit, rate, gst
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === parseInt(value, 10));
        if (prod) {
          updated[index].description = prod.name + (prod.description ? ` - ${prod.description}` : '');
          updated[index].unit = prod.unit || 'Nos';
          updated[index].rate = prod.price || '0';
          updated[index].gst_rate = prod.gst_rate !== undefined ? prod.gst_rate : 0;
        }
      }
      return updated;
    });
  };

  // Live Calculations (Supports GST on Total Bill or Per-Item GST)
  const calculateTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxableAmount = 0;
    let totalGst = 0;

    const isBillGst = applyGstOnTotal && billGstRate !== null && billGstRate !== undefined;
    const effectiveBillGstRate = isBillGst ? parseFloat(billGstRate) : null;

    const processedItems = items.map((item, idx) => {
      const qty = isNaN(parseFloat(item.quantity)) ? 0 : parseFloat(item.quantity);
      const rate = parseFloat(item.rate) || 0;
      const sqFt = parseFloat(item.sq_ft) || 0;
      const discount = parseFloat(item.discount) || 0;
      const itemGstRate = isBillGst ? (effectiveBillGstRate || 0) : (parseFloat(item.gst_rate) || 0);

      const multiplier = sqFt > 0 ? sqFt : qty;
      const rawTotal = multiplier * rate;
      const lineTaxable = Math.max(0, rawTotal - discount);
      const lineGst = (lineTaxable * itemGstRate) / 100;
      // Row total is base taxable amount (e.g. Qty * Rate) so GST is applied cleanly at bill total
      const lineTotal = lineTaxable;

      subtotal += rawTotal;
      discountTotal += discount;
      taxableAmount += lineTaxable;
      totalGst += lineGst;

      return {
        ...item,
        item_no: idx + 1,
        taxable_value: lineTaxable,
        gst_rate: itemGstRate,
        gst_amount: lineGst,
        total_amount: lineTotal
      };
    });

    // If applying GST on total bill, calculate GST directly from total taxable amount
    if (isBillGst) {
      totalGst = Math.round(((taxableAmount * effectiveBillGstRate) / 100) * 100) / 100;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      igst = totalGst;
    } else {
      cgst = totalGst / 2;
      sgst = totalGst / 2;
    }

    const grandTotal = Math.round((taxableAmount + totalGst) * 100) / 100;
    const amountInWords = numberToIndianWords(grandTotal);

    return {
      items: processedItems,
      subtotal,
      discount_total: discountTotal,
      taxable_amount: taxableAmount,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_gst: totalGst,
      grand_total: grandTotal,
      amount_in_words: amountInWords,
      bill_gst_rate: effectiveBillGstRate
    };
  };

  const calculated = calculateTotals();

  const handleOpenPreview = () => {
    if (!selectedCustomer) {
      error('Please select a customer first.');
      return;
    }

    const invoicePayload = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      in_dc_no: inDcNo,
      in_dc_date: inDcDate,
      out_dc_no: outDcNo,
      out_dc_date: outDcDate,
      customer_name: selectedCustomer.name,
      customer_address: selectedCustomer.address,
      customer_city: selectedCustomer.city,
      customer_state: selectedCustomer.state,
      customer_pincode: selectedCustomer.pincode,
      customer_phone: selectedCustomer.phone,
      selected_gst_number: selectedGstNumber,
      items: calculated.items,
      subtotal: calculated.subtotal,
      discount_total: calculated.discount_total,
      taxable_amount: calculated.taxable_amount,
      cgst_amount: calculated.cgst_amount,
      sgst_amount: calculated.sgst_amount,
      igst_amount: calculated.igst_amount,
      total_gst: calculated.total_gst,
      grand_total: calculated.grand_total,
      amount_in_words: calculated.amount_in_words,
      payment_status: paymentStatus,
      payment_mode: paymentMode,
      notes: notes,
      terms: terms,
      company: company,
      column_preferences: columnPreferences,
      custom_dc_values: customDcValues,
      bill_gst_rate: applyGstOnTotal ? billGstRate : null,
      apply_gst_on_total: applyGstOnTotal,
      image1_url: activeLogoUrl || company?.logo_url || '',
      header_preferences: columnPreferences?.headerPreferences,
      invoice_title: columnPreferences?.headerPreferences?.invoiceTitle || 'INVOICE'
    };

    setPreviewData(invoicePayload);
    setShowPreview(true);
  };

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      error('Please select a customer.');
      return;
    }

    if (items.some(it => !it.description.trim())) {
      error('All product rows must have a description.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        customer_gst_id: selectedGstId || null,
        selected_gst_number: selectedGstNumber,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        in_dc_no: inDcNo,
        in_dc_date: inDcDate || null,
        out_dc_no: outDcNo,
        out_dc_date: outDcDate || null,
        customer_name: selectedCustomer.name,
        customer_address: selectedCustomer.address,
        customer_phone: selectedCustomer.phone,
        customer_email: selectedCustomer.email,
        customer_city: selectedCustomer.city,
        customer_state: selectedCustomer.state,
        customer_state_code: selectedCustomer.state_code,
        items: items,
        is_inter_state: isInterState,
        bill_gst_rate: applyGstOnTotal ? billGstRate : null,
        apply_gst_on_total: applyGstOnTotal,
        payment_status: paymentStatus,
        payment_mode: paymentMode,
        notes: notes,
        terms: terms,
        column_preferences: columnPreferences,
        custom_dc_values: customDcValues,
        image1_url: activeLogoUrl || company?.logo_url || previewData?.image1_url || ''
      };

      let res;
      if (isEditMode) {
        res = await api.put(`/invoices/${id}`, payload);
      } else {
        res = await api.post('/invoices', payload);
      }

      if (res.success) {
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch (e) { }
        success(isEditMode ? 'Invoice updated successfully!' : 'Invoice generated and saved successfully!');
        navigate('/invoices');
      }
    } catch (err) {
      error(err.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <FilePlus className="w-7 h-7 text-brand-600" />
              <span>{isEditMode ? `Edit Bill / Invoice #${invoiceNumber}` : 'Create Bill / Invoice'}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditMode ? 'Modify items, delivery challans, or customer details' : 'Live GST calculation, automatic Indian currency words, and DC tracking'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-sm flex items-center gap-2 transition"
          >
            <Eye className="w-4 h-4 text-brand-600" />
            <span>Preview Invoice</span>
          </button>

          <button
            type="button"
            onClick={handleSubmitInvoice}
            disabled={saving}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? (isEditMode ? 'Updating...' : 'Generating...') : (isEditMode ? 'Update Invoice' : 'Save & Issue Invoice')}</span>
          </button>
        </div>
      </div>

      {/* Draft Restored Notification Banner */}
      {draftRestored && !isEditMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200 rounded-2xl text-amber-900 text-xs shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-base">📝</span>
            <div>
              <span className="font-bold">Draft Preserved:</span>
              <span className="text-amber-800 ml-1">Your entered items and invoice details were automatically restored after page refresh.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
            title="Wipe draft and start a clean blank invoice"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
            <span>Clear / Start Blank</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmitInvoice} className="space-y-6">
        {/* Your Business Issuer Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700">Issuer / Billed From:</span>
            <span className="font-bold text-slate-900">{company?.company_name || 'My Business'}</span>
            {company?.gstin && (
              <span className="font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                GSTIN: {company.gstin}
              </span>
            )}
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">{company?.city || 'Pune'}</span>
          </div>
          <Link
            to="/settings"
            className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:underline"
            title="Change your own business name, GSTIN, works address, or bank details in Settings"
          >
            <span>Change Your Business Name / GSTIN in Settings</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Section 1: Customer Selection & Multi-GST Picker */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span>Customer & GST Details (Billed To)</span>
            </h3>
            <button
              type="button"
              onClick={handleOpenNewCustomerModal}
              className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition px-2.5 py-1 bg-brand-50 hover:bg-brand-100 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Customer / Company</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Dropdown with + Add New Company button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Customer / Company *
                </label>
                <button
                  type="button"
                  onClick={handleOpenNewCustomerModal}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add New</span>
                </button>
              </div>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city || 'Pune'})
                  </option>
                ))}
              </select>
            </div>

            {/* Saved GST Number Dropdown with + Add GST No button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Customer GST Number *
                </label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setShowAddGstModal(true)}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5"
                    title="Add new GST number for this customer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add GST</span>
                  </button>
                )}
              </div>
              <select
                value={selectedGstId}
                onChange={(e) => handleGstSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-brand-300 bg-brand-50/40 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {selectedCustomer?.gst_numbers?.length > 0 ? (
                  selectedCustomer.gst_numbers.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.gst_number} {g.branch_name ? `(${g.branch_name})` : ''} {g.is_default ? '• Default' : ''}
                    </option>
                  ))
                ) : (
                  <option value="">No GST Numbers (Unregistered)</option>
                )}
              </select>
            </div>

            {/* Tax Regime (Intra-state vs Inter-state) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Tax Type / Place of Supply
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsInterState(false)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${!isInterState
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                >
                  Intra-State (CGST + SGST)
                </button>
                <button
                  type="button"
                  onClick={() => setIsInterState(true)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${isInterState
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                >
                  Inter-State (IGST)
                </button>
              </div>
            </div>
          </div>

          {/* Customer Address Preview Pill with Quick Edit Button */}
          {selectedCustomer && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div>
                  <strong>Address:</strong> {selectedCustomer.address || 'N/A'}, {selectedCustomer.city} ({selectedCustomer.state})
                </div>
                <div className="flex gap-4 text-[11px] text-slate-500">
                  <span><strong>Phone:</strong> {selectedCustomer.phone || '-'}</span>
                  <span><strong>Email:</strong> {selectedCustomer.email || '-'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenEditCustomerModal}
                className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-300 shadow-sm flex items-center gap-1.5 transition"
                title="Edit this customer's name, address, or details"
              >
                <Edit2 className="w-3.5 h-3.5 text-brand-600" />
                <span>Edit Company Details</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Invoice & Delivery Challan (DC) Metadata */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span>Invoice & Delivery Challan (DC) Information</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setColumnModalTab('dc');
                setShowColumnModal(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              title="Edit field names, add multiple custom DC fields, or delete fields"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
              <span>⚙️ Customize DC Fields</span>
            </button>
          </div>

          <div className={`grid gap-4 w-full ${columnPreferences.dcFields.filter(f => f.visible).length === 1
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              : columnPreferences.dcFields.filter(f => f.visible).length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : columnPreferences.dcFields.filter(f => f.visible).length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : columnPreferences.dcFields.filter(f => f.visible).length === 4
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : columnPreferences.dcFields.filter(f => f.visible).length === 5
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            }`}>
            {columnPreferences.dcFields.filter(f => f.visible).map((field) => {
              if (field.id === 'invoice_no') {
                return (
                  <div key={field.id}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate" title={field.label}>
                      {field.label} *
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="INV-101"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                );
              }
              if (field.id === 'invoice_date') {
                return (
                  <div key={field.id}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate" title={field.label}>
                      {field.label} *
                    </label>
                    <input
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                );
              }
              if (field.id === 'in_dc_no') {
                return (
                  <div key={field.id}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate" title={field.label}>
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={inDcNo}
                      onChange={(e) => setInDcNo(e.target.value)}
                      placeholder={field.placeholder || "e.g. IN-104"}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                );
              }
              if (field.id === 'in_dc_date') {
                return (
                  <div key={field.id}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate" title={field.label}>
                      {field.label}
                    </label>
                    <input
                      type="date"
                      value={inDcDate}
                      onChange={(e) => setInDcDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                );
              }
              if (field.id === 'out_dc_no') {
                return (
                  <div key={field.id}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate" title={field.label}>
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={outDcNo}
                      onChange={(e) => setOutDcNo(e.target.value)}
                      placeholder={field.placeholder || "432"}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-brand-700 bg-brand-50/50 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                );
              }
              if (field.id === 'out_dc_date') {
                return (
                  <div key={field.id}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 truncate" title={field.label}>
                      {field.label}
                    </label>
                    <input
                      type="date"
                      value={outDcDate}
                      onChange={(e) => setOutDcDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                );
              }

              // Custom added DC fields (e.g. Vehicle No, PO Date, E-Way Bill)
              return (
                <div key={field.id}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-700 mb-1 truncate" title={field.label}>
                    {field.label}
                  </label>
                  <input
                    type={field.type || 'text'}
                    value={customDcValues[field.key] || ''}
                    onChange={(e) => setCustomDcValues({ ...customDcValues, [field.key]: e.target.value })}
                    placeholder={field.placeholder || `Enter ${field.label}...`}
                    className="w-full px-3 py-2 border border-purple-200 bg-purple-50/30 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Product Line Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand-600" />
              <span>Product & Job Work Items</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setColumnModalTab('items');
                  setShowColumnModal(true);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                title="Edit column names, add multiple custom columns, or delete columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
                <span>⚙️ Customize Columns</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Product Row</span>
              </button>
            </div>
          </div>

          {/* GST Calculation Preference: Bill-Level GST vs Per-Product */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-brand-50/80 via-blue-50/50 to-slate-50 border border-brand-200 rounded-xl">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyGstOnTotal}
                  onChange={(e) => setApplyGstOnTotal(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Apply GST on Total Bill (Not Per Product)
                </span>
              </label>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                • Each row shows base product amount; GST is calculated on total bill amount.
              </span>
            </div>

            {applyGstOnTotal && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-brand-900">
                  Bill GST Rate:
                </label>
                <select
                  value={billGstRate}
                  onChange={(e) => setBillGstRate(parseFloat(e.target.value))}
                  className="px-2.5 py-1.5 bg-white border border-brand-300 font-bold text-xs rounded-xl shadow-sm focus:ring-2 focus:ring-brand-500 font-mono text-brand-900"
                >
                  <option value={18}>18% (CGST 9% + SGST 9%)</option>
                  <option value={12}>12% (CGST 6% + SGST 6%)</option>
                  <option value={5}>5% (CGST 2.5% + SGST 2.5%)</option>
                  <option value={28}>28% (CGST 14% + SGST 14%)</option>
                  <option value={0}>0% (No GST / Exempt)</option>
                </select>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-left">
                  {columnPreferences.itemColumns.filter(c => c.visible).map((col) => (
                    <th key={col.id} className={`py-2.5 px-2 ${col.width || ''}`} title={col.label}>
                      {col.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const qty = isNaN(parseFloat(item.quantity)) ? 0 : parseFloat(item.quantity);
                  const rate = parseFloat(item.rate) || 0;
                  const sqFt = parseFloat(item.sq_ft) || 0;
                  const discount = parseFloat(item.discount) || 0;
                  const gstRate = applyGstOnTotal ? billGstRate : (parseFloat(item.gst_rate) || 0);

                  const multiplier = sqFt > 0 ? sqFt : qty;
                  const lineTaxable = Math.max(0, multiplier * rate - discount);
                  const lineGst = (lineTaxable * gstRate) / 100;
                  // Row total is base taxable amount (e.g. Qty * Rate) without tax added into product row
                  const rowTotal = lineTaxable;

                  const visibleColumns = columnPreferences.itemColumns.filter(c => c.visible);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {visibleColumns.map((col) => {
                        if (col.id === 'item_no') {
                          return (
                            <td key={col.id} className="py-2.5 px-2 text-center font-mono text-slate-400">
                              {idx + 1}
                            </td>
                          );
                        }
                        if (col.id === 'catalog') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <select
                                value={item.product_id || ''}
                                onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                              >
                                <option value="">-- Quick Select --</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                          );
                        }
                        if (col.id === 'description') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <input
                                type="text"
                                required
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                placeholder="Item Description"
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none font-medium"
                              />
                            </td>
                          );
                        }
                        if (col.id === 'sq_ft') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <input
                                type="number"
                                step="any"
                                value={item.sq_ft}
                                onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                onChange={(e) => handleItemChange(idx, 'sq_ft', e.target.value)}
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-center focus:outline-none"
                              />
                            </td>
                          );
                        }
                        if (col.id === 'quantity') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <input
                                type="number"
                                step="any"
                                required
                                value={item.quantity}
                                onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                placeholder="1"
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-center focus:outline-none"
                              />
                            </td>
                          );
                        }
                        if (col.id === 'unit') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <select
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                className="w-full px-1.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-center"
                              >
                                <option value="Nos">Nos</option>
                                <option value="Sq.Ft">Sq.Ft</option>
                                <option value="Pcs">Pcs</option>
                                <option value="Kgs">Kgs</option>
                                <option value="Mtr">Mtr</option>
                              </select>
                            </td>
                          );
                        }
                        if (col.id === 'rate') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <input
                                type="number"
                                step="any"
                                required
                                value={item.rate}
                                onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-right focus:outline-none font-bold"
                              />
                            </td>
                          );
                        }
                        if (col.id === 'discount') {
                          return (
                            <td key={col.id} className="py-2.5 px-2">
                              <input
                                type="number"
                                step="any"
                                value={item.discount}
                                onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-right focus:outline-none"
                              />
                            </td>
                          );
                        }
                        if (col.id === 'gst_rate') {
                          return (
                            <td key={col.id} className="py-2.5 px-2 text-center">
                              {applyGstOnTotal ? (
                                <span
                                  className="inline-block px-2 py-1 rounded-md bg-brand-50 text-brand-700 font-mono font-bold text-[11px] border border-brand-200"
                                  title="GST applied on the total bill"
                                >
                                  {billGstRate}%
                                </span>
                              ) : (
                                <select
                                  value={item.gst_rate}
                                  onChange={(e) => handleItemChange(idx, 'gst_rate', parseFloat(e.target.value))}
                                  className="w-full px-1.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={12}>12%</option>
                                  <option value={18}>18%</option>
                                  <option value={28}>28%</option>
                                </select>
                              )}
                            </td>
                          );
                        }
                        if (col.id === 'total') {
                          return (
                            <td key={col.id} className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                              {formatNumber(rowTotal)}
                            </td>
                          );
                        }

                        // Custom Column Input
                        return (
                          <td key={col.id} className="py-2.5 px-2">
                            <input
                              type={col.type || 'text'}
                              value={item[col.key] || ''}
                              onChange={(e) => handleItemChange(idx, col.key, e.target.value)}
                              placeholder={col.label}
                              className="w-full px-2 py-1.5 border border-purple-200 bg-purple-50/20 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none text-center"
                            />
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Remove item row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/20 text-brand-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Another Product</span>
          </button>
        </div>

        {/* Section 4: Live Totals & Amount in Indian Currency Words */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Notes & Terms */}
          <div className="md:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Job Work Notes / Dispatch Details
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. POWDER COATING JOB WORK"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Payment Status & Mode Manual Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-bold uppercase focus:ring-2 focus:outline-none transition ${paymentStatus === 'paid'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-400'
                    : paymentStatus === 'partial'
                      ? 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-400'
                      : paymentStatus === 'cancelled'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-400'
                        : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-400'
                    }`}
                >
                  <option value="paid">● Paid</option>
                  <option value="unpaid">● Unpaid</option>
                  <option value="partial">● Partial</option>
                  <option value="cancelled">● Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI / QR">UPI / QR Code</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Terms and Conditions
              </label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Amount In Indian Currency Words (Live Update!) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block mb-1">
                Amount In Words (Indian Currency)
              </span>
              <p className="text-xs font-black text-blue-950 uppercase leading-relaxed font-mono">
                {calculated.amount_in_words || 'Rupees Zero Only'}
              </p>
            </div>
          </div>

          {/* Right Calculations Card */}
          <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              Invoice Calculation Summary
            </h4>

            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">{formatCurrency(calculated.subtotal)}</span>
            </div>

            {calculated.discount_total > 0 && (
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono font-semibold">- {formatCurrency(calculated.discount_total)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-mono font-semibold">{formatCurrency(calculated.taxable_amount)}</span>
            </div>

            {applyGstOnTotal && (
              <div className="flex items-center justify-between text-xs p-2.5 bg-brand-50/80 border border-brand-200 rounded-xl my-1">
                <span className="font-bold text-brand-950">GST on Total Bill:</span>
                <select
                  value={billGstRate}
                  onChange={(e) => setBillGstRate(parseFloat(e.target.value))}
                  className="px-2 py-1 bg-white border border-brand-300 rounded-lg font-bold font-mono text-xs text-brand-900 shadow-sm focus:outline-none"
                >
                  <option value={18}>18% (9% + 9%)</option>
                  <option value={12}>12% (6% + 6%)</option>
                  <option value={5}>5% (2.5% + 2.5%)</option>
                  <option value={28}>28% (14% + 14%)</option>
                  <option value={0}>0% (No GST)</option>
                </select>
              </div>
            )}

            {!isInterState ? (
              <>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>CGST {applyGstOnTotal && billGstRate > 0 ? `(${billGstRate / 2}%)` : ''}:</span>
                  <span className="font-mono">{formatCurrency(calculated.cgst_amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>SGST {applyGstOnTotal && billGstRate > 0 ? `(${billGstRate / 2}%)` : ''}:</span>
                  <span className="font-mono">{formatCurrency(calculated.sgst_amount)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-xs text-slate-600">
                <span>IGST {applyGstOnTotal && billGstRate > 0 ? `(${billGstRate}%)` : ''}:</span>
                <span className="font-mono">{formatCurrency(calculated.igst_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-brand-900 font-bold border-t border-slate-100 pt-2">
              <span>Total GST:</span>
              <span className="font-mono">{formatCurrency(calculated.total_gst)}</span>
            </div>

            <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center text-slate-900">
              <span className="font-black text-sm">Grand Total:</span>
              <span className="text-xl font-black font-mono text-brand-700">
                {formatCurrency(calculated.grand_total)}
              </span>
            </div>
          </div>
        </div>


        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-sm flex items-center gap-2 transition"
          >
            <Eye className="w-4 h-4 text-brand-600" />
            <span>Preview Invoice</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/25 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? (isEditMode ? 'Updating...' : 'Generating...') : (isEditMode ? 'Update Invoice' : 'Save & Issue Invoice')}</span>
          </button>
        </div>
      </form>

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        invoice={previewData}
        company={{ ...(company || {}), logo_url: activeLogoUrl || company?.logo_url }}
      />

      {/* Quick Add / Edit Customer Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title={isEditingCustomer ? 'Edit Company / Customer Details' : 'Add New Customer / Company'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Company / Customer Name *
              </label>
              <input
                type="text"
                required
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="e.g. Tata Motors Ltd or Apex Engineering"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={customerForm.contact_person}
                onChange={(e) => setCustomerForm({ ...customerForm, contact_person: e.target.value })}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                placeholder="e.g. 9822001122"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                placeholder="billing@company.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={customerForm.city}
                onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                placeholder="Pune"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                placeholder="Street address, MIDC Industrial Area"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={customerForm.state}
                onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                placeholder="Maharashtra"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={customerForm.pincode}
                onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value })}
                placeholder="411041"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {!isEditingCustomer && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    GSTIN / GST Number
                  </label>
                  <input
                    type="text"
                    value={customerForm.initial_gst}
                    onChange={(e) => setCustomerForm({ ...customerForm, initial_gst: e.target.value })}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full px-3 py-2 border border-brand-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Branch / Unit Name
                  </label>
                  <input
                    type="text"
                    value={customerForm.initial_branch}
                    onChange={(e) => setCustomerForm({ ...customerForm, initial_branch: e.target.value })}
                    placeholder="Head Office / Pune Plant"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCustomer}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
            >
              {savingCustomer ? 'Saving...' : (isEditingCustomer ? 'Update Company' : 'Add & Select Company')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add GST Number Modal */}
      <Modal
        isOpen={showAddGstModal}
        onClose={() => setShowAddGstModal(false)}
        title={`Add GST Number for ${selectedCustomer?.name || 'Customer'}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveGst} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              New GST Number (15 Digits) *
            </label>
            <input
              type="text"
              required
              value={gstForm.gst_number}
              onChange={(e) => setGstForm({ ...gstForm, gst_number: e.target.value })}
              placeholder="e.g. 27ABCDE1234F1Z5"
              className="w-full px-3 py-2 border border-brand-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Branch / Unit / State Description
            </label>
            <input
              type="text"
              value={gstForm.branch_name}
              onChange={(e) => setGstForm({ ...gstForm, branch_name: e.target.value })}
              placeholder="e.g. Chakan Works, Bhosari Unit, Gujarat Plant"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              State Name
            </label>
            <input
              type="text"
              value={gstForm.state_name}
              onChange={(e) => setGstForm({ ...gstForm, state_name: e.target.value })}
              placeholder="e.g. Maharashtra, Karnataka, Gujarat"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="gst_is_default"
              checked={gstForm.is_default}
              onChange={(e) => setGstForm({ ...gstForm, is_default: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
            <label htmlFor="gst_is_default" className="text-xs font-semibold text-slate-700">
              Set as primary / default GST number for this customer
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddGstModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingGst}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
            >
              {savingGst ? 'Adding...' : 'Add & Use GST Number'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Column & Field Customization Preferences Modal */}
      <ColumnPreferencesModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        initialPreferences={columnPreferences}
        onSave={handleSaveColumnPreferences}
        activeTabDefault={columnModalTab}
      />
    </div>
  );
}

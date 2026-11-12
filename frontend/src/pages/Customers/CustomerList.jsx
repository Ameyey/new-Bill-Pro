import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  Star,
  ExternalLink,
  Building,
  ShieldCheck
} from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { success, error } = useToast();

  // Customer Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '',
    notes: '',
    gst_numbers: [{ gst_number: '', branch_name: 'Main / HO', state_name: 'Maharashtra', is_default: 1 }]
  });

  // GST Number Manager Modal state (for dedicated managing of GSTs on an existing customer)
  const [gstManagerCustomer, setGstManagerCustomer] = useState(null);
  const [newGstNumber, setNewGstNumber] = useState('');
  const [newGstBranch, setNewGstBranch] = useState('');
  const [newGstState, setNewGstState] = useState('');

  // Delete Dialog state
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (res.success) {
        setCustomers(res.customers);
      }
    } catch (err) {
      error(err.message || 'Failed to fetch customers.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '',
      notes: '',
      gst_numbers: [{ gst_number: '', branch_name: 'Main / HO', state_name: 'Maharashtra', is_default: 1 }]
    });
    setShowModal(true);
  };

  const handleOpenEdit = (cust) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name || '',
      contact_person: cust.contact_person || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      city: cust.city || '',
      state: cust.state || 'Maharashtra',
      state_code: cust.state_code || '27',
      pincode: cust.pincode || '',
      notes: cust.notes || '',
      gst_numbers: cust.gst_numbers || []
    });
    setShowModal(true);
  };

  // Add GST number input row in create/edit modal
  const handleAddGstRow = () => {
    setFormData(prev => ({
      ...prev,
      gst_numbers: [
        ...prev.gst_numbers,
        { gst_number: '', branch_name: '', state_name: prev.state || '', is_default: 0 }
      ]
    }));
  };

  const handleRemoveGstRow = (index) => {
    setFormData(prev => ({
      ...prev,
      gst_numbers: prev.gst_numbers.filter((_, i) => i !== index)
    }));
  };

  const handleGstChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.gst_numbers];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, gst_numbers: updated };
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      error('Customer/Company name is required.');
      return;
    }

    try {
      if (editingCustomer) {
        const res = await api.put(`/customers/${editingCustomer.id}`, formData);
        if (res.success) {
          success('Customer updated successfully!');
          setShowModal(false);
          fetchCustomers();
        }
      } else {
        const res = await api.post('/customers', formData);
        if (res.success) {
          success('Customer created successfully!');
          setShowModal(false);
          fetchCustomers();
        }
      }
    } catch (err) {
      error(err.message || 'Failed to save customer.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/customers/${deleteId}`);
      if (res.success) {
        success('Customer deleted successfully.');
        setDeleteId(null);
        fetchCustomers();
      }
    } catch (err) {
      error(err.message || 'Failed to delete customer.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Dedicated GST Manager Handlers
  const handleOpenGstManager = (cust) => {
    setGstManagerCustomer(cust);
    setNewGstNumber('');
    setNewGstBranch('');
    setNewGstState(cust.state || '');
  };

  const handleAddNewGstToCustomer = async (e) => {
    e.preventDefault();
    if (!newGstNumber.trim()) {
      error('Please enter a valid GST number.');
      return;
    }

    try {
      const res = await api.post(`/customers/${gstManagerCustomer.id}/gst-numbers`, {
        gst_number: newGstNumber.trim(),
        branch_name: newGstBranch.trim(),
        state_name: newGstState.trim(),
        is_default: gstManagerCustomer.gst_numbers?.length === 0 ? 1 : 0
      });

      if (res.success) {
        success('GST number added permanently!');
        setNewGstNumber('');
        setNewGstBranch('');
        // Update local state
        setGstManagerCustomer(prev => ({
          ...prev,
          gst_numbers: res.gst_numbers
        }));
        fetchCustomers();
      }
    } catch (err) {
      error(err.message || 'Failed to add GST number.');
    }
  };

  const handleDeleteGstNumber = async (gstId) => {
    try {
      const res = await api.delete(`/customers/${gstManagerCustomer.id}/gst-numbers/${gstId}`);
      if (res.success) {
        success('GST number removed.');
        setGstManagerCustomer(prev => ({
          ...prev,
          gst_numbers: res.gst_numbers
        }));
        fetchCustomers();
      }
    } catch (err) {
      error(err.message || 'Failed to delete GST number.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-brand-600" />
            <span>Customers & Companies</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Store clients, contact details, and multiple permanent GST registration numbers
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-600/20 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name, contact person, phone, or city..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white focus:outline-none transition"
          />
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {customers.map((cust) => {
          const defaultGst = cust.gst_numbers?.find(g => g.is_default) || cust.gst_numbers?.[0];
          return (
            <div
              key={cust.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 p-5 flex flex-col justify-between"
            >
              <div>
                {/* Title & Actions */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">{cust.name}</h3>
                    {cust.contact_person && (
                      <p className="text-xs text-slate-500 font-medium">{cust.contact_person}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(cust)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                      title="Edit Customer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(cust.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  {cust.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{cust.phone}</span>
                    </div>
                  )}
                  {cust.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{cust.email}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {cust.address ? `${cust.address}, ` : ''}
                      {cust.city || 'Pune'} {cust.state ? `, ${cust.state}` : ''} {cust.pincode}
                    </span>
                  </div>
                </div>

                {/* Multiple GST Numbers Section */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                      <span>Saved GST Numbers ({cust.gst_numbers?.length || 0})</span>
                    </span>
                    <button
                      onClick={() => handleOpenGstManager(cust)}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      + Manage GST
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {cust.gst_numbers?.length > 0 ? (
                      cust.gst_numbers.slice(0, 3).map((gst, idx) => (
                        <div
                          key={gst.id || idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono font-bold text-slate-800">{gst.gst_number}</span>
                            {gst.branch_name && (
                              <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {gst.branch_name}
                              </span>
                            )}
                          </div>
                          {gst.is_default === 1 && (
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No GST registered (Unregistered Buyer)</p>
                    )}
                    {cust.gst_numbers?.length > 3 && (
                      <p className="text-[10px] text-slate-400 text-right">
                        +{cust.gst_numbers.length - 3} more GST numbers
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {customers.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No Customers Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by adding your first customer or company along with their GST numbers.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              Add First Customer
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Customer Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Company / Customer Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. A.B.C Engineering"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="e.g. Mr. Vijay Patil"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 123456789"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="accounts@company.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Address
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. address ........"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Pune"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                State & Code
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Maharashtra"
                  className="col-span-2 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={formData.state_code}
                  onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
                  placeholder="27"
                  className="col-span-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-center focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Multiple GST Numbers Sub-Form (During customer creation) */}
          {!editingCustomer && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  <span>GST Numbers (Add Multiple)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddGstRow}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another GST</span>
                </button>
              </div>

              {formData.gst_numbers.map((gst, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    value={gst.gst_number}
                    onChange={(e) => handleGstChange(idx, 'gst_number', e.target.value.toUpperCase())}
                    placeholder="e.g. 27ABCDE1234F1235"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-semibold uppercase bg-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={gst.branch_name}
                    onChange={(e) => handleGstChange(idx, 'branch_name', e.target.value)}
                    placeholder="Branch / Unit (e.g. Pune HO)"
                    className="w-36 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none"
                  />
                  {formData.gst_numbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGstRow(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md"
            >
              {editingCustomer ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dedicated GST Numbers Management Modal */}
      {gstManagerCustomer && (
        <Modal
          isOpen={Boolean(gstManagerCustomer)}
          onClose={() => setGstManagerCustomer(null)}
          title={`Manage GST Numbers • ${gstManagerCustomer.name}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-5">
            {/* Add New GST Number Form */}
            <form onSubmit={handleAddNewGstToCustomer} className="p-3.5 bg-brand-50/60 rounded-2xl border border-brand-100 space-y-3">
              <span className="text-xs font-bold uppercase text-brand-900 block">
                + Add Another GST Number
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={newGstNumber}
                  onChange={(e) => setNewGstNumber(e.target.value.toUpperCase())}
                  placeholder="27ABCDE1234F1Z5"
                  className="sm:col-span-2 px-3 py-2 border border-brand-200 rounded-xl text-xs font-mono font-bold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="text"
                  value={newGstBranch}
                  onChange={(e) => setNewGstBranch(e.target.value)}
                  placeholder="Branch / Unit"
                  className="px-3 py-2 border border-brand-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                Save GST Number Permanently
              </button>
            </form>

            {/* List of Saved GST Numbers */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase text-slate-500 block">
                Permanently Saved GST Numbers ({gstManagerCustomer.gst_numbers?.length || 0})
              </span>

              {gstManagerCustomer.gst_numbers?.map((gst) => (
                <div
                  key={gst.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{gst.gst_number}</span>
                      {gst.is_default === 1 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    {gst.branch_name && (
                      <p className="text-[11px] text-slate-500 mt-0.5">Branch: {gst.branch_name}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteGstNumber(gst.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="Delete GST Number"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer?"
        message="Are you sure you want to delete this customer? All associated GST numbers will also be permanently removed."
        loading={isDeleting}
      />
    </div>
  );
}

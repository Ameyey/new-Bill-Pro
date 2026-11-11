import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
  DEFAULT_ITEM_COLUMNS,
  DEFAULT_DC_FIELDS,
  saveStoredPreferences,
  normalizeItemColumns
} from '../utils/columnPreferences';
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Package,
  Calendar,
  Eye,
  EyeOff,
  Edit3,
  HelpCircle
} from 'lucide-react';

export default function ColumnPreferencesModal({
  isOpen,
  onClose,
  initialPreferences,
  onSave,
  activeTabDefault = 'items'
}) {
  const [activeTab, setActiveTab] = useState(activeTabDefault);
  const [itemColumns, setItemColumns] = useState([]);
  const [dcFields, setDcFields] = useState([]);

  // New column form state
  const [newItemColName, setNewItemColName] = useState('');
  const [newItemColType, setNewItemColType] = useState('text');

  // New DC field form state
  const [newDcFieldName, setNewDcFieldName] = useState('');
  const [newDcFieldType, setNewDcFieldType] = useState('text');

  useEffect(() => {
    if (initialPreferences) {
      const rawCols = initialPreferences.itemColumns || DEFAULT_ITEM_COLUMNS;
      const rawDc = initialPreferences.dcFields || DEFAULT_DC_FIELDS;
      setItemColumns(normalizeItemColumns(rawCols).map(c => ({
        ...c,
        deletable: c.isCustom ? true : c.deletable !== undefined ? c.deletable : (!c.required && !c.fixed)
      })));
      setDcFields(JSON.parse(JSON.stringify(rawDc)).map(f => ({
        ...f,
        deletable: f.isCustom ? true : f.deletable !== undefined ? f.deletable : (!f.required && !f.fixed)
      })));
    }
    setActiveTab(activeTabDefault);
  }, [initialPreferences, isOpen, activeTabDefault]);

  if (!isOpen) return null;

  // --- Item Column Handlers ---
  const handleItemLabelChange = (id, newLabel) => {
    setItemColumns(prev => prev.map(col => col.id === id ? { ...col, label: newLabel } : col));
  };

  const handleToggleItemVisibility = (id) => {
    setItemColumns(prev => prev.map(col => {
      if (col.id === id) {
        if (col.required) return col; // Cannot hide required columns like description, rate, qty
        return { ...col, visible: !col.visible };
      }
      return col;
    }));
  };

  const handleDeleteItemColumn = (id) => {
    setItemColumns(prev => normalizeItemColumns(prev.filter(col => col.id !== id)));
  };

  const handleAddNewItemColumn = (e) => {
    e.preventDefault();
    if (!newItemColName.trim()) return;

    const key = 'custom_' + newItemColName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newCol = {
      id: 'col_' + Date.now(),
      key,
      label: newItemColName.trim(),
      defaultLabel: newItemColName.trim(),
      visible: true,
      deletable: true,
      isCustom: true,
      type: newItemColType,
      isNumeric: newItemColType === 'number',
      width: 'w-24 text-center'
    };

    setItemColumns(prev => normalizeItemColumns([...prev, newCol]));
    setNewItemColName('');
  };

  // --- DC Field Handlers ---
  const handleDcLabelChange = (id, newLabel) => {
    setDcFields(prev => prev.map(f => f.id === id ? { ...f, label: newLabel } : f));
  };

  const handleToggleDcVisibility = (id) => {
    setDcFields(prev => prev.map(f => {
      if (f.id === id) {
        if (f.required) return f;
        return { ...f, visible: !f.visible };
      }
      return f;
    }));
  };

  const handleDeleteDcField = (id) => {
    setDcFields(prev => prev.filter(f => f.id !== id));
  };

  const handleAddNewDcField = (e) => {
    e.preventDefault();
    if (!newDcFieldName.trim()) return;

    const key = 'custom_dc_' + newDcFieldName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newField = {
      id: 'dc_' + Date.now(),
      key,
      label: newDcFieldName.trim(),
      defaultLabel: newDcFieldName.trim(),
      visible: true,
      deletable: true,
      isCustom: true,
      type: newDcFieldType,
      placeholder: `Enter ${newDcFieldName.trim()}...`
    };

    setDcFields(prev => [...prev, newField]);
    setNewDcFieldName('');
  };

  // --- Reset & Save ---
  const handleResetToDefault = () => {
    if (window.confirm('Reset all columns and DC fields to default layout?')) {
      setItemColumns(normalizeItemColumns(DEFAULT_ITEM_COLUMNS));
      setDcFields(JSON.parse(JSON.stringify(DEFAULT_DC_FIELDS)));
    }
  };

  const handleSavePreferences = () => {
    const preferences = {
      itemColumns: normalizeItemColumns(itemColumns),
      dcFields,
      headerPreferences: initialPreferences?.headerPreferences
    };
    saveStoredPreferences(preferences);
    if (onSave) onSave(preferences);
    onClose();
  };

  const missingDefaultDcFields = DEFAULT_DC_FIELDS.filter(def => !dcFields.some(f => f.id === def.id));
  const missingDefaultItemColumns = DEFAULT_ITEM_COLUMNS.filter(def => !itemColumns.some(c => c.id === def.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Columns & Field Preferences" maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Description Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
          <SlidersHorizontal className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-900 block">Personalize your invoice layout:</span>
            Edit any column or field name, add multiple custom columns, and delete or hide columns you do not need. Your preferences are saved automatically for all new invoices and PDF prints.
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'items'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Product Item Columns ({itemColumns.filter(c => c.visible).length} Active)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dc')}
            className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'dc'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Invoice & DC Metadata Fields ({dcFields.filter(f => f.visible).length} Active)</span>
          </button>
        </div>

        {/* TAB 1: Item Table Columns */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">Show</th>
                    <th className="py-2.5 px-3">Column Name (Edit to Rename)</th>
                    <th className="py-2.5 px-3 w-32">Original Label</th>
                    <th className="py-2.5 px-3 w-24 text-center">Type</th>
                    <th className="py-2.5 px-3 w-16 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemColumns.map((col) => (
                    <tr
                      key={col.id}
                      className={`hover:bg-slate-50/50 transition ${!col.visible ? 'opacity-40 bg-slate-50/30' : ''}`}
                    >
                      {/* Visibility Toggle */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          disabled={col.required}
                          onClick={() => handleToggleItemVisibility(col.id)}
                          title={col.required ? 'Required column' : col.visible ? 'Click to hide column' : 'Click to show column'}
                          className={`p-1.5 rounded-lg transition ${
                            col.visible
                              ? 'text-brand-600 bg-brand-50 hover:bg-brand-100'
                              : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                          }`}
                        >
                          {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Editable Column Name */}
                      <td className="py-2 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => handleItemLabelChange(col.id, e.target.value)}
                            placeholder={col.defaultLabel}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Default Original Name */}
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                        {col.defaultLabel}
                        {col.isCustom && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-sans font-bold">Custom</span>}
                      </td>

                      {/* Type */}
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono rounded text-[10px]">
                          {col.isNumeric ? 'Number' : 'Text'}
                        </span>
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-3 text-center">
                        {col.isCustom || (col.deletable !== false && !col.required && !col.fixed) ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteItemColumn(col.id)}
                            title="Delete this column"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px] font-semibold italic">Required</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form to Add Multiple Columns */}
            <form onSubmit={handleAddNewItemColumn} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-600" />
                <span>Add Multiple Custom Product Columns</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    New Column Name (e.g. HSN/SAC, Batch No, Weight, Remarks, Color, Size)
                  </label>
                  <input
                    type="text"
                    value={newItemColName}
                    onChange={(e) => setNewItemColName(e.target.value)}
                    placeholder="e.g. HSN/SAC Code or Batch No"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Data Type
                  </label>
                  <select
                    value={newItemColType}
                    onChange={(e) => setNewItemColType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none"
                  >
                    <option value="text">Text (Description / Code)</option>
                    <option value="number">Numeric (Qty / Dimension / Weight)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={!newItemColName.trim()}
                    className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Column</span>
                  </button>
                </div>
              </div>
            </form>

            {missingDefaultItemColumns.length > 0 && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Deleted Standard Columns ({missingDefaultItemColumns.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setItemColumns(prev => normalizeItemColumns([...prev, ...JSON.parse(JSON.stringify(missingDefaultItemColumns))]));
                    }}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    Restore All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {missingDefaultItemColumns.map(col => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setItemColumns(prev => normalizeItemColumns([...prev, JSON.parse(JSON.stringify(col))]))}
                      className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                    >
                      <Plus className="w-3 h-3 text-blue-600" />
                      <span>Add {col.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Invoice & DC Metadata Fields */}
        {activeTab === 'dc' && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">Show</th>
                    <th className="py-2.5 px-3">Field Label (Edit to Rename)</th>
                    <th className="py-2.5 px-3 w-32">Original Field</th>
                    <th className="py-2.5 px-3 w-24 text-center">Type</th>
                    <th className="py-2.5 px-3 w-16 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dcFields.map((field) => (
                    <tr
                      key={field.id}
                      className={`hover:bg-slate-50/50 transition ${!field.visible ? 'opacity-40 bg-slate-50/30' : ''}`}
                    >
                      {/* Visibility Toggle */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          disabled={field.required}
                          onClick={() => handleToggleDcVisibility(field.id)}
                          title={field.required ? 'Required field' : field.visible ? 'Click to hide field' : 'Click to show field'}
                          className={`p-1.5 rounded-lg transition ${
                            field.visible
                              ? 'text-brand-600 bg-brand-50 hover:bg-brand-100'
                              : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                          }`}
                        >
                          {field.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Editable Field Label */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleDcLabelChange(field.id, e.target.value)}
                          placeholder={field.defaultLabel}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      </td>

                      {/* Default Original Field */}
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                        {field.defaultLabel}
                        {field.isCustom && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-sans font-bold">Custom</span>}
                      </td>

                      {/* Type */}
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono rounded text-[10px] capitalize">
                          {field.type || 'text'}
                        </span>
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-3 text-center">
                        {field.isCustom || (field.deletable !== false && !field.required && !field.fixed) ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteDcField(field.id)}
                            title="Delete this field"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px] font-semibold italic">Required</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form to Add Multiple DC Fields */}
            <form onSubmit={handleAddNewDcField} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-600" />
                <span>Add Multiple Custom DC / Delivery Fields</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    New Field Label (e.g. PO Number, Vehicle No, E-Way Bill No, LR Date, Dispatch Mode)
                  </label>
                  <input
                    type="text"
                    value={newDcFieldName}
                    onChange={(e) => setNewDcFieldName(e.target.value)}
                    placeholder="e.g. Vehicle Number or PO Number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newDcFieldType}
                    onChange={(e) => setNewDcFieldType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none"
                  >
                    <option value="text">Text (Alphanumeric)</option>
                    <option value="date">Date (Calendar picker)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={!newDcFieldName.trim()}
                    className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Field</span>
                  </button>
                </div>
              </div>
            </form>

            {missingDefaultDcFields.length > 0 && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Deleted Standard DC Fields ({missingDefaultDcFields.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDcFields(prev => [...prev, ...JSON.parse(JSON.stringify(missingDefaultDcFields))]);
                    }}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    Restore All Standard DC Fields
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {missingDefaultDcFields.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDcFields(prev => [...prev, JSON.parse(JSON.stringify(f))])}
                      className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                    >
                      <Plus className="w-3 h-3 text-blue-600" />
                      <span>Add {f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Layout</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSavePreferences}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-600/20 flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Save Preferences</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

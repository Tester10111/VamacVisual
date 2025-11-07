'use client';

import { useState, useEffect } from 'react';
import { SummaryBranch, PDFExportData, generateDailySummaryPDF } from '@/lib/pdfGenerator';
import { getEasternTimeDate } from '@/lib/api';

// Custom Items Editor Component
interface CustomItemsEditorProps {
  items: Array<{ name: string; quantity: string }>;
  onChange: (items: Array<{ name: string; quantity: string }>) => void;
}

function CustomItemsEditor({ items, onChange }: CustomItemsEditorProps) {
  const [localItems, setLocalItems] = useState<Array<{ name: string; quantity: string }>>(
    items.length > 0 ? items : [{ name: '', quantity: '' }]
  );

  // Sync with prop changes
  useEffect(() => {
    if (items.length > 0) {
      setLocalItems(items);
    } else if (localItems.length === 0 || localItems.every(item => !item.name && !item.quantity)) {
      setLocalItems([{ name: '', quantity: '' }]);
    }
  }, [items]);

  const updateItems = (newItems: Array<{ name: string; quantity: string }>) => {
    setLocalItems(newItems);
    onChange(newItems);
  };

  const addItem = () => {
    updateItems([...localItems, { name: '', quantity: '' }]);
  };

  const removeItem = (index: number) => {
    const newItems = localItems.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      newItems.push({ name: '', quantity: '' });
    }
    updateItems(newItems);
  };

  const updateItem = (index: number, field: 'name' | 'quantity', value: string) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], [field]: value };
    updateItems(newItems);
  };

  return (
    <div className="space-y-2">
      {localItems.map((item, index) => (
        <div key={index} className="flex gap-2 items-center">
          <input
            type="text"
            value={item.name}
            onChange={(e) => updateItem(index, 'name', e.target.value)}
            placeholder="Item name"
            className="input-field flex-1 text-sm"
          />
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
            placeholder="Qty"
            className="input-field w-20 text-sm"
            min="0"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="w-full py-2 bg-purple-200 text-purple-800 rounded hover:bg-purple-300 text-sm font-semibold"
      >
        + Add Custom Item
      </button>
    </div>
  );
}

interface PDFPreviewModalProps {
  initialData: SummaryBranch[];
  date: string;
  onClose: () => void;
}

export default function PDFPreviewModal({ initialData, date, onClose }: PDFPreviewModalProps) {
  const [branches, setBranches] = useState<SummaryBranch[]>(initialData);
  const [shippedBy, setShippedBy] = useState('Taylor');
  const [carrier, setCarrier] = useState('STEFI');
  
  // Helper function to parse custom items string into array
  const parseCustomItems = (customStr: string | undefined): Array<{ name: string; quantity: string }> => {
    if (!customStr || !customStr.trim()) return [];
    return customStr.split(',').map(item => {
      const parts = item.split(':');
      return {
        name: parts[0]?.trim() || '',
        quantity: parts[1]?.trim() || ''
      };
    }).filter(item => item.name || item.quantity);
  };
  
  // Helper function to format custom items array back to string
  const formatCustomItems = (items: Array<{ name: string; quantity: string }>): string => {
    return items
      .filter(item => item.name.trim() && item.quantity.trim())
      .map(item => `${item.name.trim()}:${item.quantity.trim()}`)
      .join(',');
  };

  // Calculate total pallet spaces
  const totalPalletSpaces = branches.reduce((sum, b) => sum + b.pallets, 0);

  const handleBranchUpdate = (index: number, field: keyof SummaryBranch, value: string | number) => {
    const updated = [...branches];
    updated[index] = { ...updated[index], [field]: value };
    setBranches(updated);
  };

  const handleExport = () => {
    if (!shippedBy.trim()) {
      alert('Please enter who shipped this order');
      return;
    }

    const exportData: PDFExportData = {
      branches,
      date: new Date(date + 'T00:00:00'),
      shippedBy,
      carrier,
    };

    generateDailySummaryPDF(exportData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <h2 className="text-3xl font-bold mb-2">📄 PDF Export Preview</h2>
          <p className="text-blue-100">Review and edit the information before generating the PDF</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header Information */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Transfer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shipped By: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={shippedBy}
                  onChange={(e) => setShippedBy(e.target.value)}
                  placeholder="Enter name (e.g., Taylor)"
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Carrier:</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {/* Branch List */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold mb-4">Branch Shipments ({branches.length})</h3>
            
            {branches.map((branch, index) => (
              <div key={index} className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-bold text-blue-700">
                    Branch {branch.branchNumber} - {branch.branchName}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Pallets:</label>
                    <input
                      type="number"
                      value={branch.pallets}
                      onChange={(e) => handleBranchUpdate(index, 'pallets', parseInt(e.target.value) || 0)}
                      className="input-field w-full"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Boxes:</label>
                    <input
                      type="number"
                      value={branch.boxes}
                      onChange={(e) => handleBranchUpdate(index, 'boxes', parseInt(e.target.value) || 0)}
                      className="input-field w-full"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Rolls:</label>
                    <input
                      type="number"
                      value={branch.rolls}
                      onChange={(e) => handleBranchUpdate(index, 'rolls', parseInt(e.target.value) || 0)}
                      className="input-field w-full"
                      min="0"
                    />
                  </div>
                </div>

                {/* Advanced Items */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-semibold text-sm mb-3">Advanced Items</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Fiber-glass:</label>
                      <input
                        type="number"
                        value={branch.fiberglass || 0}
                        onChange={(e) => handleBranchUpdate(index, 'fiberglass', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Water Heaters:</label>
                      <input
                        type="number"
                        value={branch.waterHeaters || 0}
                        onChange={(e) => handleBranchUpdate(index, 'waterHeaters', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Water Rights:</label>
                      <input
                        type="number"
                        value={branch.waterRights || 0}
                        onChange={(e) => handleBranchUpdate(index, 'waterRights', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Box Tub:</label>
                      <input
                        type="number"
                        value={branch.boxTub || 0}
                        onChange={(e) => handleBranchUpdate(index, 'boxTub', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Copper Pipe:</label>
                      <input
                        type="number"
                        value={branch.copperPipe || 0}
                        onChange={(e) => handleBranchUpdate(index, 'copperPipe', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Plastic Pipe:</label>
                      <input
                        type="number"
                        value={branch.plasticPipe || 0}
                        onChange={(e) => handleBranchUpdate(index, 'plasticPipe', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">GALV Pipe:</label>
                      <input
                        type="number"
                        value={branch.galvPipe || 0}
                        onChange={(e) => handleBranchUpdate(index, 'galvPipe', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Black Pipe:</label>
                      <input
                        type="number"
                        value={branch.blackPipe || 0}
                        onChange={(e) => handleBranchUpdate(index, 'blackPipe', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Wood:</label>
                      <input
                        type="number"
                        value={branch.wood || 0}
                        onChange={(e) => handleBranchUpdate(index, 'wood', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Galv STRUT:</label>
                      <input
                        type="number"
                        value={branch.galvStrut || 0}
                        onChange={(e) => handleBranchUpdate(index, 'galvStrut', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">IM-540 TANK:</label>
                      <input
                        type="number"
                        value={branch.im540Tank || 0}
                        onChange={(e) => handleBranchUpdate(index, 'im540Tank', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">IM-1250 TANK:</label>
                      <input
                        type="number"
                        value={branch.im1250Tank || 0}
                        onChange={(e) => handleBranchUpdate(index, 'im1250Tank', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Mail Box:</label>
                      <input
                        type="number"
                        value={branch.mailBox || 0}
                        onChange={(e) => handleBranchUpdate(index, 'mailBox', parseInt(e.target.value) || 0)}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Items Section */}
                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h5 className="font-semibold text-sm mb-3">Custom Items</h5>
                  <CustomItemsEditor
                    items={parseCustomItems(branch.custom)}
                    onChange={(items) => handleBranchUpdate(index, 'custom', formatCustomItems(items))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Transfer # / Notes:</label>
                    <input
                      type="text"
                      value={branch.transferNumber || ''}
                      onChange={(e) => handleBranchUpdate(index, 'transferNumber', e.target.value)}
                      placeholder="Optional"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Additional Notes:</label>
                    <input
                      type="text"
                      value={branch.notes || ''}
                      onChange={(e) => handleBranchUpdate(index, 'notes', e.target.value)}
                      placeholder="Optional"
                      className="input-field w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-blue-900">Total Pallet Spaces:</span>
              <span className="text-3xl font-bold text-blue-700">{totalPalletSpaces}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 p-6 bg-gray-50 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="btn-secondary px-8"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="btn-primary px-8"
            disabled={!shippedBy.trim()}
          >
            📄 Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}


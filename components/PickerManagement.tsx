'use client';

import { useState, useEffect } from 'react';
import { Picker, addPicker, getPickers } from '@/lib/api';
import toast from 'react-hot-toast';

interface PickerManagementProps {
  pickers?: Picker[];
  onClose: () => void;
  onSave: () => void;
}

export default function PickerManagement({ pickers: initialPickers, onClose, onSave }: PickerManagementProps) {
  const [pickers, setPickers] = useState<Picker[]>(initialPickers || []);
  const [isLoading, setIsLoading] = useState(!initialPickers);
  const [editingPicker, setEditingPicker] = useState<Picker | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newPickerID, setNewPickerID] = useState('');
  const [newPickerName, setNewPickerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!initialPickers || initialPickers.length === 0) {
      loadPickers();
    } else {
      setPickers(initialPickers);
      setIsLoading(false);
    }
  }, []);

  const loadPickers = async () => {
    try {
      setIsLoading(true);
      const data = await getPickers();
      setPickers(data);
    } catch (error) {
      console.error('Error loading pickers:', error);
      toast.error('Failed to load pickers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPicker = async () => {
    if (!newPickerID || !newPickerName) {
      toast.error('Please fill in all fields');
      return;
    }

    const pickerIDNum = parseInt(newPickerID);
    if (isNaN(pickerIDNum)) {
      toast.error('Picker ID must be a number');
      return;
    }

    // Check if ID already exists
    if (pickers.some(p => p.pickerID === pickerIDNum)) {
      toast.error('Picker ID already exists');
      return;
    }

    try {
      setIsSubmitting(true);
      await addPicker({
        pickerID: pickerIDNum,
        pickerName: newPickerName.trim(),
      });
      
      toast.success('Picker added successfully!');
      setNewPickerID('');
      setNewPickerName('');
      setIsAdding(false);
      loadPickers(); // Reload pickers
      onSave();
    } catch (error) {
      console.error('Error adding picker:', error);
      toast.error('Failed to add picker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-xl">
          <h2 className="text-2xl font-bold text-white">Picker Management</h2>
          <p className="text-blue-100">Add new pickers or view existing ones</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
          {/* Add New Picker Section */}
          <div className="mb-6">
            {!isAdding ? (
              <button
                onClick={() => setIsAdding(true)}
                className="btn-primary w-full"
              >
                + Add New Picker
              </button>
            ) : (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 animate-slideDown">
                <h3 className="text-lg font-semibold mb-4 text-green-900">Add New Picker</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Picker ID: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={newPickerID}
                      onChange={(e) => setNewPickerID(e.target.value)}
                      placeholder="Enter ID number"
                      className="input-field w-full"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Picker Name: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPickerName}
                      onChange={(e) => setNewPickerName(e.target.value)}
                      placeholder="Enter name"
                      className="input-field w-full"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddPicker}
                    disabled={isSubmitting}
                    className="btn-primary flex-1"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Picker'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewPickerID('');
                      setNewPickerName('');
                    }}
                    disabled={isSubmitting}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing Pickers List */}
          <div>
            <h3 className="text-lg font-semibold mb-4">All Pickers ({pickers.length})</h3>
            {pickers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pickers found. Add your first picker above.
              </div>
            ) : (
              <div className="space-y-2">
                {pickers
                  .sort((a, b) => a.pickerID - b.pickerID)
                  .map((picker) => (
                    <div
                      key={picker.pickerID}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white font-bold rounded-full w-12 h-12 flex items-center justify-center">
                          {picker.pickerID}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{picker.pickerName}</div>
                          <div className="text-sm text-gray-500">ID: {picker.pickerID}</div>
                        </div>
                      </div>
                      {/* Future: Add edit/delete buttons here if needed */}
                    </div>
                  ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


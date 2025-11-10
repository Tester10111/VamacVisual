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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4 py-8 animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-3xl border border-white/12 bg-white/10 backdrop-blur-xl shadow-[0_40px_140px_-50px_rgba(37,99,235,0.85)] flex flex-col overflow-hidden animate-slideUp text-white">
        {/* Header */}
        <div className="px-8 py-7 border-b border-white/10 bg-gradient-to-r from-blue-600/80 via-blue-700/80 to-blue-800/80">
          <h2 className="text-[clamp(1.75rem,2.4vw,2.25rem)] font-semibold leading-tight">Picker Management</h2>
          <p className="text-sm text-blue-100/80 mt-2">Add new pickers or review the current roster.</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-7 space-y-7">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-200"></div>
            </div>
          ) : (
            <>
          {/* Add New Picker Section */}
          <div className="rounded-3xl border border-white/12 bg-white/8 px-6 py-6 md:px-7 md:py-7 shadow-inner">
            {!isAdding ? (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full rounded-full bg-blue-500/90 hover:bg-blue-500 transition text-white text-sm font-semibold tracking-wide py-3 shadow-[0_18px_40px_-18px_rgba(59,130,246,0.9)]"
              >
                + Add New Picker
              </button>
            ) : (
              <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/15 px-6 py-6 md:px-7 md:py-7 space-y-5 animate-slideDown">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <h3 className="text-lg font-semibold text-emerald-100">Add New Picker</h3>
                  <p className="text-xs uppercase tracking-wider text-emerald-200/70">Both fields required</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-emerald-100/80 mb-2">
                      Picker ID <span className="text-emerald-200/80">*</span>
                    </label>
                    <input
                      type="number"
                      value={newPickerID}
                      onChange={(e) => setNewPickerID(e.target.value)}
                      placeholder="Enter ID number"
                      className="input-field w-full bg-white/10 border-white/25 text-white placeholder:text-emerald-100/40 focus:border-emerald-200/70 focus:bg-white/15"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-emerald-100/80 mb-2">
                      Picker Name <span className="text-emerald-200/80">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPickerName}
                      onChange={(e) => setNewPickerName(e.target.value)}
                      placeholder="Enter name"
                      className="input-field w-full bg-white/10 border-white/25 text-white placeholder:text-emerald-100/40 focus:border-emerald-200/70 focus:bg-white/15"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddPicker}
                    disabled={isSubmitting}
                    className="btn-primary flex-1 rounded-full py-3"
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
                    className="btn-secondary flex-1 rounded-full py-3 border border-white/25 bg-white/10 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing Pickers List */}
          <div className="rounded-3xl border border-white/12 bg-white/6 px-6 py-6 md:px-7 md:py-7">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-5">
              <h3 className="text-lg font-semibold">All Pickers ({pickers.length})</h3>
              
            </div>
            {pickers.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-6 text-center text-blue-100/70">
                No pickers found. Add your first picker above.
              </div>
            ) : (
              <div className="space-y-3">
                {pickers
                  .sort((a, b) => a.pickerID - b.pickerID)
                  .map((picker) => (
                    <div
                      key={picker.pickerID}
                      className="rounded-2xl border border-white/12 bg-white/10 px-5 py-4 flex items-center justify-between hover:bg-white/16 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-300/60 bg-blue-600/70 text-white text-lg font-semibold">
                          {picker.pickerID}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{picker.pickerName}</div>
                          <div className="text-xs uppercase tracking-wide text-blue-100/60 mt-1">ID: {picker.pickerID}</div>
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
        <div className="border-t border-white/10 bg-white/6 px-6 py-5">
          <button
            onClick={onClose}
            className="btn-secondary w-full rounded-full border border-white/20 bg-white/10 hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


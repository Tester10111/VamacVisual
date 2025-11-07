'use client';

import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { Branch, BayAssignments, updateBayAssignments, verifyPin, verifyPinLocal, clearBoard, getDailySummary } from '@/lib/api';
import { SummaryBranch } from '@/lib/pdfGenerator';
import HistoryView from './HistoryView';
import PDFPreviewModal from './PDFPreviewModal';
import PickerManagement from './PickerManagement';
import toast from 'react-hot-toast';

interface AdminModeProps {
  branches: Branch[];
  bayAssignments: BayAssignments;
  onExit: () => void;
  onSave: () => void;
}

function DraggableBranch({ branch }: { branch: Branch }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `branch-${branch.branchNumber}`,
    data: { branch },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`branch-badge ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="text-3xl font-bold">Branch {branch.branchNumber}</div>
      <div className="text-lg">{branch.branchName}</div>
    </div>
  );
}

function DroppableBay({ 
  bayNumber, 
  branches, 
  onRemove 
}: { 
  bayNumber: number; 
  branches: Branch[]; 
  onRemove: (branchNumber: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bay-${bayNumber}`,
    data: { bayNumber },
  });

  return (
    <div
      ref={setNodeRef}
      className={`bay-card min-h-[300px] flex flex-col ${branches.length > 0 ? 'occupied' : ''} ${isOver ? 'ring-4 ring-blue-500' : ''}`}
    >
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-gray-700">Bay {bayNumber}</div>
      </div>

      {branches.length > 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          {branches.map((branch) => (
            <div key={branch.branchNumber} className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-4 w-full text-center shadow-xl relative">
              <button
                onClick={() => onRemove(branch.branchNumber)}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
              >
                ×
              </button>
              <div className="text-4xl font-bold mb-1">{branch.branchNumber}</div>
              <div className="text-lg font-semibold">{branch.branchName}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-400 rounded-lg">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">↓</div>
            <div className="text-lg">Drop branch here</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMode({ branches, bayAssignments, onExit, onSave }: AdminModeProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [currentAssignments, setCurrentAssignments] = useState<BayAssignments>(bayAssignments);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPickerManagement, setShowPickerManagement] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDate, setExportDate] = useState('');
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfData, setPdfData] = useState<SummaryBranch[]>([]);
  const [isLoadingPDF, setIsLoadingPDF] = useState(false);

  // Check localStorage for cached admin access
  useEffect(() => {
    const cachedAuth = localStorage.getItem('vamac_admin_authenticated');
    if (cachedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Get all assigned branch numbers
  const getAllAssignedBranches = (): Set<number> => {
    const assigned = new Set<number>();
    Object.values(currentAssignments).forEach(value => {
      if (Array.isArray(value)) {
        value.forEach(bn => assigned.add(bn));
      } else if (value !== null) {
        assigned.add(value as number);
      }
    });
    return assigned;
  };

  const assignedBranches = getAllAssignedBranches();
  const availableBranches = branches.filter(b => !assignedBranches.has(b.branchNumber));

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Quick local check first
      if (!verifyPinLocal(pin)) {
        toast.error('Invalid PIN');
        setPin('');
        return;
      }
      
      // Then verify with server
      const isValid = await verifyPin(pin);
      if (isValid) {
        setIsAuthenticated(true);
        localStorage.setItem('vamac_admin_authenticated', 'true');
        toast.success('Access granted');
      } else {
        toast.error('Invalid PIN');
        setPin('');
      }
    } catch (error) {
      toast.error('Error verifying PIN');
      setPin('');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBranch(null);

    if (!over) return;

    const branch = active.data.current?.branch as Branch;
    const bayNumber = parseInt(over.id.toString().replace('bay-', ''));

    if (branch && bayNumber) {
      setCurrentAssignments(prev => {
        const existing = prev[bayNumber];
        let newValue: number[];
        
        if (Array.isArray(existing)) {
          newValue = [...existing, branch.branchNumber];
        } else if (existing !== null) {
          newValue = [existing as number, branch.branchNumber];
        } else {
          newValue = [branch.branchNumber];
        }
        
        return {
          ...prev,
          [bayNumber]: newValue,
        };
      });
    }
  };

  const handleRemove = (bayNumber: number, branchNumber?: number) => {
    if (branchNumber !== undefined) {
      // Remove specific branch from bay
      setCurrentAssignments(prev => {
        const existing = prev[bayNumber];
        if (Array.isArray(existing)) {
          const filtered = existing.filter(bn => bn !== branchNumber);
          return {
            ...prev,
            [bayNumber]: filtered.length > 0 ? filtered : null,
          };
        } else {
          return {
            ...prev,
            [bayNumber]: null,
          };
        }
      });
    } else {
      // Remove all branches from bay
      setCurrentAssignments(prev => ({
        ...prev,
        [bayNumber]: null,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateBayAssignments(currentAssignments);
      toast.success('Bay assignments saved successfully!');
      onSave();
    } catch (error) {
      toast.error('Error saving assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleClearBoard = async () => {
    if (!confirm('Are you sure you want to clear all bay assignments? This will reset the board.')) {
      return;
    }

    try {
      await clearBoard();
      setCurrentAssignments({ 1: null, 2: null, 3: null, 4: null, 5: null });
      toast.success('Board cleared successfully!');
      onSave();
    } catch (error) {
      toast.error('Error clearing board');
    }
  };

  const handleExportPDF = async (selectedDate?: string) => {
    try {
      const dateToExport = selectedDate || exportDate;
      
      if (!dateToExport) {
        toast.error('Please select a date to export');
        return;
      }

      setIsLoadingPDF(true);
      const result = await getDailySummary(dateToExport);
      
      if (result.data.length === 0) {
        toast.error('No shipments recorded for the selected date.');
        setIsLoadingPDF(false);
        return;
      }

      // Open PDF preview modal
      setPdfData(result.data);
      setShowExportModal(false);
      setShowPDFPreview(true);
    } catch (error) {
      toast.error('Error loading export data');
      console.error(error);
    } finally {
      setIsLoadingPDF(false);
    }
  };

  const openExportModal = () => {
    // Default to current Eastern Time date
    const now = new Date();
    const easternDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    setExportDate(easternDate.toISOString().split('T')[0]);
    setShowExportModal(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('vamac_admin_authenticated');
    setPin('');
    toast.success('Logged out successfully');
  };

  const getBranchesForBay = (bayNumber: number): Branch[] => {
    const branchNumbers = currentAssignments[bayNumber];
    if (!branchNumbers) return [];
    
    const numbers = Array.isArray(branchNumbers) ? branchNumbers : [branchNumbers];
    return numbers
      .filter(n => n !== null)
      .map(num => branches.find(b => b.branchNumber === num))
      .filter(b => b !== undefined) as Branch[];
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full">
          <h2 className="text-3xl font-bold text-center mb-8">Admin Access</h2>
          <form onSubmit={handlePinSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-semibold">Enter PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="input-field w-full text-2xl text-center tracking-widest"
                maxLength={6}
                placeholder="••••••"
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Enter
            </button>
            <button
              type="button"
              onClick={onExit}
              className="btn-secondary w-full mt-4"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return <HistoryView branches={branches} onBack={() => setShowHistory(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Admin Mode - Bay Management</h1>
          <div className="flex gap-4">
            <button onClick={() => setShowPickerManagement(true)} className="btn-secondary">
               Edit Pickers
            </button>
            <button 
              onClick={() => setShowHistory(true)} 
              className="btn-secondary hover:scale-105 transition-transform"
            >
              📊 View History
            </button>
            <button 
              onClick={openExportModal} 
              className="btn-primary hover:scale-105 transition-transform"
            >
              📄 Export as PDF/Excel
            </button>
            <button onClick={handleClearBoard} className="btn-danger">
              Clear Board
            </button>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
            <button onClick={onExit} className="btn-secondary">
              Exit
            </button>
          </div>
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          {/* Available Branches */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">Available Branches</h2>
            <div className="flex flex-wrap gap-4">
              {availableBranches.length > 0 ? (
                availableBranches.map((branch) => (
                  <DraggableBranch key={branch.branchNumber} branch={branch} />
                ))
              ) : (
                <div className="text-gray-500 italic">All branches are assigned</div>
              )}
            </div>
          </div>

          {/* Bays */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-700">Bays (5 → 1)</h2>
            <div className="grid grid-cols-5 gap-6">
              {[5, 4, 3, 2, 1].map((bayNumber) => (
                <DroppableBay
                  key={bayNumber}
                  bayNumber={bayNumber}
                  branches={getBranchesForBay(bayNumber)}
                  onRemove={(branchNumber) => handleRemove(bayNumber, branchNumber)}
                />
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-xl px-12 py-4"
            >
              {saving ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>

          <DragOverlay>
            {activeBranch && (
              <div className="branch-badge opacity-75">
                <div className="text-3xl font-bold">Branch {activeBranch.branchNumber}</div>
                <div className="text-lg">{activeBranch.branchName}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Export PDF Date Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-slideUp">
            <h2 className="text-2xl font-bold mb-6">📄 Export Daily Summary PDF</h2>
            <div className="mb-6">
              <label className="block text-gray-700 mb-2 font-semibold">Select Date</label>
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="input-field w-full text-lg"
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                Choose the date you want to export. All records from that day will be included.
              </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => handleExportPDF()} 
                disabled={isLoadingPDF}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isLoadingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Loading Preview...</span>
                  </>
                ) : (
                  'Continue to Preview'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  setIsLoadingPDF(false);
                }}
                disabled={isLoadingPDF}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview & Edit Modal */}
      {showPDFPreview && (
        <PDFPreviewModal
          initialData={pdfData}
          date={exportDate}
          onClose={() => {
            setShowPDFPreview(false);
            setPdfData([]);
          }}
        />
      )}

      {/* Picker Management Modal */}
      {showPickerManagement && (
        <PickerManagement
          onClose={() => setShowPickerManagement(false)}
          onSave={onSave}
        />
      )}
    </div>
  );
}

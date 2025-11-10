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
      className={`rounded-3xl border border-white/12 bg-slate-950/40 backdrop-blur-md min-h-[260px] flex flex-col transition-all duration-300 ${branches.length > 0 ? 'shadow-2xl shadow-blue-900/40' : 'shadow-inner'} ${isOver ? 'ring-4 ring-blue-400/60' : ''}`}
    >
      <div className="px-5 pt-5 pb-3 text-center border-b border-white/10">
        <div className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold text-white">Bay {bayNumber}</div>
      </div>

      {branches.length > 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 pb-6">
          {branches.map((branch) => (
            <div
              key={branch.branchNumber}
              className="w-full rounded-2xl border border-white/15 bg-gradient-to-br from-blue-600/90 via-blue-700 to-blue-900/90 px-5 py-5 text-center shadow-[0_20px_60px_-40px_rgba(37,99,235,0.8)] relative"
            >
              <button
                onClick={() => onRemove(branch.branchNumber)}
                className="absolute top-3 right-3 rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-xs uppercase tracking-wide text-white hover:bg-white/30 transition"
              >
                Remove
              </button>
              <div className="text-[clamp(2.25rem,3.5vw,3.25rem)] font-bold leading-none mb-2">{branch.branchNumber}</div>
              <div className="text-base font-medium tracking-wide uppercase text-blue-100">Branch {branch.branchName}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-5 pb-6">
          <div className="w-full rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-6 text-center text-blue-100/70">
            <div className="text-4xl mb-2 opacity-80">↓</div>
            <div className="text-sm uppercase tracking-wide">Drop branch here</div>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/8 backdrop-blur-lg shadow-[0_30px_120px_-40px_rgba(59,130,246,0.65)] px-8 py-10 text-white animate-fadeIn">
          <div className="text-center mb-8">
            <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-3">Admin Access</p>
            <h2 className="text-[clamp(1.75rem,2.5vw,2.75rem)] font-semibold leading-tight">Enter Security PIN</h2>
            <p className="text-sm text-blue-100/80 mt-3">Authorized personnel only. PIN is shared with Truck Loading mode.</p>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm uppercase tracking-wide text-blue-100/70">6-digit PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="input-field w-full text-3xl text-center tracking-[0.6em] bg-white/10 border-white/20 text-white placeholder:text-blue-100/30 focus:border-blue-300/70 focus:bg-white/15"
                maxLength={6}
                placeholder="••••••"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-3">
              <button type="submit" className="btn-primary w-full py-3 text-base rounded-full">
                Unlock Admin Mode
              </button>
              <button
                type="button"
                onClick={onExit}
                className="btn-secondary w-full py-3 text-base rounded-full border border-white/25 bg-white/10 hover:bg-white/20"
              >
                Return to Menu
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return <HistoryView branches={branches} onBack={() => setShowHistory(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-10 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-white/6 backdrop-blur-lg shadow-[0_40px_120px_-50px_rgba(37,99,235,0.7)] px-6 py-6 md:px-8 md:py-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between animate-fadeIn">
          <div>
            <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-3">Admin Mode</p>
            <h1 className="text-[clamp(2rem,3vw,3.25rem)] font-semibold leading-tight">Admin Console</h1>
            <p className="text-sm md:text-base text-blue-100/80">
              Assign staged branches, review history, and export daily summaries.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowPickerManagement(true)} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
              Edit Pickers
            </button>
            
            <button
              onClick={openExportModal}
              className="rounded-full bg-blue-500/90 px-5 py-2.5 text-sm font-semibold tracking-wide shadow-[0_10px_30px_-12px_rgba(59,130,246,0.9)] hover:bg-blue-500 transition"
            >
              📄 Export PDF / Excel
            </button>
            <button onClick={handleClearBoard} className="rounded-full border border-red-400/50 bg-red-500/20 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-red-500/30 transition">
              Clear Board
            </button>
            <button onClick={handleLogout} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
              Logout
            </button>
            <button onClick={onExit} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
              Exit
            </button>
          </div>
        </div>

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid gap-8 lg:grid-cols-[1.4fr,2fr]">
            {/* Available Branches */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-semibold">Available Branches</h2>
                    <p className="text-xs uppercase tracking-wide text-blue-100/70">Drag and drop to assign bays</p>
                  </div>
                  <div className="text-xs text-blue-100/60 uppercase tracking-[0.3em]">
                    {availableBranches.length} ready
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {availableBranches.length > 0 ? (
                    availableBranches.map((branch) => (
                      <DraggableBranch key={branch.branchNumber} branch={branch} />
                    ))
                  ) : (
                    <div className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-center text-blue-100/70">
                      All branches currently assigned
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
                <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-2xl border border-blue-400/50 bg-blue-500/20 px-5 py-4 text-left text-sm font-medium tracking-wide hover:bg-blue-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="text-xs uppercase tracking-[0.3em] text-blue-100/70 mb-1">Primary</div>
                    <div className="text-base font-semibold">{saving ? 'Saving...' : 'Save Assignments'}</div>
                    <div className="text-xs text-blue-100/60 mt-1">Updates bay layout</div>
                  </button>
                  <button
                    onClick={() => setShowHistory(true)}
                    className="rounded-2xl border border-white/20 bg-white/12 px-5 py-4 text-left text-sm font-medium tracking-wide hover:bg-white/18 transition"
                  >
                    <div className="text-xs uppercase tracking-[0.3em] text-blue-100/70 mb-1">Review</div>
                    <div className="text-base font-semibold">Stage History</div>
                    <div className="text-xs text-blue-100/60 mt-1">Review History</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Bays */}
            <div className="rounded-3xl border border-white/10 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold">Bay Layout (5 → 1)</h2>
                <div className="text-xs uppercase tracking-[0.3em] text-blue-100/70">Live Grid</div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
          </div>

          <DragOverlay>
            {activeBranch && (
              <div className="branch-badge opacity-80 backdrop-blur-lg">
                <div className="text-3xl font-bold">Branch {activeBranch.branchNumber}</div>
                <div className="text-lg">{activeBranch.branchName}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Export PDF Date Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_30px_100px_-40px_rgba(59,130,246,0.7)] px-8 py-8 text-white animate-slideUp">
            <h2 className="text-[clamp(1.5rem,2.2vw,2rem)] font-semibold mb-3">📄 Export Daily Summary</h2>
            <p className="text-sm text-blue-100/75 mb-6">Review and customize records in the preview before generating the final PDF and Excel files.</p>
            <div className="mb-6 space-y-3">
              <label className="block text-sm uppercase tracking-wide text-blue-100/70">Select Date</label>
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="input-field w-full text-lg bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                required
              />
              <p className="text-xs text-blue-100/70">
                Choose the date you want to export. All recorded branches for the selected day will be included in the preview.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button 
                onClick={() => handleExportPDF()} 
                disabled={isLoadingPDF}
                className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-full py-3"
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
                className="btn-secondary flex-1 rounded-full py-3 border border-white/20 bg-white/10 hover:bg-white/20"
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

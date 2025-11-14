'use client';

import { useState, useEffect } from 'react';
import { Branch, StageRecord, getStageRecords, deleteStageRecord } from '@/lib/api';
import toast from 'react-hot-toast';

interface HistoryViewProps {
  branches: Branch[];
  onBack: () => void;
}

export default function HistoryView({ branches, onBack }: HistoryViewProps) {
  const [records, setRecords] = useState<StageRecord[]>([]);
  // Get current date in Eastern Time
  const getEasternDate = () => {
    const now = new Date();
    const easternDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return easternDate.toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(getEasternDate());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [selectedDate]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      console.log('Loading records for date:', selectedDate);
      const data = await getStageRecords(selectedDate);
      console.log('Received records:', data);
      setRecords(data);
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error('Error loading history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (record: StageRecord) => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      // Use the rowIndex from the record (this is the actual Google Sheets row)
      if (!record.rowIndex) {
        toast.error('Cannot delete record: missing row reference');
        return;
      }

      await deleteStageRecord(record.rowIndex);
      toast.success('Record deleted successfully!');
      loadRecords(); // Reload records
    } catch (error) {
      toast.error('Error deleting record. Please try again.');
      console.error(error);
    }
  };

  const getBranchSummary = () => {
    const summary: Record<number, { branchName: string; pallets: number; boxes: number; rolls: number; transferNumber?: string }> = {};
    
    records.forEach(record => {
      if (!summary[record.branchNumber]) {
        summary[record.branchNumber] = {
          branchName: record.branchName,
          pallets: 0,
          boxes: 0,
          rolls: 0,
          transferNumber: record.transferNumber || undefined,
        };
      }
      summary[record.branchNumber].pallets += record.pallets;
      summary[record.branchNumber].boxes += record.boxes;
      summary[record.branchNumber].rolls += record.rolls;
    });

    return summary;
  };

  const branchSummary = getBranchSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-10 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between animate-fadeIn">
          <div>
            <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-3">Admin Reports</p>
            <h1 className="text-[clamp(2rem,3vw,3.25rem)] font-semibold leading-tight">Stage History</h1>
            <p className="text-sm md:text-base text-blue-100/80">Review staged records by date. </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <label className="text-xs uppercase tracking-wide text-blue-100/70 mb-2 block">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
              />
            </div>
            <button 
              onClick={loadRecords} 
              disabled={loading}
              className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium tracking-wide hover:bg-white/20 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Loading…</span>
                </>
              ) : (
                <>
                  <span>↻</span>
                  <span>Refresh</span>
                </>
              )}
            </button>
            <button onClick={onBack} className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium tracking-wide hover:bg-white/20 transition">
              Back to Admin
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/6 backdrop-blur px-6 py-14 text-center animate-fadeIn">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-200 mb-4 mx-auto"></div>
            <p className="text-blue-100/80">Loading records...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-3xl border border-white/12 bg-white/8 px-6 py-6 shadow-[0_24px_80px_-40px_rgba(59,130,246,0.8)] animate-slideUp" style={{ animationDelay: '0.1s' }}>
                <div className="text-xs uppercase tracking-[0.3em] text-blue-100/70 mb-2">Total Records</div>
                <div className="text-4xl font-bold text-white">{records.length}</div>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/8 px-6 py-6 shadow-[0_24px_80px_-40px_rgba(16,185,129,0.7)] animate-slideUp" style={{ animationDelay: '0.2s' }}>
                <div className="text-xs uppercase tracking-[0.3em] text-blue-100/70 mb-2">Branches Staged</div>
                <div className="text-4xl font-bold text-emerald-200">{Object.keys(branchSummary).length}</div>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/8 px-6 py-6 shadow-[0_24px_80px_-40px_rgba(168,85,247,0.6)] animate-slideUp" style={{ animationDelay: '0.3s' }}>
                <div className="text-xs uppercase tracking-[0.3em] text-blue-100/70 mb-2">Total Pallets</div>
                <div className="text-4xl font-bold text-purple-200">
                  {Object.values(branchSummary).reduce((sum, b) => sum + b.pallets, 0)}
                </div>
              </div>
            </div>

            {/* Branch Summary */}
            <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <h2 className="text-2xl font-semibold">Summary by Branch</h2>
                <p className="text-xs uppercase tracking-wide text-blue-100/70">
                  {Object.keys(branchSummary).length > 0
                    ? `${Object.keys(branchSummary).length} branches recorded`
                    : 'No records for selected date'}
                </p>
              </div>
              {Object.keys(branchSummary).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Object.entries(branchSummary).map(([branchNumber, data]) => (
                    <div key={branchNumber} className="rounded-2xl border border-white/12 bg-white/10 px-5 py-5 space-y-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-blue-100/70 mb-1">
                          Branch {branchNumber}
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {data.branchName}
                          {data.transferNumber && (
                            <span className="text-sm font-normal text-blue-300/80 ml-2">{data.transferNumber}</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-blue-100/80">
                          <span>Pallets</span>
                          <span className="font-semibold text-white">{data.pallets}</span>
                        </div>
                        <div className="flex justify-between text-blue-100/80">
                          <span>Boxes</span>
                          <span className="font-semibold text-white">{data.boxes}</span>
                        </div>
                        <div className="flex justify-between text-blue-100/80">
                          <span>Rolls</span>
                          <span className="font-semibold text-white">{data.rolls}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-8 text-center">
                  <p className="text-base text-blue-100/80 mb-2">No records for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-xs uppercase tracking-wide text-blue-100/60">Try selecting a different date above</p>
                </div>
              )}
            </div>

            {/* Detailed Records */}
            <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <h2 className="text-2xl font-semibold">Detailed Records</h2>
                <p className="text-xs uppercase tracking-wide text-blue-100/70">Chronological log for selected day</p>
              </div>
              {records.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-white/12">
                  <table className="w-full text-sm">
                    <thead className="bg-white/12">
                      <tr className="text-left text-blue-100/70 uppercase tracking-[0.2em] text-xs">
                        <th className="py-4 px-5">Time</th>
                        <th className="py-4 px-5">Picker</th>
                        <th className="py-4 px-5">Branch</th>
                        <th className="py-4 px-5">Transfer #</th>
                        <th className="py-4 px-5 text-right">Pallets</th>
                        <th className="py-4 px-5 text-right">Boxes</th>
                        <th className="py-4 px-5 text-right">Rolls</th>
                        <th className="py-4 px-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/12">
                      {records.map((record, index) => (
                        <tr key={index} className="hover:bg-white/10 transition">
                          <td className="py-4 px-5 text-blue-100">
                            {new Date(record.timestamp).toLocaleTimeString('en-US')}
                          </td>
                          <td className="py-4 px-5">
                            <div className="text-white font-medium">{record.pickerName}</div>
                            <div className="text-xs uppercase tracking-wide text-blue-100/60">ID #{record.pickerID}</div>
                          </td>
                          <td className="py-4 px-5">
                            <div className="text-white font-medium">Branch {record.branchNumber}</div>
                            <div className="text-xs uppercase tracking-wide text-blue-100/60">{record.branchName}</div>
                          </td>
                          <td className="py-4 px-5">
                            {record.transferNumber ? (
                              <div className="text-white font-semibold">{record.transferNumber}</div>
                            ) : (
                              <div className="text-blue-100/50">-</div>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right font-semibold text-white">{record.pallets}</td>
                          <td className="py-4 px-5 text-right font-semibold text-white">{record.boxes}</td>
                          <td className="py-4 px-5 text-right font-semibold text-white">{record.rolls}</td>
                          <td className="py-4 px-5 text-center">
                            <button
                              onClick={() => handleDeleteRecord(record)}
                              className="px-4 py-2 rounded-full border border-red-400/60 bg-red-500/20 text-red-100 text-xs font-semibold uppercase tracking-wide hover:bg-red-500/30 transition"
                              title="Delete this record"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-8 text-center">
                  <p className="text-base text-blue-100/80 mb-2">No detailed records for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-xs uppercase tracking-wide text-blue-100/60">Try selecting a different date above</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


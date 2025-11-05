'use client';

import { useState, useEffect } from 'react';
import { Branch, StageRecord, getStageRecords, deleteStageRecord } from '@/lib/api';

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
      alert('Error loading history: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (index: number) => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteStageRecord(index);
      alert('✅ Record deleted successfully!');
      loadRecords(); // Reload records
    } catch (error) {
      alert('❌ Error deleting record. Please try again.');
      console.error(error);
    }
  };

  const getBranchSummary = () => {
    const summary: Record<number, { branchName: string; pallets: number; boxes: number; rolls: number }> = {};
    
    records.forEach(record => {
      if (!summary[record.branchNumber]) {
        summary[record.branchNumber] = {
          branchName: record.branchName,
          pallets: 0,
          boxes: 0,
          rolls: 0,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Stage History</h1>
            <p className="text-gray-600 mt-2">Select a date to view stage records (Eastern Time)</p>
          </div>
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              />
            </div>
            <button onClick={onBack} className="btn-secondary">
              Back to Admin
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mb-4 mx-auto"></div>
            <p className="text-gray-600">Loading records...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 animate-slideUp" style={{ animationDelay: '0.1s' }}>
                <div className="text-gray-600 mb-2">Total Records</div>
                <div className="text-4xl font-bold text-blue-600">{records.length}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
                <div className="text-gray-600 mb-2">Branches Staged</div>
                <div className="text-4xl font-bold text-green-600">{Object.keys(branchSummary).length}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 animate-slideUp" style={{ animationDelay: '0.3s' }}>
                <div className="text-gray-600 mb-2">Total Pallets</div>
                <div className="text-4xl font-bold text-purple-600">
                  {Object.values(branchSummary).reduce((sum, b) => sum + b.pallets, 0)}
                </div>
              </div>
            </div>

            {/* Branch Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">Summary by Branch</h2>
              {Object.keys(branchSummary).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(branchSummary).map(([branchNumber, data]) => (
                    <div key={branchNumber} className="border-2 border-gray-200 rounded-lg p-4">
                      <div className="font-bold text-lg mb-2">
                        Branch {branchNumber} - {data.branchName}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pallets:</span>
                          <span className="font-semibold">{data.pallets}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Boxes:</span>
                          <span className="font-semibold">{data.boxes}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Rolls:</span>
                          <span className="font-semibold">{data.rolls}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-lg mb-2">No records for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-gray-400 text-sm">Try selecting a different date above</p>
                </div>
              )}
            </div>

            {/* Detailed Records */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Detailed Records</h2>
              {records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-3 px-4">Time</th>
                        <th className="text-left py-3 px-4">Picker</th>
                        <th className="text-left py-3 px-4">Branch</th>
                        <th className="text-right py-3 px-4">Pallets</th>
                        <th className="text-right py-3 px-4">Boxes</th>
                        <th className="text-right py-3 px-4">Rolls</th>
                        <th className="text-center py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {new Date(record.timestamp).toLocaleTimeString('en-US')}
                          </td>
                          <td className="py-3 px-4">
                            {record.pickerName} (#{record.pickerID})
                          </td>
                          <td className="py-3 px-4">
                            Branch {record.branchNumber} - {record.branchName}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">{record.pallets}</td>
                          <td className="py-3 px-4 text-right font-semibold">{record.boxes}</td>
                          <td className="py-3 px-4 text-right font-semibold">{record.rolls}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteRecord(index)}
                              className="text-red-600 hover:text-red-800 font-semibold px-3 py-1 rounded hover:bg-red-50 transition-all"
                              title="Delete this record"
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-lg mb-2">No detailed records for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-gray-400 text-sm">Try selecting a different date above</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


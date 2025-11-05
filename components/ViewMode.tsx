'use client';

import { useState, useEffect } from 'react';
import { Branch, BayAssignments } from '@/lib/api';

interface ViewModeProps {
  branches: Branch[];
  bayAssignments: BayAssignments;
  onExit: () => void;
  onRefresh: () => void;
}

export default function ViewMode({ branches, bayAssignments, onExit, onRefresh }: ViewModeProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Auto-refresh data every 30 seconds
    const refreshTimer = setInterval(() => {
      onRefresh();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
    };
  }, [onRefresh]);

  const getBranchesForBay = (bayNumber: number): Branch[] => {
    const branchNumbers = bayAssignments[bayNumber];
    if (!branchNumbers) return [];
    
    // Handle both array and single number
    const numbers = Array.isArray(branchNumbers) ? branchNumbers : [branchNumbers];
    return numbers
      .filter(n => n !== null)
      .map(num => branches.find(b => b.branchNumber === num))
      .filter(b => b !== undefined) as Branch[];
  };

  return (
    <div className="min-h-screen tv-mode p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <img src="/logo.png" alt="VAMAC Logo" className="h-16 mr-4" onError={(e) => {
            e.currentTarget.style.display = 'none';
          }} />
          <div>
            <h1 className="text-4xl font-bold">VAMAC Warehouse</h1>
            <p className="text-xl text-gray-300">Bay Staging Overview</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">
            {currentTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
          <div className="text-lg text-gray-300">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* Bays - Ordered 5 to 1 (right to left) */}
      <div className="grid grid-cols-5 gap-6 mb-8">
        {[5, 4, 3, 2, 1].map((bayNumber, index) => {
          const bayBranches = getBranchesForBay(bayNumber);
          return (
            <div
              key={bayNumber}
              className={`bay-card min-h-[400px] flex flex-col ${bayBranches.length > 0 ? 'occupied' : ''} animate-slideDown`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="text-center mb-4">
                <div className="text-5xl font-bold text-gray-700 mb-2">Bay {bayNumber}</div>
                <div className="h-1 bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
              </div>

              {bayBranches.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  {bayBranches.map((branch, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-6 w-full text-center shadow-xl animate-scaleIn" style={{ animationDelay: `${idx * 0.15}s` }}>
                      <div className="text-5xl font-bold mb-2">
                        {branch.branchNumber}
                      </div>
                      <div className="text-xl font-semibold mb-1">
                        {branch.branchName}
                      </div>
                      <div className="text-xs opacity-90">
                        Branch {branch.branchNumber}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-6xl mb-4">∅</div>
                    <div className="text-xl">Empty</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Exit Button */}
      <div className="flex justify-center">
        <button
          onClick={onExit}
          className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-lg text-lg transition-all"
        >
          Exit View Mode
        </button>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { Branch, BayAssignments } from '@/lib/api';
import toast from 'react-hot-toast';

interface ViewModeProps {
  branches: Branch[];
  bayAssignments: BayAssignments;
  onExit: () => void;
  onRefresh: () => void;
}

export default function ViewMode({ branches, bayAssignments, onExit, onRefresh }: ViewModeProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const bayOrder = [5, 4, 3, 2, 1];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Auto-refresh data every 30 seconds
    const refreshTimer = setInterval(() => {
      toast.loading('Refreshing...', { duration: 1000 });
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

  const allBaysEmpty = bayOrder.every((bayNumber) => getBranchesForBay(bayNumber).length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-10 flex items-stretch justify-center">
      <div className="w-full max-w-7xl flex flex-col space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-6 shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-4">
            
            <div>
              <p className="uppercase tracking-[0.4em] text-xs text-blue-200/70 mb-2">Live Overview</p>
              <h1 className="text-[clamp(2rem,3vw,3.5rem)] font-semibold text-white leading-tight">
                VAMAC Warehouse Bays
              </h1>
              <p className="text-sm md:text-base text-blue-100/80">
                Real-time staging assignments
              </p>
            </div>
          </div>
          <div className="flex flex-col md:items-end gap-2 text-white">
            <div className="text-[clamp(1.75rem,2.5vw,2.75rem)] font-semibold tracking-tight">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div className="text-sm md:text-base text-blue-100/80">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {allBaysEmpty && (
          <div className="rounded-3xl bg-white/5 border border-white/10 px-6 py-10 text-center text-blue-100 shadow-2xl animate-fadeIn">
            <div className="text-[clamp(3rem,6vw,6.5rem)] leading-none mb-6">🛰️</div>
            <p className="text-[clamp(1.5rem,3vw,2.5rem)] font-semibold mb-2">Awaiting Assignments</p>
            <p className="text-sm md:text-base text-blue-200/80 max-w-xl mx-auto">
              No branches are currently staged across the bays. New assignments will appear here instantly as they are scheduled.
            </p>
          </div>
        )}

        {/* Bays - Ordered 5 to 1 */}
        <div
          className={`grid gap-6 ${
            allBaysEmpty ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          }`}
        >
          {bayOrder.map((bayNumber, index) => {
            const bayBranches = getBranchesForBay(bayNumber);
            return (
              <div
                key={bayNumber}
                className={`rounded-3xl border border-white/10 bg-white/8 backdrop-blur-md shadow-2xl min-h-[360px] flex flex-col transition-all duration-300 hover:border-white/20 hover:shadow-3xl hover:-translate-y-1 ${
                  bayBranches.length > 0 ? 'animate-slideDown' : 'animate-fadeIn'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="px-6 pt-6 pb-4 text-center border-b border-white/10">
                  <div className="text-[clamp(2.25rem,4vw,3.5rem)] font-semibold text-white drop-shadow-sm">
                    Bay {bayNumber}
                  </div>
                  <div className="mt-3 h-0.5 w-20 mx-auto bg-gradient-to-r from-transparent via-blue-300/60 to-transparent rounded-full" />
                </div>

                {bayBranches.length > 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 pb-6">
                    {bayBranches.map((branch, idx) => (
                      <div
                        key={idx}
                        className="w-full rounded-2xl bg-gradient-to-r from-blue-600/90 via-blue-700 to-blue-900/90 px-6 py-6 text-center text-white shadow-lg transition-transform duration-200 animate-scaleIn"
                        style={{ animationDelay: `${idx * 0.15}s` }}
                      >
                        <div className="text-[clamp(2.5rem,3.8vw,4.25rem)] font-extrabold tracking-tight leading-none mb-3">
                          {branch.branchNumber}
                        </div>
                        <div className="text-lg md:text-xl font-medium">
                          {branch.branchName}
                        </div>
                        <div className="text-xs uppercase tracking-wider text-blue-100/80 mt-2">
                          Branch {branch.branchNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center px-6 pb-6">
                    <div className="text-center text-blue-100/70">
                      <div className="text-[clamp(2.75rem,4vw,4.5rem)] mb-3 leading-none opacity-70">∅</div>
                      <div className="text-base md:text-lg tracking-wide uppercase">No assignment</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Exit Button */}
        <div className="flex justify-center pt-4">
          <button
            onClick={onExit}
            className="px-10 py-4 rounded-full bg-white/10 border border-white/20 text-white text-base md:text-lg font-medium tracking-wide transition-all duration-200 hover:bg-white/15 hover:border-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
          >
            Exit View Mode
          </button>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect, Suspense } from 'react';
import ViewMode from '@/components/ViewMode';
import AdminMode from '@/components/AdminMode';
import StageMode from '@/components/StageMode';
import dynamic from 'next/dynamic';
import { getBranches, getPickers, getBayAssignments, getVersion, Branch, Picker, BayAssignments } from '@/lib/api';
import { dataManager } from '@/lib/dataManager';
import { performanceMonitor } from '@/lib/performanceMonitor';
import toast from 'react-hot-toast';

// Lazy load TruckLoadingMode for better performance
const TruckLoadingMode = dynamic(() => import('@/components/TruckLoadingMode'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mb-4 mx-auto"></div>
        <p className="text-white text-xl">Loading Trucks and Staging Area...</p>
      </div>
    </div>
  ),
  ssr: false // TruckLoadingMode is client-side only
});

type Mode = 'select' | 'view' | 'admin' | 'stage' | 'truck';

export default function Home() {
  const [mode, setMode] = useState<Mode>('select');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pickers, setPickers] = useState<Picker[]>([]);
  const [bayAssignments, setBayAssignments] = useState<BayAssignments>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [version, setVersion] = useState<string>('Loading...');

  useEffect(() => {
    // Make dataManager globally accessible for debugging
    if (typeof window !== 'undefined') {
      (window as any).dataManager = dataManager;
      (window as any).performanceMonitor = performanceMonitor;
    }
    
    // Start background data preloading immediately
    dataManager.preloadAllData();
    
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const [branchesData, pickersData, assignmentsData, versionData] = await Promise.all([
        dataManager.getBranchesCached(),
        dataManager.getPickersCached(),
        dataManager.getBayAssignmentsCached(),
        dataManager.getVersionCached(),
      ]);
      setBranches(branchesData);
      setPickers(pickersData);
      setBayAssignments(assignmentsData);
      setVersion(versionData);
    } catch (error) {
      console.error('Error loading data:', error);
      
      // For View Mode, silently retry instead of showing error
      if (mode === 'view' && isRefresh) {
        // Silently retry after 5 seconds
        setTimeout(() => loadData(true), 5000);
      } else if (mode !== 'view') {
        // For other modes, show error
        toast.error('Error loading data. Please check your connection.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const refreshData = () => {
    // For View Mode, do silent refresh
    if (mode === 'view') {
      loadData(true);
    } else {
      // Start background data preloading immediately
    dataManager.preloadAllData();
    
    loadData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mb-4 mx-auto"></div>
          <p className="text-white text-xl">Loading VAMAC Visual...</p>
        </div>
      </div>
    );
  }

  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex flex-col items-center justify-center p-8">
        <div className="mb-12 text-center">
          <img src="/logo.png" alt="VAMAC Logo" className="h-24 mx-auto mb-6" onError={(e) => {
            e.currentTarget.style.display = 'none';
          }} />
          <h1 className="text-6xl font-bold text-white mb-4">VAMAC Visual</h1>
          
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl">
          <button
            onClick={() => setMode('view')}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-12 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 animate-slideUp"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="text-5xl mb-4">📺</div>
            <div className="text-2xl mb-2">View Mode</div>
            <div className="text-sm text-gray-600">Display on TV</div>
          </button>

          <button
            onClick={() => setMode('admin')}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-12 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 animate-slideUp"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="text-5xl mb-4">⚙️</div>
            <div className="text-2xl mb-2">Admin Mode</div>
            <div className="text-sm text-gray-600">Manage Bays</div>
          </button>

          <button
            onClick={() => setMode('stage')}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-12 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 animate-slideUp"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="text-5xl mb-4">📦</div>
            <div className="text-2xl mb-2">Stage Mode</div>
            <div className="text-sm text-gray-600">Record Shipments</div>
          </button>

          <button
            onClick={() => setMode('truck')}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-12 px-8 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 animate-slideUp"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="text-5xl mb-4">🚛</div>
            <div className="text-2xl mb-2">Truck Loading</div>
            <div className="text-sm text-gray-600">Load Trucks</div>
          </button>
        </div>

        <div className="mt-12 text-center text-blue-200 text-sm">
          <p>Select a mode to continue</p>
          <p className="mt-4 text-blue-300 font-medium">Build Version: {version}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {mode === 'view' && (
        <ViewMode
          branches={branches}
          bayAssignments={bayAssignments}
          onExit={() => setMode('select')}
          onRefresh={refreshData}
        />
      )}
      {mode === 'admin' && (
        <AdminMode
          branches={branches}
          bayAssignments={bayAssignments}
          onExit={() => setMode('select')}
          onSave={refreshData}
        />
      )}
      {mode === 'stage' && (
        <StageMode
          branches={branches}
          pickers={pickers}
          onExit={() => setMode('select')}
          onSave={refreshData}
        />
      )}
      {mode === 'truck' && (
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mb-4 mx-auto"></div>
              <p className="text-white text-xl">Loading Truck Loading...</p>
            </div>
          </div>
        }>
          <TruckLoadingMode
            onBack={() => setMode('select')}
          />
        </Suspense>
      )}
    </>
  );
}


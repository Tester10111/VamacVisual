'use client';

import { useState, useEffect, Suspense } from 'react';
import ViewMode from '@/components/ViewMode';
import AdminMode from '@/components/AdminMode';
import StageMode from '@/components/StageMode';
import dynamic from 'next/dynamic';
import { getBranches, getPickers, getBayAssignments, getVersion, Branch, Picker, BayAssignments } from '@/lib/api';
import toast from 'react-hot-toast';

// Simple loading screen component
function SimpleLoadingScreen() {
  const loadingTips = [
    "You're fired. -Taylor",
    "Shout out to my top 3 pokemon lovers: Zay, Christian, Vaughn ",
    "Don't use handwrap shinkwrap for the wrapper... it's loud",
    "Survival Tip: Don't wear headphones!...around Kermit",
    "Pro tip: Scanning slowly actually reduces errors—your scanner appreciates the break.",
    "Did you know? Transfer numbers load faster when your coffee is stronger. (Probably.)",
    "Warehouse wisdom: Every pallet jack has a personality. Some just have a bad attitude.",
    "Insider info: Staging clean = loading clean. Your future self will thank you.",
    "Pro tip: Double-check labels—your accuracy score will thank you later.",
    "Fun fact: The shrink wrap roll ALWAYS runs out when it's your turn to wrap",
    "Did you know? Most mispicks happen before the first cup of coffee. Coincidence? No.",
    "Pro tip: Your order picker battery lasts longer when you whisper encouragement to it.",
    "Warehouse logic: Pallets only fall when someone is looking.",
    "Insider info: The forklift is only slow when you're in a hurry.",
    "Did you know? CDC stands for 'Carefully Delivering Chaos'.",
    "Fun fact: Transfer numbers behave better when grouped by destination.",
    "Pro tip: A well-wrapped pallet can survive an apocalypse. Or at least a bumpy ride.",
    "Insider info: Sorting by aisle saves more time than you'd think.",
    "Fun fact: The warehouse diet is 60% water, 40% complaining, 100% accuracy.",
    "Pro tip: Don't forget to breathe between shipments—your heart rate disagrees.",
    "Dad joke: Why don't pallets ever get lost? They always *stack* together.",
    "Fun fact: 99% of loose boxes almost fall… but don't. Until you turn around.",
    "Pro tip: Always check for hidden items behind pallets—they love to hide.",
    "Did you know? Truck loading becomes 20% faster with good music playing.",
    "Insider info: The master sheet doesn't lie. Except when it does. (Then it's the printer's fault.)",
    "Warehouse humor: If you can't find it—ask that one coworker who somehow knows everything.",
    "Fun fact: The staging area is basically organized chaos… with a barcode.",
    "Pro tip: Keeping your blade sharp saves time and reduces cardboard rage.",
    "Did you know? Most transfer delays start with the phrase: \"It was just right here.\"",
    "Warehouse wisdom: A clean floor is the #1 enemy of stubbed toes everywhere.",
    "Joke: Why did the pallet jack apply for a job? It wanted to *lift* its career.",
    "Vending machines are over-rated, am i right? :)",
    "Bao and Chrisitan ARE NOT bud buddies",
    "Tyler's and Zay almost as good as Bao in receiving"
  ];

  // Start with first tip (deterministic) and then rotate randomly on client
  const [currentTip, setCurrentTip] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // Set initial random tip after hydration to avoid SSR mismatch
    setCurrentTip(Math.floor(Math.random() * loadingTips.length));

    // Rotate tips randomly every 4 seconds
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => {
        let next = prev;
        while (next === prev) {
          next = Math.floor(Math.random() * loadingTips.length);
        }
        return next;
      });
    }, 4000);

    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 5;
      });
    }, 200);

    return () => {
      clearInterval(tipInterval);
      clearInterval(progressInterval);
    };
  }, [loadingTips.length]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
      <div className="text-center max-w-2xl px-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mb-6 mx-auto"></div>
        <p className="text-white text-xl mb-6">Loading Vamac Visual...</p>
        
        {/* Progress bar */}
        <div className="w-64 mx-auto mb-6">
          <div className="w-full bg-blue-800 rounded-full h-2 mb-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <div className="text-white text-sm">
            {Math.round(loadingProgress)}%
          </div>
        </div>

        {/* Loading tip */}
        <div className="bg-blue-800/50 rounded-2xl p-6 mb-6">
          <div className="text-cyan-200 text-sm font-semibold mb-2">
            💡 Loading Tip
          </div>
          <div className="text-white text-lg leading-relaxed">
            {loadingTips[currentTip]}
          </div>
        </div>
        
        <div className="text-blue-200 text-sm">
          Build: 0.92
        </div>
      </div>
    </div>
  );
}

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

  // Initialize imports only on client side
  const [dataManager, setDataManager] = useState<any>(null);
  const [connectionHealthMonitor, setConnectionHealthMonitor] = useState<any>(null);
  const [performanceMonitor, setPerformanceMonitor] = useState<any>(null);

  useEffect(() => {
    try {
      // Dynamic imports to prevent SSR issues
      Promise.all([
        import('@/lib/dataManager'),
        import('@/lib/connectionHealthMonitor'),
        import('@/lib/performanceMonitor')
      ]).then(([dataManagerModule, connectionModule, performanceModule]) => {
        const { dataManager: dm } = dataManagerModule;
        const { connectionHealthMonitor: chm } = connectionModule;
        const { performanceMonitor: pm } = performanceModule;
        
        // Make globally accessible for debugging
        (window as any).__appStartTime = Date.now();
        (window as any).dataManager = dm;
        (window as any).performanceMonitor = pm;
        (window as any).connectionHealthMonitor = chm;
        
        // Set state for use in component
        setDataManager(dm);
        setConnectionHealthMonitor(chm);
        setPerformanceMonitor(pm);
        
        // Start connection health monitoring first
        console.log('🔍 Starting connection health monitoring...');
        chm.start();
        
        // Start background data preloading immediately
        dm.preloadAllData();
        
        loadData(false, dm, chm);
      }).catch((error) => {
        console.error('💥 Error importing modules:', error);
        setLoading(false);
      });
    } catch (error) {
      console.error('💥 Error in useEffect:', error);
      setLoading(false);
    }
  }, []);

  const loadData = async (isRefresh = false, dm = dataManager, chm = connectionHealthMonitor) => {
    try {
      if (!dm) return; // Wait for dataManager to be loaded
      
      if (!isRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const [branchesData, pickersData, assignmentsData, versionData] = await Promise.all([
        dm.getBranchesCached(),
        dm.getPickersCached(),
        dm.getBayAssignmentsCached(),
        dm.getVersionCached(),
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
        setTimeout(() => loadData(true, dm, chm), 5000);
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
    return <SimpleLoadingScreen />;
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
          <p className="mt-4 text-blue-300 font-medium">Build: {version}</p>
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

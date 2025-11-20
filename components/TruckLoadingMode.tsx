'use client';

import { useState, useEffect } from 'react';
import { verifyPinLocal, verifyPin, getTrucks, createTruck, getStagingArea, loadToTruck, getTruckLoads, clearStagingArea, updateTruckStatus, getDepartedTruckLoadsByDate, getPartialPallets, type Truck, type StagingItem, type TruckLoad, type PartialPallet } from '@/lib/api';
import { dataManager } from '@/lib/dataManager';
import { generateTruckExcel } from '@/lib/truckExcelGenerator';
import { generateMasterSheetExcel } from '@/lib/masterSheetGenerator';
import toast from 'react-hot-toast';

interface TruckLoadingModeProps {
  onBack: () => void;
}

// Loading screen component (same as in page.tsx)
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
    "Pro tip: Staging by branch keeps loading smoother than a brand-new pallet jack wheel.",
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
    "Joke: Why did the pallet jack apply for a job? It wanted to *lift* its career."
  ];

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="text-center max-w-2xl px-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mb-6 mx-auto"></div>
        <p className="text-white text-xl mb-6">Loading Trucks and Staging Area...</p>

        {/* Progress bar */}
        <div className="w-64 mx-auto mb-6">
          <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
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
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-6">
          <div className="text-cyan-200 text-sm font-semibold mb-2">
            💡 Loading Tip
          </div>
          <div className="text-white text-lg leading-relaxed">
            {loadingTips[currentTip]}
          </div>
        </div>

        <div className="text-slate-300 text-sm">
          Fetching truck data and staging items...
        </div>
      </div>
    </div>
  );
}

interface LoadQuantities extends StagingItem { }

export default function TruckLoadingMode({ onBack }: TruckLoadingModeProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showNewTruckModal, setShowNewTruckModal] = useState(false);
  const [newTruckName, setNewTruckName] = useState('');
  const [newTruckCarrier, setNewTruckCarrier] = useState('STEFI');
  const [view, setView] = useState<'main' | 'truck-details' | 'departed-trucks'>('main');
  const [currentTruckLoads, setCurrentTruckLoads] = useState<TruckLoad[]>([]);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [loadQuantities, setLoadQuantities] = useState<LoadQuantities[]>([]);
  const [departedTrucks, setDepartedTrucks] = useState<Truck[]>([]);
  const [showMasterSheetModal, setShowMasterSheetModal] = useState(false);
  const [masterSheetDate, setMasterSheetDate] = useState('');
  const [availableDepartedTrucks, setAvailableDepartedTrucks] = useState<Truck[]>([]);
  const [selectedTrucksForMaster, setSelectedTrucksForMaster] = useState<Set<number>>(new Set());
  const [partialPallets, setPartialPallets] = useState<PartialPallet[]>([]);

  // Check if admin is cached (shared with AdminMode)
  useEffect(() => {
    const cachedAuth = localStorage.getItem('vamac_admin_authenticated');
    if (cachedAuth === 'true') {
      setIsAuthenticated(true);
      // Set initial loading to show the loading screen
      setIsInitialLoading(true);
      loadData(true);
    } else {
      setIsInitialLoading(false);
    }
  }, []);

  // Load trucks and staging area
  const loadData = async (isInitial = false) => {
    if (isInitial) {
      setIsInitialLoading(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [trucksData, stagingData, partialPalletsData] = await Promise.all([
        getTrucks(),
        getStagingArea(),
        getPartialPallets()
      ]);
      // Filter to show only Active trucks in main view
      const activeTrucks = trucksData.filter(t => t.status === 'Active');
      setTrucks(activeTrucks);
      setStagingItems(stagingData);
      setPartialPallets(partialPalletsData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        toast.error('Connection timeout. Please refresh the page and try again.');
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        toast.error('Network connection error. Please check your internet connection.');
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        toast.error('Unable to connect to server. Please refresh the page.');
      } else {
        toast.error(`Failed to load data: ${errorMessage}`);
      }

      console.error('Data loading error:', error);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData(false);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Quick local check first
      if (!verifyPinLocal(pin)) {
        toast.error('Invalid PIN');
        setPin('');
        return;
      }

      // Then verify with server (consistent with AdminMode)
      const isValid = await verifyPin(pin);
      if (isValid) {
        setIsAuthenticated(true);
        localStorage.setItem('vamac_admin_authenticated', 'true');
        loadData();
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

  const handleCreateTruck = async () => {
    try {
      setIsLoading(true);
      const newTruck = await createTruck(newTruckName.trim() || undefined, newTruckCarrier.trim() || 'STEFI');
      toast.success(`Truck "${newTruck.truckName}" created!`);
      setTrucks([...trucks, newTruck]);
      setShowNewTruckModal(false);
      setNewTruckName('');
      setNewTruckCarrier('STEFI');
    } catch (error) {
      console.error('Error creating truck:', error);
      toast.error('Failed to create truck');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectItem = (key: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const handleInitiateLoad = () => {
    if (!selectedTruck || selectedItems.size === 0) {
      toast.error('Please select a truck and items');
      return;
    }

    // Get selected items and set default quantities (max available)
    const itemsToLoad = stagingItems.filter(item =>
      selectedItems.has(`${item.branchNumber}-${item.pickDate}`)
    ).map(item => ({ ...item })); // Clone items

    setLoadQuantities(itemsToLoad);
    setShowQuantityModal(true);
  };

  const handleConfirmLoad = async () => {
    if (!selectedTruck || loadQuantities.length === 0) {
      return;
    }

    // Filter out items with all zero quantities
    const itemsWithQuantities = loadQuantities.filter(item => {
      return item.pallets > 0 || item.boxes > 0 || item.rolls > 0 ||
        (item.fiberglass && item.fiberglass > 0) ||
        (item.waterHeaters && item.waterHeaters > 0) ||
        (item.waterRights && item.waterRights > 0) ||
        (item.boxTub && item.boxTub > 0) ||
        (item.copperPipe && item.copperPipe > 0) ||
        (item.plasticPipe && item.plasticPipe > 0) ||
        (item.galvPipe && item.galvPipe > 0) ||
        (item.blackPipe && item.blackPipe > 0) ||
        (item.wood && item.wood > 0) ||
        (item.galvStrut && item.galvStrut > 0) ||
        (item.im540Tank && item.im540Tank > 0) ||
        (item.im1250Tank && item.im1250Tank > 0) ||
        (item.mailBox && item.mailBox > 0) ||
        (item.custom && item.custom.trim());
    });

    if (itemsWithQuantities.length === 0) {
      toast.error('Please enter at least one quantity to load');
      return;
    }

    try {
      setIsLoading(true);
      await loadToTruck(selectedTruck.truckID, itemsWithQuantities);
      toast.success(`Loaded ${itemsWithQuantities.length} item(s) to ${selectedTruck.truckName}`);
      setSelectedItems(new Set());
      setSelectedTruck(null);
      setShowQuantityModal(false);
      setLoadQuantities([]);
      await loadData();
    } catch (error) {
      console.error('Error loading to truck:', error);
      toast.error('Failed to load items to truck');
    } finally {
      setIsLoading(false);
    }
  };

  const updateLoadQuantity = (index: number, field: keyof StagingItem, value: string) => {
    const updated = [...loadQuantities];
    if (value === '') {
      // Handle empty string - don't convert to number
      (updated[index] as any)[field] = 0;
    } else {
      const numValue = parseInt(value);
      (updated[index] as any)[field] = isNaN(numValue) ? 0 : Math.max(0, numValue);
    }
    setLoadQuantities(updated);
  };

  const handleViewTruckDetails = async (truck: Truck) => {
    try {
      setIsLoading(true);
      const loads = await getTruckLoads(truck.truckID);
      setCurrentTruckLoads(loads);
      setSelectedTruck(truck);
      setView('truck-details');
    } catch (error) {
      console.error('Error loading truck details:', error);
      toast.error('Failed to load truck details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportTruck = async () => {
    if (!selectedTruck || currentTruckLoads.length === 0) {
      toast.error('No items in truck to export');
      return;
    }

    try {
      await generateTruckExcel(
        selectedTruck.truckName,
        currentTruckLoads,
        'Taylor',
        'STEFI'
      );
      toast.success('Excel file generated successfully!');
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  const handleCloseTruck = async () => {
    if (!selectedTruck) return;

    if (!confirm(`Mark "${selectedTruck.truckName}" as Departed? This will move it to departed trucks.`)) {
      return;
    }

    try {
      setIsLoading(true);
      await updateTruckStatus(selectedTruck.truckID, 'Departed');
      toast.success(`${selectedTruck.truckName} marked as Departed!`);
      setView('main');
      setSelectedTruck(null);
      await loadData();
    } catch (error) {
      console.error('Error closing truck:', error);
      toast.error('Failed to update truck status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDepartedTrucks = async () => {
    try {
      setIsLoading(true);
      const allTrucks = await getTrucks();
      const departed = allTrucks.filter(t => t.status === 'Departed');
      setDepartedTrucks(departed);
      setView('departed-trucks');
    } catch (error) {
      console.error('Error loading departed trucks:', error);
      toast.error('Failed to load departed trucks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMasterSheetModal = async () => {
    try {
      setIsLoading(true);
      const allTrucks = await getTrucks();
      // Filter for departed trucks from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentDeparted = allTrucks.filter(truck => {
        if (truck.status !== 'Departed') return false;
        const createDate = new Date(truck.createDate);
        return createDate >= thirtyDaysAgo;
      });

      recentDeparted.sort((a, b) => {
        const dateA = new Date(a.createDate);
        const dateB = new Date(b.createDate);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      });

      setAvailableDepartedTrucks(recentDeparted);
      setSelectedTrucksForMaster(new Set());
      setShowMasterSheetModal(true);
    } catch (error) {
      console.error('Error loading departed trucks:', error);
      toast.error('Failed to load departed trucks');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTruckSelection = (truckID: number) => {
    const newSelection = new Set(selectedTrucksForMaster);
    if (newSelection.has(truckID)) {
      newSelection.delete(truckID);
    } else {
      newSelection.add(truckID);
    }
    setSelectedTrucksForMaster(newSelection);
  };

  const handleExportMasterSheet = async () => {
    if (selectedTrucksForMaster.size === 0) {
      toast.error('Please select at least one truck');
      return;
    }

    try {
      setIsLoading(true);

      // Get loads from all selected trucks
      const allLoads: TruckLoad[] = [];
      for (const truckID of Array.from(selectedTrucksForMaster)) {
        const loads = await getTruckLoads(truckID);
        allLoads.push(...loads);
      }

      if (allLoads.length === 0) {
        toast.error('No loads found in selected trucks');
        return;
      }

      // Use the most recent truck's create date as the departed date
      const selectedTruckObjs = availableDepartedTrucks.filter(t => selectedTrucksForMaster.has(t.truckID));
      const mostRecentDate = selectedTruckObjs.reduce((latest, truck) => {
        const createDate = new Date(truck.createDate);
        return createDate > latest ? createDate : latest;
      }, new Date(0));

      // Get carrier from the first selected truck (they should all have the same carrier)
      const defaultCarrier = selectedTruckObjs.length > 0 ? (selectedTruckObjs[0].carrier || 'STEFI') : 'STEFI';

      generateMasterSheetExcel(allLoads, mostRecentDate, defaultCarrier);
      toast.success('Master Sheet exported successfully!');
      setShowMasterSheetModal(false);
      setSelectedTrucksForMaster(new Set());
    } catch (error) {
      console.error('Error exporting master sheet:', error);
      toast.error('Failed to export master sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearStagingArea = async () => {
    if (!confirm('Are you sure you want to clear the entire staging area? This will delete all staged items.')) {
      return;
    }

    try {
      setIsLoading(true);
      await clearStagingArea();
      toast.success('Staging area cleared successfully!');
      await loadData();
    } catch (error) {
      console.error('Error clearing staging area:', error);
      toast.error('Failed to clear staging area');
    } finally {
      setIsLoading(false);
    }
  };

  // Format date nicely (prevent timezone shift)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Parse date string as local date to prevent timezone shift
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get item summary (non-zero items)
  const getItemSummary = (item: StagingItem | TruckLoad) => {
    const items = [];
    if (item.transferNumber) items.push(`${item.transferNumber}`);
    if (item.pallets > 0) items.push(`${item.pallets} Pallets`);
    if (item.boxes > 0) items.push(`${item.boxes} Boxes`);
    if (item.rolls > 0) items.push(`${item.rolls} Rolls`);
    if (item.fiberglass && item.fiberglass > 0) items.push(`${item.fiberglass} Fiber-glass`);
    if (item.waterHeaters && item.waterHeaters > 0) items.push(`${item.waterHeaters} Water Heaters`);
    if (item.waterRights && item.waterRights > 0) items.push(`${item.waterRights} Water Rights`);
    if (item.boxTub && item.boxTub > 0) items.push(`${item.boxTub} Box Tub`);
    if (item.copperPipe && item.copperPipe > 0) items.push(`${item.copperPipe} Copper Pipe`);
    if (item.plasticPipe && item.plasticPipe > 0) items.push(`${item.plasticPipe} Plastic Pipe`);
    if (item.galvPipe && item.galvPipe > 0) items.push(`${item.galvPipe} GALV Pipe`);
    if (item.blackPipe && item.blackPipe > 0) items.push(`${item.blackPipe} Black Pipe`);
    if (item.wood && item.wood > 0) items.push(`${item.wood} Wood`);
    if (item.galvStrut && item.galvStrut > 0) items.push(`${item.galvStrut} Galv STRUT`);
    if (item.im540Tank && item.im540Tank > 0) items.push(`${item.im540Tank} IM-540 TANK`);
    if (item.im1250Tank && item.im1250Tank > 0) items.push(`${item.im1250Tank} IM-1250 TANK`);
    if (item.mailBox && item.mailBox > 0) items.push(`${item.mailBox} Mail Box`);
    if (item.custom && item.custom.trim()) items.push(item.custom);
    return items.join(', ');
  };

  // Show loading screen when isInitialLoading is true and authenticated
  if (isAuthenticated && isInitialLoading) {
    return <SimpleLoadingScreen />;
  }

  // PIN Screen (consistent with Admin Mode)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_40px_140px_-50px_rgba(37,99,235,0.85)] px-8 py-10 text-white animate-fadeIn">
          <div className="text-center mb-8">
            <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-3">Admin Access</p>
            <h2 className="text-[clamp(1.75rem,2.5vw,2.75rem)] font-semibold leading-tight">Enter Security PIN</h2>
            <p className="text-sm text-blue-100/80 mt-3">PIN authentication is shared with Admin Mode for seamless access.</p>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-wide text-blue-100/70">6-digit PIN</label>
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
              <button type="submit" className="btn-primary w-full py-3 rounded-full text-base">
                Unlock Truck Loading
              </button>
              <button
                type="button"
                onClick={onBack}
                className="btn-secondary w-full py-3 rounded-full border border-white/25 bg-white/10 hover:bg-white/20"
              >
                Return to Menu
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Truck Details View
  if (view === 'truck-details' && selectedTruck) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 sm:px-6 lg:px-8 text-white">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.8)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-2">Active Truck</p>
                <h1 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-tight">🚛 {selectedTruck.truckName}</h1>
                <p className="text-sm md:text-base text-blue-100/80 mt-2">Created on {formatDate(selectedTruck.createDate)} • Carrier: {selectedTruck.carrier || 'STEFI'}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => { setView('main'); setSelectedTruck(null); }} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
                  ← Back to Main
                </button>
                <button onClick={handleExportTruck} className="rounded-full bg-blue-500/90 px-5 py-2.5 text-sm font-semibold tracking-wide shadow-[0_18px_40px_-18px_rgba(59,130,246,0.9)] hover:bg-blue-500 transition flex items-center justify-center gap-2">
                  <span>📊</span> Export Excel
                </button>
                {selectedTruck.status === 'Active' && (
                  <button
                    onClick={handleCloseTruck}
                    disabled={isLoading}
                    className="rounded-full border border-emerald-300/50 bg-emerald-500/20 px-5 py-2.5 text-sm font-semibold tracking-wide hover:bg-emerald-500/30 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <span>✓</span> Mark as Departed
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Truck Loads */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <h2 className="text-2xl font-semibold">Loaded Items ({currentTruckLoads.length})</h2>
              <p className="text-xs uppercase tracking-wide text-blue-100/70">
                {currentTruckLoads.length > 0 ? 'Current load manifest' : 'Awaiting staged items'}
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-200"></div>
              </div>
            ) : currentTruckLoads.length === 0 ? (
              <p className="text-blue-100/75 italic text-center py-8">No items loaded yet</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {currentTruckLoads.map((load, index) => {
                  // Check if this branch has an active partial pallet
                  const hasActivePartialPallet = partialPallets && partialPallets.length > 0 && partialPallets.some(p => 
                    p && p.branchNumber === load.branchNumber && p.status === 'OPEN'
                  );

                  return (
                    <div key={index} className="rounded-2xl border border-white/12 bg-white/10 px-5 py-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-semibold">Branch {load.branchNumber}</span>
                          <span className="text-blue-100/70">— {load.branchName}</span>
                          {/* Partial Pallet Indicator */}
                          {hasActivePartialPallet && (
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                              <span className="text-xs text-emerald-300 font-medium">Partial Pallet Open</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-white/20 bg-white/10 text-blue-100/80">
                          Picked {formatDate(load.pickDate)}
                        </span>
                      </div>
                      <p className="text-sm text-blue-100/85 leading-relaxed">{getItemSummary(load)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Departed Trucks View
  if (view === 'departed-trucks') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 sm:px-6 lg:px-8 text-white">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.8)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-2">Archive</p>
                <h1 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-tight">📋 Departed Trucks</h1>
                <p className="text-sm md:text-base text-blue-100/80 mt-2">Review trucks that have been marked as departed. You can still open their details.</p>
              </div>
              <button onClick={() => { setView('main'); setDepartedTrucks([]); }} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
                ← Back to Main
              </button>
            </div>
          </div>

          {/* Departed Trucks List */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <h2 className="text-2xl font-semibold">All Departed Trucks ({departedTrucks.length})</h2>
              <p className="text-xs uppercase tracking-wide text-blue-100/70">
                {departedTrucks.length > 0 ? 'Closed manifests available' : 'No departed trucks yet'}
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-200"></div>
              </div>
            ) : departedTrucks.length === 0 ? (
              <p className="text-blue-100/75 italic text-center py-8">No departed trucks yet</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {departedTrucks.map((truck) => (
                  <div
                    key={truck.truckID}
                    className="rounded-2xl border border-white/12 bg-white/10 px-5 py-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{truck.truckName} • Carrier: {truck.carrier || 'STEFI'}</h3>
                        <p className="text-xs uppercase tracking-wide text-blue-100/70 mt-1">Created {formatDate(truck.createDate)}</p>
                      </div>
                      <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-white/20 bg-white/10 text-blue-100/80">
                        {truck.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleViewTruckDetails(truck)}
                      className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/18 transition"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 sm:px-6 lg:px-8 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.8)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
            <div>
              <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-2">Operations</p>
              <h1 className="text-[clamp(2rem,3vw,3.25rem)] font-semibold leading-tight">🚛 Truck Loading</h1>
              <p className="text-sm md:text-base text-blue-100/80">Assign staged items to active trucks</p>
            </div>
            <button onClick={onBack} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition self-start md:self-center">
              ← Back to Menu
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setShowNewTruckModal(true)}
              className="rounded-2xl border border-white/20 bg-blue-500/80 px-5 py-4 text-sm font-semibold tracking-wide shadow-[0_18px_40px_-18px_rgba(59,130,246,0.9)] hover:bg-blue-500 transition flex items-center justify-center gap-2"
            >
              <span>➕</span> Create New Truck
            </button>
            <button
              onClick={handleRefresh}
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-medium tracking-wide hover:bg-white/18 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <span>↻</span>
              )}
              Refresh
            </button>
            <button
              onClick={handleClearStagingArea}
              className="rounded-2xl border border-red-300/60 bg-red-500/20 px-5 py-4 text-sm font-semibold tracking-wide hover:bg-red-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || stagingItems.length === 0}
            >
              <span>🗑️</span> Clear Staging
            </button>
            <button
              onClick={handleViewDepartedTrucks}
              className="rounded-2xl border border-purple-300/60 bg-purple-600/25 px-5 py-4 text-sm font-semibold tracking-wide hover:bg-purple-600/35 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <span>📋</span> Departed Trucks
            </button>
            <button
              onClick={handleOpenMasterSheetModal}
              className="rounded-2xl border border-emerald-300/60 bg-emerald-600/25 px-5 py-4 text-sm font-semibold tracking-wide hover:bg-emerald-600/35 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <span>📊</span> Export Master Sheet
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staging Area */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <h2 className="text-2xl font-semibold">📦 Staging Area ({stagingItems.length})</h2>
              <p className="text-xs uppercase tracking-wide text-blue-100/70">
                {selectedTruck ? `Loading into ${selectedTruck.truckName}` : 'Select a truck to start loading'}
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-200"></div>
              </div>
            ) : stagingItems.length === 0 ? (
              <p className="text-blue-100/75 italic text-center py-8">No items in staging area</p>
            ) : (
              <>
                <div className="mb-4">
                  {selectedTruck && (
                    <button
                      onClick={handleInitiateLoad}
                      disabled={selectedItems.size === 0 || isLoading}
                      className="w-full rounded-full bg-blue-500/80 px-5 py-3 text-sm font-semibold tracking-wide shadow-[0_18px_40px_-18px_rgba(59,130,246,0.9)] hover:bg-blue-500 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <span>↦</span>
                          Load {selectedItems.size} item(s) to {selectedTruck.truckName}
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {stagingItems.map((item) => {
                    const key = `${item.branchNumber}-${item.pickDate}`;
                    const isSelected = selectedItems.has(key);
                    
                    // Check if this branch has an active partial pallet
                    const hasActivePartialPallet = partialPallets && partialPallets.length > 0 && partialPallets.some(p => 
                      p && p.branchNumber === item.branchNumber && p.status === 'OPEN'
                    );

                    return (
                      <div
                        key={key}
                        onClick={() => handleSelectItem(key)}
                        className={`rounded-2xl border cursor-pointer px-5 py-5 transition-all ${isSelected
                            ? 'border-blue-400/70 bg-blue-500/25 shadow-[0_20px_60px_-45px_rgba(59,130,246,0.9)]'
                            : 'border-white/12 bg-white/10 hover:border-blue-300/60 hover:bg-blue-500/10'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-semibold text-white">Branch {item.branchNumber}</span>
                            <span className="text-blue-100/70">— {item.branchName}</span>
                            {/* Partial Pallet Indicator */}
                            {hasActivePartialPallet && (
                              <div className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                <span className="text-xs text-emerald-300 font-medium">Partial Pallet Open</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-white/20 bg-white/10 text-blue-100/80">
                            {formatDate(item.pickDate)}
                          </span>
                        </div>
                        <p className="text-sm text-blue-100/85 leading-relaxed">{getItemSummary(item)}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Trucks List */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <h2 className="text-2xl font-semibold">🚚 Trucks ({trucks.length})</h2>
              <p className="text-xs uppercase tracking-wide text-blue-100/70">Only active trucks are shown</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-200"></div>
              </div>
            ) : trucks.length === 0 ? (
              <p className="text-blue-100/75 italic text-center py-8">No trucks created yet</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {trucks.map((truck) => {
                  const isSelected = selectedTruck?.truckID === truck.truckID;

                  return (
                    <div
                      key={truck.truckID}
                      className={`rounded-2xl border px-5 py-5 transition-all ${isSelected
                          ? 'border-blue-400/70 bg-blue-500/25 shadow-[0_20px_60px_-45px_rgba(59,130,246,0.9)]'
                          : 'border-white/12 bg-white/10'
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{truck.truckName} • Carrier: {truck.carrier || 'STEFI'}</h3>
                          <p className="text-xs uppercase tracking-wide text-blue-100/70 mt-1">Created {formatDate(truck.createDate)}</p>
                        </div>
                        <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-emerald-300/60 bg-emerald-500/20 text-emerald-100">
                          {truck.status}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => setSelectedTruck(isSelected ? null : truck)}
                          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition ${isSelected
                              ? 'bg-blue-500 text-white shadow-[0_16px_30px_-18px_rgba(59,130,246,0.9)]'
                              : 'border border-white/20 bg-white/10 text-white hover:bg-white/18'
                            }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </button>
                        <button
                          onClick={() => handleViewTruckDetails(truck)}
                          className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide hover:bg-white/18 transition"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Truck Modal */}
      {showNewTruckModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/10 backdrop-blur-xl shadow-[0_40px_120px_-60px_rgba(37,99,235,0.85)] px-6 py-6 md:px-7 md:py-7 text-white animate-slideUp">
            <h2 className="text-[clamp(1.5rem,2.2vw,2rem)] font-semibold mb-3">Create New Truck</h2>

            <div className="mb-5 space-y-2">
              <label className="block text-xs uppercase tracking-wide text-blue-100/70">
                Truck Name <span className="text-blue-100/40">(optional)</span>
              </label>
              <input
                type="text"
                value={newTruckName}
                onChange={(e) => setNewTruckName(e.target.value)}
                placeholder="e.g., Morning Truck"
                className="input-field w-full bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
              />
              {newTruckName.trim() === '' && (
                <p className="text-xs uppercase tracking-wide text-blue-100/60">
                  Will auto-generate like "11/08 Truck #1"
                </p>
              )}
            </div>

            <div className="mb-5 space-y-2">
              <label className="block text-xs uppercase tracking-wide text-blue-100/70">
                Carrier <span className="text-blue-100/40">(default: STEFI)</span>
              </label>
              <input
                type="text"
                value={newTruckCarrier}
                onChange={(e) => setNewTruckCarrier(e.target.value)}
                placeholder="STEFI"
                className="input-field w-full bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCreateTruck}
                disabled={isLoading}
                className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-full py-3"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  'Create Truck'
                )}
              </button>
              <button
                onClick={() => { setShowNewTruckModal(false); setNewTruckName(''); setNewTruckCarrier('STEFI'); }}
                className="btn-secondary flex-1 rounded-full py-3 border border-white/20 bg-white/10 hover:bg-white/20"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Quantities Modal */}
      {showQuantityModal && selectedTruck && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-4xl rounded-3xl border border-white/12 bg-white/10 backdrop-blur-xl shadow-[0_40px_140px_-60px_rgba(37,99,235,0.85)] p-5 sm:p-7 my-6 text-white animate-slideUp">
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">
              Load to {selectedTruck.truckName}
            </h2>
            <p className="text-sm sm:text-base text-blue-100/80 mb-4">
              Adjust quantities for each staged entry. Inputs default to the maximum available.
            </p>

            <div className="space-y-4 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto mb-5 pr-1 sm:pr-2">
              {loadQuantities.map((item, index) => {
                const originalItem = stagingItems.find(
                  si => si.branchNumber === item.branchNumber && si.pickDate === item.pickDate
                );

                return (
                  <div key={`${item.branchNumber}-${item.pickDate}`} className="rounded-2xl border border-white/12 bg-white/10 px-4 sm:px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base sm:text-lg text-white">
                            Branch {item.branchNumber} - {item.branchName}
                          </h3>
                          {/* Partial Pallet Indicator */}
                          {partialPallets && partialPallets.length > 0 && partialPallets.some(p => p && p.branchNumber === item.branchNumber && p.status === 'OPEN') && (
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                              <span className="text-xs text-emerald-300 font-medium">Partial Pallet Open</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-blue-100/70">Picked: {formatDate(item.pickDate)}</p>
                      </div>
                    </div>

                    {/* Transfer Number Display */}
                    {item.transferNumber && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                          Transfer Number
                        </label>
                        <div className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white">
                          {item.transferNumber}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {/* Basic items */}
                      {originalItem && originalItem.pallets > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Pallets (max: {originalItem.pallets})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.pallets}
                            value={item.pallets === 0 ? '' : item.pallets}
                            onChange={(e) => updateLoadQuantity(index, 'pallets', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && originalItem.boxes > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Boxes (max: {originalItem.boxes})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.boxes}
                            value={item.boxes === 0 ? '' : item.boxes}
                            onChange={(e) => updateLoadQuantity(index, 'boxes', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && originalItem.rolls > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Rolls (max: {originalItem.rolls})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.rolls}
                            value={item.rolls === 0 ? '' : item.rolls}
                            onChange={(e) => updateLoadQuantity(index, 'rolls', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {/* Advanced items */}
                      {originalItem && (originalItem.fiberglass ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Fiber-glass (max: {originalItem.fiberglass})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.fiberglass}
                            value={(item.fiberglass && item.fiberglass > 0) ? item.fiberglass : ''}
                            onChange={(e) => updateLoadQuantity(index, 'fiberglass', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.waterHeaters ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Water Heaters (max: {originalItem.waterHeaters})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.waterHeaters}
                            value={(item.waterHeaters && item.waterHeaters > 0) ? item.waterHeaters : ''}
                            onChange={(e) => updateLoadQuantity(index, 'waterHeaters', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.waterRights ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Water Rights (max: {originalItem.waterRights})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.waterRights}
                            value={(item.waterRights && item.waterRights > 0) ? item.waterRights : ''}
                            onChange={(e) => updateLoadQuantity(index, 'waterRights', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.boxTub ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Box Tub (max: {originalItem.boxTub})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.boxTub}
                            value={(item.boxTub && item.boxTub > 0) ? item.boxTub : ''}
                            onChange={(e) => updateLoadQuantity(index, 'boxTub', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.copperPipe ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Copper Pipe (max: {originalItem.copperPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.copperPipe}
                            value={(item.copperPipe && item.copperPipe > 0) ? item.copperPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'copperPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.plasticPipe ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Plastic Pipe (max: {originalItem.plasticPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.plasticPipe}
                            value={(item.plasticPipe && item.plasticPipe > 0) ? item.plasticPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'plasticPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.galvPipe ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            GALV Pipe (max: {originalItem.galvPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.galvPipe}
                            value={(item.galvPipe && item.galvPipe > 0) ? item.galvPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'galvPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.blackPipe ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Black Pipe (max: {originalItem.blackPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.blackPipe}
                            value={(item.blackPipe && item.blackPipe > 0) ? item.blackPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'blackPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.wood ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Wood (max: {originalItem.wood})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.wood}
                            value={(item.wood && item.wood > 0) ? item.wood : ''}
                            onChange={(e) => updateLoadQuantity(index, 'wood', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.galvStrut ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Galv STRUT (max: {originalItem.galvStrut})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.galvStrut}
                            value={(item.galvStrut && item.galvStrut > 0) ? item.galvStrut : ''}
                            onChange={(e) => updateLoadQuantity(index, 'galvStrut', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.im540Tank ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            IM-540 TANK (max: {originalItem.im540Tank})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.im540Tank}
                            value={(item.im540Tank && item.im540Tank > 0) ? item.im540Tank : ''}
                            onChange={(e) => updateLoadQuantity(index, 'im540Tank', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.im1250Tank ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            IM-1250 TANK (max: {originalItem.im1250Tank})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.im1250Tank}
                            value={(item.im1250Tank && item.im1250Tank > 0) ? item.im1250Tank : ''}
                            onChange={(e) => updateLoadQuantity(index, 'im1250Tank', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}

                      {originalItem && (originalItem.mailBox ?? 0) > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                            Mail Box (max: {originalItem.mailBox})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.mailBox}
                            value={(item.mailBox && item.mailBox > 0) ? item.mailBox : ''}
                            onChange={(e) => updateLoadQuantity(index, 'mailBox', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm bg-white/10 border-white/25 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                          />
                        </div>
                      )}
                    </div>

                    {/* Custom items - display only */}
                    {originalItem && originalItem.custom && originalItem.custom.trim() && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">Custom Items (loaded as-is)</p>
                        <p className="text-sm text-blue-100/75">{originalItem.custom}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 border-t pt-4">
              <button
                onClick={handleConfirmLoad}
                disabled={isLoading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    Confirm Load
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setLoadQuantities([]);
                }}
                className="btn-secondary flex-1"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Master Sheet Export Modal */}
      {showMasterSheetModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-white/12 bg-white/10 backdrop-blur-xl shadow-[0_40px_140px_-60px_rgba(16,185,129,0.85)] p-7 text-white animate-slideUp my-8">
            <h2 className="text-2xl font-semibold mb-3">Export Master Sheet</h2>
            <p className="text-sm text-emerald-100/80 mb-5">
              Select one or more departed trucks to generate a consolidated master sheet grouped by pick dates.
            </p>

            <div className="mb-6 max-h-[50vh] overflow-y-auto pr-2">
              {availableDepartedTrucks.length === 0 ? (
                <div className="text-center py-8 text-emerald-100/60">
                  No recently departed trucks found (last 30 days)
                </div>
              ) : (
                <div className="space-y-2">
                  {availableDepartedTrucks.map(truck => (
                    <div
                      key={truck.truckID}
                      onClick={() => toggleTruckSelection(truck.truckID)}
                      className={`rounded-xl border px-4 py-3 cursor-pointer transition ${selectedTrucksForMaster.has(truck.truckID)
                          ? 'border-emerald-400/60 bg-emerald-500/20'
                          : 'border-white/12 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">{truck.truckName} • Carrier: {truck.carrier || 'STEFI'}</div>
                          <div className="text-xs text-emerald-100/70">
                            Departed: {formatDate(truck.createDate)}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${selectedTrucksForMaster.has(truck.truckID)
                            ? 'border-emerald-400 bg-emerald-400'
                            : 'border-white/30'
                          }`}>
                          {selectedTrucksForMaster.has(truck.truckID) && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4 text-sm text-emerald-100/70">
              <span>{selectedTrucksForMaster.size} truck(s) selected</span>
              {selectedTrucksForMaster.size > 0 && (
                <button
                  onClick={() => setSelectedTrucksForMaster(new Set())}
                  className="text-emerald-400 hover:text-emerald-300 transition"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExportMasterSheet}
                className="flex-1 rounded-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 font-semibold shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isLoading || selectedTrucksForMaster.size === 0}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <span>📊</span> Export Master Sheet
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowMasterSheetModal(false);
                  setSelectedTrucksForMaster(new Set());
                }}
                className="flex-1 rounded-full py-3 border border-white/20 bg-white/10 hover:bg-white/20 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


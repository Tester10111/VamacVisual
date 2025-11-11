'use client';

import { useState, useEffect } from 'react';
import { verifyPinLocal, verifyPin, getTrucks, createTruck, getStagingArea, loadToTruck, getTruckLoads, clearStagingArea, updateTruckStatus, getDepartedTruckLoadsByDate, type Truck, type StagingItem, type TruckLoad } from '@/lib/api';
import { generateTruckExcel } from '@/lib/truckExcelGenerator';
import { generateMasterSheetExcel } from '@/lib/masterSheetGenerator';
import toast from 'react-hot-toast';

interface TruckLoadingModeProps {
  onBack: () => void;
}

interface LoadQuantities extends StagingItem {
  transferNumber?: string;
}

export default function TruckLoadingMode({ onBack }: TruckLoadingModeProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showNewTruckModal, setShowNewTruckModal] = useState(false);
  const [newTruckName, setNewTruckName] = useState('');
  const [view, setView] = useState<'main' | 'truck-details' | 'departed-trucks'>('main');
  const [currentTruckLoads, setCurrentTruckLoads] = useState<TruckLoad[]>([]);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [loadQuantities, setLoadQuantities] = useState<LoadQuantities[]>([]);
  const [departedTrucks, setDepartedTrucks] = useState<Truck[]>([]);
  const [showMasterSheetModal, setShowMasterSheetModal] = useState(false);
  const [masterSheetDate, setMasterSheetDate] = useState('');

  // Check if admin is cached (shared with AdminMode)
  useEffect(() => {
    const cachedAuth = localStorage.getItem('vamac_admin_authenticated');
    if (cachedAuth === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  // Load trucks and staging area
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [trucksData, stagingData] = await Promise.all([
        getTrucks(),
        getStagingArea()
      ]);
      // Filter to show only Active trucks in main view
      const activeTrucks = trucksData.filter(t => t.status === 'Active');
      setTrucks(activeTrucks);
      setStagingItems(stagingData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
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
      const newTruck = await createTruck(newTruckName.trim() || undefined);
      toast.success(`Truck "${newTruck.truckName}" created!`);
      setTrucks([...trucks, newTruck]);
      setShowNewTruckModal(false);
      setNewTruckName('');
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

  const updateLoadQuantity = (index: number, field: keyof StagingItem | 'transferNumber', value: string) => {
    const updated = [...loadQuantities];
    // Handle transfer number as string
    if (field === 'transferNumber') {
      (updated[index] as any)[field] = value;
    } else if (value === '') {
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

  const handleExportMasterSheet = async () => {
    if (!masterSheetDate) {
      toast.error('Please select a date');
      return;
    }
    
    try {
      setIsLoading(true);
      const loads = await getDepartedTruckLoadsByDate(masterSheetDate);
      
      if (loads.length === 0) {
        toast.error('No departed truck loads found for this date');
        return;
      }
      
      generateMasterSheetExcel(loads, new Date(masterSheetDate));
      toast.success('Master Sheet exported successfully!');
      setShowMasterSheetModal(false);
      setMasterSheetDate('');
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
                <p className="text-sm md:text-base text-blue-100/80 mt-2">Created on {formatDate(selectedTruck.createDate)}</p>
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
                {currentTruckLoads.map((load, index) => (
                  <div key={index} className="rounded-2xl border border-white/12 bg-white/10 px-5 py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-lg font-semibold">Branch {load.branchNumber}</span>
                        <span className="text-blue-100/70 ml-2">— {load.branchName}</span>
                      </div>
                      <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-white/20 bg-white/10 text-blue-100/80">
                        Picked {formatDate(load.pickDate)}
                      </span>
                    </div>
                    <p className="text-sm text-blue-100/85 leading-relaxed">{getItemSummary(load)}</p>
                  </div>
                ))}
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
                        <h3 className="text-lg font-semibold text-white">{truck.truckName}</h3>
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
              onClick={loadData} 
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
              onClick={() => setShowMasterSheetModal(true)} 
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
                    
                    return (
                      <div 
                        key={key}
                        onClick={() => handleSelectItem(key)}
                        className={`rounded-2xl border cursor-pointer px-5 py-5 transition-all ${
                          isSelected 
                            ? 'border-blue-400/70 bg-blue-500/25 shadow-[0_20px_60px_-45px_rgba(59,130,246,0.9)]'
                            : 'border-white/12 bg-white/10 hover:border-blue-300/60 hover:bg-blue-500/10'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div>
                            <span className="text-lg font-semibold text-white">Branch {item.branchNumber}</span>
                            <span className="text-blue-100/70 ml-2">— {item.branchName}</span>
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
                      className={`rounded-2xl border px-5 py-5 transition-all ${
                        isSelected 
                          ? 'border-blue-400/70 bg-blue-500/25 shadow-[0_20px_60px_-45px_rgba(59,130,246,0.9)]'
                          : 'border-white/12 bg-white/10'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{truck.truckName}</h3>
                          <p className="text-xs uppercase tracking-wide text-blue-100/70 mt-1">Created {formatDate(truck.createDate)}</p>
                        </div>
                        <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-emerald-300/60 bg-emerald-500/20 text-emerald-100">
                          {truck.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button 
                          onClick={() => setSelectedTruck(isSelected ? null : truck)}
                          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition ${
                            isSelected 
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
                onClick={() => { setShowNewTruckModal(false); setNewTruckName(''); }}
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
                        <h3 className="font-semibold text-base sm:text-lg text-white">
                          Branch {item.branchNumber} - {item.branchName}
                        </h3>
                        <p className="text-xs sm:text-sm text-blue-100/70">Picked: {formatDate(item.pickDate)}</p>
                      </div>
                    </div>
                    
                    {/* Transfer Number Field */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-blue-100/70 mb-1 uppercase tracking-wide">
                        Transfer Number(s) (e.g., T1232322)
                      </label>
                      <input
                        type="text"
                        value={item.transferNumber || ''}
                        onChange={(e) => updateLoadQuantity(index, 'transferNumber', e.target.value)}
                        placeholder="Enter transfer number"
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 transition focus:border-blue-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                      />
                    </div>
                    
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-white/10 backdrop-blur-xl shadow-[0_40px_140px_-60px_rgba(16,185,129,0.85)] p-7 text-white animate-slideUp">
            <h2 className="text-2xl font-semibold mb-3">Export Master Sheet</h2>
            <p className="text-sm text-emerald-100/80 mb-5">
              Select a date to export a consolidated master sheet of all departed trucks.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-emerald-100/90 mb-2 uppercase tracking-wide">
                Select Date
              </label>
              <input
                type="date"
                value={masterSheetDate}
                onChange={(e) => setMasterSheetDate(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white transition focus:border-emerald-400/60 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExportMasterSheet}
                className="flex-1 rounded-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 font-semibold shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isLoading || !masterSheetDate}
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
                onClick={() => { setShowMasterSheetModal(false); setMasterSheetDate(''); }}
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


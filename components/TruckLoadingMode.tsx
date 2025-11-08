'use client';

import { useState, useEffect } from 'react';
import { verifyPinLocal, verifyPin, getTrucks, createTruck, getStagingArea, loadToTruck, getTruckLoads, clearStagingArea, updateTruckStatus, type Truck, type StagingItem, type TruckLoad } from '@/lib/api';
import { generateTruckExcel } from '@/lib/truckExcelGenerator';
import toast from 'react-hot-toast';

interface TruckLoadingModeProps {
  onBack: () => void;
}

interface LoadQuantities extends StagingItem {}

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

  const updateLoadQuantity = (index: number, field: keyof StagingItem, value: string) => {
    const updated = [...loadQuantities];
    // Handle empty string - don't convert to number
    if (value === '') {
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

  const handleExportTruck = () => {
    if (!selectedTruck || currentTruckLoads.length === 0) {
      toast.error('No items in truck to export');
      return;
    }

    try {
      generateTruckExcel({
        truckName: selectedTruck.truckName,
        loads: currentTruckLoads,
        shippedBy: 'Taylor',
        carrier: 'STEFI'
      });
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

  // Format date nicely
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center p-4">
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
              onClick={onBack}
              className="btn-secondary w-full mt-4"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Truck Details View
  if (view === 'truck-details' && selectedTruck) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">🚛 {selectedTruck.truckName}</h1>
                <p className="text-sm sm:text-base text-gray-600">Created on {formatDate(selectedTruck.createDate)}</p>
              </div>
              <button onClick={() => { setView('main'); setSelectedTruck(null); }} className="btn-secondary whitespace-nowrap">
                ← Back to Main
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleExportTruck} className="btn-primary flex items-center justify-center gap-2">
                <span>📊</span> Export Excel
              </button>
              {selectedTruck.status === 'Active' && (
                <button 
                  onClick={handleCloseTruck} 
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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

          {/* Truck Loads */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Loaded Items ({currentTruckLoads.length})
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : currentTruckLoads.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No items loaded yet</p>
            ) : (
              <div className="space-y-3">
                {currentTruckLoads.map((load, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-lg text-gray-800">Branch {load.branchNumber}</span>
                        <span className="text-gray-600 ml-2">- {load.branchName}</span>
                      </div>
                      <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                        Picked: {formatDate(load.pickDate)}
                      </span>
                    </div>
                    <p className="text-gray-700">{getItemSummary(load)}</p>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">📋 Departed Trucks</h1>
              <button onClick={() => { setView('main'); setDepartedTrucks([]); }} className="btn-secondary whitespace-nowrap">
                ← Back to Main
              </button>
            </div>
          </div>

          {/* Departed Trucks List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              All Departed Trucks ({departedTrucks.length})
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : departedTrucks.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No departed trucks yet</p>
            ) : (
              <div className="space-y-3">
                {departedTrucks.map((truck) => (
                  <div 
                    key={truck.truckID}
                    className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{truck.truckName}</h3>
                        <p className="text-sm text-gray-600">Created: {formatDate(truck.createDate)}</p>
                      </div>
                      <span className="text-sm px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-800">
                        {truck.status}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => handleViewTruckDetails(truck)}
                      className="w-full bg-blue-100 text-blue-700 hover:bg-blue-200 py-2 px-3 rounded-lg font-medium transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">🚛 Truck Loading</h1>
            <button onClick={onBack} className="btn-secondary whitespace-nowrap">
              ← Back to Menu
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button 
              onClick={() => setShowNewTruckModal(true)} 
              className="btn-primary flex items-center justify-center gap-2"
            >
              <span>➕</span> Create New Truck
            </button>
            <button 
              onClick={loadData} 
              className="btn-secondary flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              ) : (
                <span>🔄</span>
              )}
              Refresh
            </button>
            <button 
              onClick={handleClearStagingArea} 
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              disabled={isLoading || stagingItems.length === 0}
            >
              <span>🗑️</span> Clear Staging
            </button>
            <button 
              onClick={handleViewDepartedTrucks} 
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <span>📋</span> Departed Trucks
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staging Area */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              📦 Staging Area ({stagingItems.length})
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : stagingItems.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No items in staging area</p>
            ) : (
              <>
                <div className="mb-4">
                  {selectedTruck && (
                    <button 
                      onClick={handleInitiateLoad}
                      disabled={selectedItems.size === 0 || isLoading}
                      className="btn-primary w-full mb-3 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <span>➡️</span>
                          Load {selectedItems.size} item(s) to {selectedTruck.truckName}
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {stagingItems.map((item) => {
                    const key = `${item.branchNumber}-${item.pickDate}`;
                    const isSelected = selectedItems.has(key);
                    
                    return (
                      <div 
                        key={key}
                        onClick={() => handleSelectItem(key)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-gray-50 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-bold text-lg text-gray-800">Branch {item.branchNumber}</span>
                            <span className="text-gray-600 ml-2">- {item.branchName}</span>
                          </div>
                          <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                            {formatDate(item.pickDate)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{getItemSummary(item)}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Trucks List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              🚚 Trucks ({trucks.length})
            </h2>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : trucks.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No trucks created yet</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {trucks.map((truck) => {
                  const isSelected = selectedTruck?.truckID === truck.truckID;
                  
                  return (
                    <div 
                      key={truck.truckID}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{truck.truckName}</h3>
                          <p className="text-sm text-gray-600">Created: {formatDate(truck.createDate)}</p>
                        </div>
                        <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                          truck.status === 'Active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {truck.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button 
                          onClick={() => setSelectedTruck(isSelected ? null : truck)}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                            isSelected 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </button>
                        <button 
                          onClick={() => handleViewTruckDetails(truck)}
                          className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 py-2 px-3 rounded-lg font-medium transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-slideUp">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Create New Truck</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Truck Name (leave blank for auto-generated name)
              </label>
              <input
                type="text"
                value={newTruckName}
                onChange={(e) => setNewTruckName(e.target.value)}
                placeholder="e.g., Morning Truck"
                className="input-field w-full"
              />
              {newTruckName.trim() === '' && (
                <p className="text-sm text-gray-500 mt-1">
                  Will auto-generate like "11/08 Truck #1"
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleCreateTruck}
                disabled={isLoading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
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
                className="btn-secondary flex-1"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-4xl my-4 sm:my-8 animate-slideUp">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">
              Load to {selectedTruck.truckName}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
              Adjust quantities to load (defaults to maximum available)
            </p>
            
            <div className="space-y-4 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto mb-4 sm:mb-6 pr-1 sm:pr-2">
              {loadQuantities.map((item, index) => {
                const originalItem = stagingItems.find(
                  si => si.branchNumber === item.branchNumber && si.pickDate === item.pickDate
                );
                
                return (
                  <div key={`${item.branchNumber}-${item.pickDate}`} className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-base sm:text-lg text-gray-800">
                          Branch {item.branchNumber} - {item.branchName}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">Picked: {formatDate(item.pickDate)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {/* Basic items */}
                      {originalItem && originalItem.pallets > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Pallets (max: {originalItem.pallets})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.pallets}
                            value={item.pallets === 0 ? '' : item.pallets}
                            onChange={(e) => updateLoadQuantity(index, 'pallets', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.boxes > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Boxes (max: {originalItem.boxes})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.boxes}
                            value={item.boxes === 0 ? '' : item.boxes}
                            onChange={(e) => updateLoadQuantity(index, 'boxes', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.rolls > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Rolls (max: {originalItem.rolls})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.rolls}
                            value={item.rolls === 0 ? '' : item.rolls}
                            onChange={(e) => updateLoadQuantity(index, 'rolls', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}

                      {/* Advanced items */}
                      {originalItem && originalItem.fiberglass && originalItem.fiberglass > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Fiber-glass (max: {originalItem.fiberglass})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.fiberglass}
                            value={(item.fiberglass && item.fiberglass > 0) ? item.fiberglass : ''}
                            onChange={(e) => updateLoadQuantity(index, 'fiberglass', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.waterHeaters && originalItem.waterHeaters > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Water Heaters (max: {originalItem.waterHeaters})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.waterHeaters}
                            value={(item.waterHeaters && item.waterHeaters > 0) ? item.waterHeaters : ''}
                            onChange={(e) => updateLoadQuantity(index, 'waterHeaters', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.waterRights && originalItem.waterRights > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Water Rights (max: {originalItem.waterRights})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.waterRights}
                            value={(item.waterRights && item.waterRights > 0) ? item.waterRights : ''}
                            onChange={(e) => updateLoadQuantity(index, 'waterRights', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.boxTub && originalItem.boxTub > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Box Tub (max: {originalItem.boxTub})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.boxTub}
                            value={(item.boxTub && item.boxTub > 0) ? item.boxTub : ''}
                            onChange={(e) => updateLoadQuantity(index, 'boxTub', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.copperPipe && originalItem.copperPipe > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Copper Pipe (max: {originalItem.copperPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.copperPipe}
                            value={(item.copperPipe && item.copperPipe > 0) ? item.copperPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'copperPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.plasticPipe && originalItem.plasticPipe > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Plastic Pipe (max: {originalItem.plasticPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.plasticPipe}
                            value={(item.plasticPipe && item.plasticPipe > 0) ? item.plasticPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'plasticPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.galvPipe && originalItem.galvPipe > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            GALV Pipe (max: {originalItem.galvPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.galvPipe}
                            value={(item.galvPipe && item.galvPipe > 0) ? item.galvPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'galvPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.blackPipe && originalItem.blackPipe > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Black Pipe (max: {originalItem.blackPipe})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.blackPipe}
                            value={(item.blackPipe && item.blackPipe > 0) ? item.blackPipe : ''}
                            onChange={(e) => updateLoadQuantity(index, 'blackPipe', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.wood && originalItem.wood > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Wood (max: {originalItem.wood})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.wood}
                            value={(item.wood && item.wood > 0) ? item.wood : ''}
                            onChange={(e) => updateLoadQuantity(index, 'wood', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.galvStrut && originalItem.galvStrut > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Galv STRUT (max: {originalItem.galvStrut})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.galvStrut}
                            value={(item.galvStrut && item.galvStrut > 0) ? item.galvStrut : ''}
                            onChange={(e) => updateLoadQuantity(index, 'galvStrut', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.im540Tank && originalItem.im540Tank > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            IM-540 TANK (max: {originalItem.im540Tank})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.im540Tank}
                            value={(item.im540Tank && item.im540Tank > 0) ? item.im540Tank : ''}
                            onChange={(e) => updateLoadQuantity(index, 'im540Tank', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.im1250Tank && originalItem.im1250Tank > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            IM-1250 TANK (max: {originalItem.im1250Tank})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.im1250Tank}
                            value={(item.im1250Tank && item.im1250Tank > 0) ? item.im1250Tank : ''}
                            onChange={(e) => updateLoadQuantity(index, 'im1250Tank', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                      
                      {originalItem && originalItem.mailBox && originalItem.mailBox > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Mail Box (max: {originalItem.mailBox})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={originalItem.mailBox}
                            value={(item.mailBox && item.mailBox > 0) ? item.mailBox : ''}
                            onChange={(e) => updateLoadQuantity(index, 'mailBox', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field w-full text-sm"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Custom items - display only */}
                    {originalItem && originalItem.custom && originalItem.custom.trim() && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-1">Custom Items (loaded as-is):</p>
                        <p className="text-sm text-gray-600">{originalItem.custom}</p>
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
    </div>
  );
}


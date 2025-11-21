'use client';

import { useState, useEffect, useRef } from 'react';
import { getTrucks, createTruck, loadToTruck, getTruckLoads, updateTruckStatus, getDepartedTruckLoadsByDate, getBranches, getExistingTransferNumber, type Truck, type TruckLoad, type Branch, type LoadItem } from '@/lib/api';
import { generateTruckExcel } from '@/lib/truckExcelGenerator';
import { generateMasterSheetExcel } from '@/lib/masterSheetGenerator';
import toast from 'react-hot-toast';

interface TruckLoadingModeProps {
  onBack?: () => void; // Optional now since it's the main mode
}

// Loading screen component with tips
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
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-2xl px-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-headline mb-6 mx-auto"></div>
        <p className="text-headline text-xl mb-6">Loading Vamac Visual...</p>

        {/* Progress bar */}
        <div className="w-64 mx-auto mb-6">
          <div className="w-full bg-illustration-main/20 rounded-full h-2 mb-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <div className="text-paragraph text-sm">
            {Math.round(loadingProgress)}%
          </div>
        </div>

        {/* Loading tip */}
        <div className="bg-illustration-main/10 rounded-2xl p-6 mb-6">
          <div className="text-button text-sm font-semibold mb-2">
            💡 Loading Tip
          </div>
          <div className="text-headline text-lg leading-relaxed">
            {loadingTips[currentTip]}
          </div>
        </div>

        {/* Build Version */}
        <div className="text-paragraph/60 text-xs">
          Build: 0.9.5
        </div>
      </div>
    </div>
  );
}

export default function TruckLoadingMode({ onBack }: TruckLoadingModeProps) {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showNewTruckModal, setShowNewTruckModal] = useState(false);
  const [newTruckName, setNewTruckName] = useState('');
  const [newTruckCarrier, setNewTruckCarrier] = useState('STEFI');
  const [view, setView] = useState<'main' | 'truck-details' | 'departed-trucks'>('main');
  const [currentTruckLoads, setCurrentTruckLoads] = useState<TruckLoad[]>([]);
  const [departedTrucks, setDepartedTrucks] = useState<Truck[]>([]);
  const [showMasterSheetModal, setShowMasterSheetModal] = useState(false);
  const [availableDepartedTrucks, setAvailableDepartedTrucks] = useState<Truck[]>([]);
  const [selectedTrucksForMaster, setSelectedTrucksForMaster] = useState<Set<number>>(new Set());

  // Add Item Form State
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [branchInput, setBranchInput] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [transferNumber, setTransferNumber] = useState('');
  const [existingTransferNumber, setExistingTransferNumber] = useState<string | null>(null);
  const [showTransferPrompt, setShowTransferPrompt] = useState(false);
  const [pallets, setPallets] = useState('');
  const [boxes, setBoxes] = useState('');
  const [rolls, setRolls] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced fields
  const [fiberglass, setFiberglass] = useState('');
  const [waterHeaters, setWaterHeaters] = useState('');
  const [waterRights, setWaterRights] = useState('');
  const [boxTub, setBoxTub] = useState('');
  const [copperPipe, setCopperPipe] = useState('');
  const [plasticPipe, setPlasticPipe] = useState('');
  const [galvPipe, setGalvPipe] = useState('');
  const [blackPipe, setBlackPipe] = useState('');
  const [wood, setWood] = useState('');
  const [galvStrut, setGalvStrut] = useState('');
  const [im540Tank, setIm540Tank] = useState('');
  const [im1250Tank, setIm1250Tank] = useState('');
  const [mailBox, setMailBox] = useState('');
  const [customItems, setCustomItems] = useState<Array<{ name: string; quantity: string }>>([{ name: '', quantity: '' }]);

  // Refs
  const branchInputRef = useRef<HTMLInputElement>(null);
  const transferInputRef = useRef<HTMLInputElement>(null);
  const palletsInputRef = useRef<HTMLInputElement>(null);

  // Load initial data
  useEffect(() => {
    // Initialize monitoring services
    const initServices = async () => {
      try {
        const [connectionModule, performanceModule] = await Promise.all([
          import('@/lib/connectionHealthMonitor'),
          import('@/lib/performanceMonitor')
        ]);

        const { connectionHealthMonitor: chm } = connectionModule;
        const { performanceMonitor: pm } = performanceModule;

        // Make globally accessible for debugging
        (window as any).__appStartTime = Date.now();
        (window as any).performanceMonitor = pm;
        (window as any).connectionHealthMonitor = chm;

        // Start connection health monitoring
        console.log('🔍 Starting connection health monitoring...');
        chm.start();
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initServices();
    loadData(true);
  }, []);

  const loadData = async (isInitial = false) => {
    if (isInitial) {
      setIsInitialLoading(true);
    }

    try {
      const [trucksData, branchesData] = await Promise.all([
        getTrucks(),
        getBranches()
      ]);
      // Filter to show only Active trucks in main view
      const activeTrucks = trucksData.filter(t => t.status === 'Active');
      setTrucks(activeTrucks);
      setBranches(branchesData);
    } catch (error) {
      console.error('Data loading error:', error);
      toast.error('Failed to load data');
    } finally {
      setIsInitialLoading(false);
      setLoadingAction(null);
    }
  };

  const handleRefresh = () => {
    setLoadingAction('refresh');
    loadData(false);
    if (selectedTruck) {
      // If viewing a truck, refresh its details too
      getTruckLoads(selectedTruck.truckID).then(loads => {
        setCurrentTruckLoads(loads);
      }).catch(console.error);
    }
  };

  const handleCreateTruck = async () => {
    try {
      setLoadingAction('create-truck');
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
      setLoadingAction(null);
    }
  };

  const handleViewTruckDetails = async (truck: Truck) => {
    try {
      setLoadingAction(`view-details-${truck.truckID}`);
      const loads = await getTruckLoads(truck.truckID);
      setCurrentTruckLoads(loads);
      setSelectedTruck(truck);
      setView('truck-details');
      // Reset form
      resetAddItemForm();
    } catch (error) {
      console.error('Error loading truck details:', error);
      toast.error('Failed to load truck details');
    } finally {
      setLoadingAction(null);
    }
  };

  // --- Add Item Logic ---

  const resetAddItemForm = () => {
    setBranchInput('');
    setSelectedBranch(null);
    setTransferNumber('');
    setExistingTransferNumber(null);
    setShowTransferPrompt(false);
    setPallets('');
    setBoxes('');
    setRolls('');
    setFiberglass('');
    setWaterHeaters('');
    setWaterRights('');
    setBoxTub('');
    setCopperPipe('');
    setPlasticPipe('');
    setGalvPipe('');
    setBlackPipe('');
    setWood('');
    setGalvStrut('');
    setIm540Tank('');
    setIm1250Tank('');
    setMailBox('');
    setCustomItems([{ name: '', quantity: '' }]);
    setShowAddItemForm(false);
  };

  const handleBranchInput = (value: string) => {
    setBranchInput(value);

    // Auto-find branch as user types
    if (value.trim() === '') {
      setSelectedBranch(null);
      setExistingTransferNumber(null);
      setShowTransferPrompt(false);
      setTransferNumber('');
      return;
    }

    // Try to find branch by number or name
    const branch = branches.find(
      b => b.branchNumber.toString() === value.trim() ||
        b.branchName.toLowerCase().includes(value.toLowerCase().trim())
    );

    setSelectedBranch(branch || null);

    if (branch) {
      checkExistingTransferNumber(branch.branchNumber);
    }
  };

  const checkExistingTransferNumber = async (branchNumber: number) => {
    try {
      // Get current date in Eastern Time (or use truck creation date? User said "first staging of this branch for the day")
      // We should probably use the current date as we are loading "now".
      const now = new Date();
      const easternDate = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
      const dateParts = easternDate.split('/');
      const apiDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

      const existing = await getExistingTransferNumber(branchNumber, apiDate);

      if (existing) {
        setExistingTransferNumber(existing);
        setTransferNumber(existing);
        setShowTransferPrompt(false);
      } else {
        setExistingTransferNumber(null);
        setShowTransferPrompt(true);
        // Focus transfer input if branch is selected and no existing transfer number
        setTimeout(() => transferInputRef.current?.focus(), 100);
      }
    } catch (error) {
      console.error('Error checking existing transfer number:', error);
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck || !selectedBranch) {
      toast.error('Please select a branch');
      return;
    }

    if (showTransferPrompt && !transferNumber.trim()) {
      toast.error('Transfer number is required');
      return;
    }

    const palletsNum = parseInt(pallets) || 0;
    const boxesNum = parseInt(boxes) || 0;
    const rollsNum = parseInt(rolls) || 0;

    // Format custom items
    const customItemsStr = customItems
      .filter(item => item.name.trim() && item.quantity.trim())
      .map(item => `${item.name.trim()}:${item.quantity.trim()}`)
      .join(',');

    const hasQuantity = palletsNum > 0 || boxesNum > 0 || rollsNum > 0 ||
      parseInt(fiberglass) > 0 || parseInt(waterHeaters) > 0 || parseInt(waterRights) > 0 ||
      parseInt(boxTub) > 0 || parseInt(copperPipe) > 0 || parseInt(plasticPipe) > 0 ||
      parseInt(galvPipe) > 0 || parseInt(blackPipe) > 0 || parseInt(wood) > 0 ||
      parseInt(galvStrut) > 0 || parseInt(im540Tank) > 0 || parseInt(im1250Tank) > 0 ||
      parseInt(mailBox) > 0 || customItemsStr.length > 0;

    if (!hasQuantity) {
      toast.error('Please enter at least one quantity');
      return;
    }

    try {
      setLoadingAction('add-item');

      // Get current date for pickDate
      const now = new Date();
      const easternDate = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
      const dateParts = easternDate.split('/');
      const pickDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

      const newItem: LoadItem = {
        branchNumber: selectedBranch.branchNumber,
        branchName: selectedBranch.branchName,
        pickDate: pickDate,
        pallets: palletsNum,
        boxes: boxesNum,
        rolls: rollsNum,
        fiberglass: parseInt(fiberglass) || 0,
        waterHeaters: parseInt(waterHeaters) || 0,
        waterRights: parseInt(waterRights) || 0,
        boxTub: parseInt(boxTub) || 0,
        copperPipe: parseInt(copperPipe) || 0,
        plasticPipe: parseInt(plasticPipe) || 0,
        galvPipe: parseInt(galvPipe) || 0,
        blackPipe: parseInt(blackPipe) || 0,
        wood: parseInt(wood) || 0,
        galvStrut: parseInt(galvStrut) || 0,
        im540Tank: parseInt(im540Tank) || 0,
        im1250Tank: parseInt(im1250Tank) || 0,
        mailBox: parseInt(mailBox) || 0,
        custom: customItemsStr,
        transferNumber: transferNumber.trim()
      };

      await loadToTruck(selectedTruck.truckID, [newItem]);

      toast.success('Item added to truck!');
      resetAddItemForm();
      // Refresh loads
      const loads = await getTruckLoads(selectedTruck.truckID);
      setCurrentTruckLoads(loads);
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    } finally {
      setLoadingAction(null);
    }
  };

  // --- End Add Item Logic ---

  const handleExportTruck = async () => {
    if (!selectedTruck || currentTruckLoads.length === 0) {
      toast.error('No items in truck to export');
      return;
    }

    try {
      setLoadingAction('export-truck');
      await generateTruckExcel(
        selectedTruck.truckName,
        currentTruckLoads,
        'Vamac', // Default user
        selectedTruck.carrier || 'STEFI'
      );
      toast.success('Excel file generated successfully!');
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast.error('Failed to generate Excel file');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseTruck = async () => {
    if (!selectedTruck) return;

    if (!confirm(`Mark "${selectedTruck.truckName}" as Departed? This will move it to departed trucks.`)) {
      return;
    }

    try {
      setLoadingAction('mark-departed');
      await updateTruckStatus(selectedTruck.truckID, 'Departed');
      toast.success(`${selectedTruck.truckName} marked as Departed!`);
      setView('main');
      setSelectedTruck(null);
      await loadData();
    } catch (error) {
      console.error('Error closing truck:', error);
      toast.error('Failed to update truck status');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleViewDepartedTrucks = async () => {
    try {
      setLoadingAction('view-departed');
      const allTrucks = await getTrucks();
      const departed = allTrucks.filter(t => t.status === 'Departed');
      setDepartedTrucks(departed);
      setView('departed-trucks');
    } catch (error) {
      console.error('Error loading departed trucks:', error);
      toast.error('Failed to load departed trucks');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenMasterSheetModal = async () => {
    try {
      setLoadingAction('open-master-modal');
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
      setLoadingAction(null);
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
      setLoadingAction('export-master');

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

      // Get carrier from the first selected truck
      const defaultCarrier = selectedTruckObjs.length > 0 ? (selectedTruckObjs[0].carrier || 'STEFI') : 'STEFI';

      generateMasterSheetExcel(allLoads, mostRecentDate, defaultCarrier);
      toast.success('Master Sheet exported successfully!');
      setShowMasterSheetModal(false);
      setSelectedTrucksForMaster(new Set());
    } catch (error) {
      console.error('Error exporting master sheet:', error);
      toast.error('Failed to export master sheet');
    } finally {
      setLoadingAction(null);
    }
  };

  // Format date nicely
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get item summary
  const getItemSummary = (item: TruckLoad) => {
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

  if (isInitialLoading) {
    return <SimpleLoadingScreen />;
  }

  // Truck Details View
  if (view === 'truck-details' && selectedTruck) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 text-headline">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.8)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="uppercase tracking-[0.35em] text-xs text-paragraph/80 mb-2">Active Truck</p>
                <h1 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-tight">🚛 {selectedTruck.truckName}</h1>
                <p className="text-sm md:text-base text-paragraph/80 mt-2">Created on {formatDate(selectedTruck.createDate)} • Carrier: {selectedTruck.carrier || 'STEFI'}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => { setView('main'); setSelectedTruck(null); }} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
                  ← Back to Trucks
                </button>
                <button onClick={handleExportTruck} disabled={loadingAction === 'export-truck'} className="rounded-full bg-blue-500/90 px-5 py-2.5 text-sm font-semibold tracking-wide shadow-[0_18px_40px_-18px_rgba(59,130,246,0.9)] hover:bg-blue-500 transition flex items-center justify-center gap-2 disabled:opacity-70">
                  <span>📊</span> {loadingAction === 'export-truck' ? 'Exporting...' : 'Export Excel'}
                </button>
                {selectedTruck.status === 'Active' && (
                  <button
                    onClick={handleCloseTruck}
                    disabled={loadingAction === 'mark-departed'}
                    className="rounded-full border border-emerald-300/50 bg-emerald-500/20 px-5 py-2.5 text-sm font-semibold tracking-wide hover:bg-emerald-500/30 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingAction === 'mark-departed' ? 'Processing...' : '✓ Mark as Departed'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Add Item Section */}
          {selectedTruck.status === 'Active' && (
            <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Add Items</h2>
                <button
                  onClick={() => setShowAddItemForm(!showAddItemForm)}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition"
                >
                  {showAddItemForm ? 'Cancel' : '+ Add New Item'}
                </button>
              </div>

              {showAddItemForm && (
                <form onSubmit={handleAddItemSubmit} className="space-y-6 animate-slideDown">
                  {/* Branch Selection */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-paragraph/80 font-semibold mb-2">Branch</label>
                      <input
                        ref={branchInputRef}
                        type="text"
                        value={branchInput}
                        onChange={(e) => handleBranchInput(e.target.value)}
                        className="input-field w-full bg-illustration-secondary border-paragraph/20 text-headline focus:border-primary"
                        placeholder="Enter branch number or name"
                        autoFocus
                      />
                      {selectedBranch && (
                        <div className="mt-2 text-sm text-primary">
                          Selected: {selectedBranch.branchNumber} - {selectedBranch.branchName}
                        </div>
                      )}
                    </div>

                    {/* Transfer Number */}
                    <div>
                      <label className="block text-paragraph/80 font-semibold mb-2">Transfer Number</label>
                      <input
                        ref={transferInputRef}
                        type="text"
                        value={transferNumber}
                        onChange={(e) => setTransferNumber(e.target.value)}
                        className="input-field w-full bg-illustration-secondary border-paragraph/20 text-headline focus:border-primary"
                        placeholder={showTransferPrompt ? "Required (First time today)" : "Auto-filled if exists"}
                        disabled={!showTransferPrompt && !!existingTransferNumber}
                      />
                      {existingTransferNumber && (
                        <div className="mt-2 text-sm text-emerald-300">
                          ✓ Found existing transfer number
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantities */}
                  <div>
                    <label className="block text-paragraph/80 font-semibold mb-3">Quantities</label>
                    <div className="grid gap-4 grid-cols-3">
                      <div>
                        <label className="text-xs uppercase text-paragraph/70 mb-1 block">Pallets</label>
                        <input
                          ref={palletsInputRef}
                          type="number"
                          value={pallets}
                          onChange={(e) => setPallets(e.target.value)}
                          className="input-field w-full text-center bg-illustration-secondary border-paragraph/20 text-headline"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-paragraph/70 mb-1 block">Boxes</label>
                        <input
                          type="number"
                          value={boxes}
                          onChange={(e) => setBoxes(e.target.value)}
                          className="input-field w-full text-center bg-illustration-secondary border-paragraph/20 text-headline"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase text-paragraph/70 mb-1 block">Rolls</label>
                        <input
                          type="number"
                          value={rolls}
                          onChange={(e) => setRolls(e.target.value)}
                          className="input-field w-full text-center bg-illustration-secondary border-paragraph/20 text-headline"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Advanced Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-sm text-primary hover:text-primary/80 underline"
                    >
                      {showAdvanced ? 'Hide Advanced Fields' : 'Show Advanced Fields'}
                    </button>
                  </div>

                  {/* Advanced Fields */}
                  {showAdvanced && (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-fadeIn">
                      <input type="number" placeholder="Fiberglass" value={fiberglass} onChange={e => setFiberglass(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Water Heaters" value={waterHeaters} onChange={e => setWaterHeaters(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Water Rights" value={waterRights} onChange={e => setWaterRights(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Box Tub" value={boxTub} onChange={e => setBoxTub(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Copper Pipe" value={copperPipe} onChange={e => setCopperPipe(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Plastic Pipe" value={plasticPipe} onChange={e => setPlasticPipe(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="GALV Pipe" value={galvPipe} onChange={e => setGalvPipe(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Black Pipe" value={blackPipe} onChange={e => setBlackPipe(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Wood" value={wood} onChange={e => setWood(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Galv STRUT" value={galvStrut} onChange={e => setGalvStrut(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="IM-540 TANK" value={im540Tank} onChange={e => setIm540Tank(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="IM-1250 TANK" value={im1250Tank} onChange={e => setIm1250Tank(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                      <input type="number" placeholder="Mail Box" value={mailBox} onChange={e => setMailBox(e.target.value)} className="input-field bg-illustration-secondary border-paragraph/20 text-headline text-sm" />
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loadingAction === 'add-item'}
                    className="w-full py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-lg shadow-lg transition-all disabled:opacity-70"
                  >
                    {loadingAction === 'add-item' ? 'Adding...' : 'Add to Truck'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Truck Loads List */}
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <h2 className="text-2xl font-semibold">Loaded Items ({currentTruckLoads.length})</h2>
            </div>

            {currentTruckLoads.length === 0 ? (
              <p className="text-paragraph/75 italic text-center py-8">No items loaded yet</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {currentTruckLoads.map((load, index) => (
                  <div key={index} className="rounded-2xl border border-white/12 bg-white/10 px-5 py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-semibold">Branch {load.branchNumber}</span>
                        <span className="text-paragraph/70">— {load.branchName}</span>
                      </div>
                      <span className="text-xs uppercase tracking-wide px-3 py-1 rounded-full border border-paragraph/20 bg-illustration-secondary text-paragraph/80">
                        {load.transferNumber}
                      </span>
                    </div>
                    <p className="text-sm text-paragraph/85 leading-relaxed">{getItemSummary(load)}</p>
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
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 text-headline">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.8)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="uppercase tracking-[0.35em] text-xs text-paragraph/70 mb-2">Archive</p>
                <h1 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-tight">📋 Departed Trucks</h1>
              </div>
              <button onClick={() => { setView('main'); setDepartedTrucks([]); }} className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition">
                ← Back to Main
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur px-6 py-6 md:px-8 md:py-7 shadow-2xl">
            {departedTrucks.length === 0 ? (
              <p className="text-paragraph/75 italic text-center py-8">No departed trucks yet</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {departedTrucks.map((truck) => (
                  <div key={truck.truckID} className="rounded-2xl border border-white/12 bg-white/10 px-5 py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-headline">{truck.truckName} • Carrier: {truck.carrier || 'STEFI'}</h3>
                        <p className="text-xs uppercase tracking-wide text-paragraph/70 mt-1">Created {formatDate(truck.createDate)}</p>
                      </div>
                      <button
                        onClick={() => handleViewTruckDetails(truck)}
                        disabled={loadingAction === `view-details-${truck.truckID}`}
                        className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/18 transition disabled:opacity-70"
                      >
                        {loadingAction === `view-details-${truck.truckID}` ? 'Loading...' : 'View Details'}
                      </button>
                    </div>
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
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 text-headline">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-lg px-6 py-6 md:px-8 md:py-8 shadow-[0_40px_120px_-60px_rgba(37,99,235,0.8)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
            <div>
              <p className="uppercase tracking-[0.35em] text-xs text-paragraph mb-2">Trucks and Reports</p>
              <h1 className="text-[clamp(2rem,3vw,3.25rem)] font-semibold leading-tight text-headline">🚛 Truck Loading</h1>
              <p className="text-sm md:text-base text-paragraph">Create trucks, load items, and export reports</p>
              <p className="text-xs text-paragraph/60 mt-2">Build: 0.9.5</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={loadingAction === 'refresh'}
                className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-white/20 transition disabled:opacity-70"
              >
                {loadingAction === 'refresh' ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => setShowNewTruckModal(true)}
              className="rounded-2xl border border-paragraph/20 bg-button/90 px-5 py-4 text-sm font-semibold tracking-wide shadow-lg hover:bg-button text-button-text transition flex items-center justify-center gap-2"
            >
              <span>➕</span> Create New Truck
            </button>
            <button
              onClick={handleViewDepartedTrucks}
              disabled={loadingAction === 'view-departed'}
              className="rounded-2xl border border-purple-300/60 bg-purple-600/25 px-5 py-4 text-sm font-semibold tracking-wide hover:bg-purple-600/35 transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <span>📋</span> {loadingAction === 'view-departed' ? 'Loading...' : 'Departed Trucks'}
            </button>
            <button
              onClick={handleOpenMasterSheetModal}
              disabled={loadingAction === 'open-master-modal'}
              className="rounded-2xl border border-emerald-300/60 bg-emerald-600/25 px-5 py-4 text-sm font-semibold tracking-wide hover:bg-emerald-600/35 transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <span>📊</span> {loadingAction === 'open-master-modal' ? 'Loading...' : 'Export Master Sheet'}
            </button>
          </div>
        </div>

        {/* Active Trucks List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.map((truck) => (
            <div
              key={truck.truckID}
              onClick={() => !loadingAction && handleViewTruckDetails(truck)}
              className={`group cursor-pointer rounded-3xl border border-paragraph/10 bg-illustration-main/5 p-6 transition-all hover:bg-illustration-main/10 hover:border-paragraph/20 hover:shadow-2xl hover:-translate-y-1 ${loadingAction === `view-details-${truck.truckID}` ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-2xl border border-blue-400/30">
                  🚛
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-button transition-colors">{truck.truckName}</h3>
              <p className="text-sm text-paragraph mb-4">Carrier: {truck.carrier || 'STEFI'}</p>
              <div className="flex items-center text-xs text-paragraph/40">
                <span>Created {formatDate(truck.createDate)}</span>
              </div>
            </div>
          ))}

          {trucks.length === 0 && !isInitialLoading && loadingAction !== 'refresh' && (
            <div className="col-span-full text-center py-12 text-paragraph/50 italic">
              No active trucks. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* New Truck Modal */}
      {showNewTruckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-paragraph/10 bg-background p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4">Create New Truck</h2>
            <input
              type="text"
              value={newTruckName}
              onChange={(e) => setNewTruckName(e.target.value)}
              placeholder="Truck Name (Optional)"
              className="input-field w-full mb-4 bg-illustration-secondary border-paragraph/20 text-headline"
            />
            <input
              type="text"
              value={newTruckCarrier}
              onChange={(e) => setNewTruckCarrier(e.target.value)}
              placeholder="Carrier (Default: STEFI)"
              className="input-field w-full mb-6 bg-illustration-secondary border-paragraph/20 text-headline"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewTruckModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTruck}
                disabled={loadingAction === 'create-truck'}
                className="flex-1 py-3 rounded-xl bg-button hover:bg-button/90 text-button-text transition font-semibold disabled:opacity-70"
              >
                {loadingAction === 'create-truck' ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Sheet Modal */}
      {showMasterSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-paragraph/10 bg-background p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-2">Export Master Sheet</h2>
            <p className="text-primary/70 mb-6">Select departed trucks to include in the Master Sheet.</p>

            <div className="space-y-3 mb-8">
              {availableDepartedTrucks.length === 0 ? (
                <p className="text-center text-paragraph/50 py-4">No departed trucks found in the last 30 days.</p>
              ) : (
                availableDepartedTrucks.map(truck => (
                  <div
                    key={truck.truckID}
                    onClick={() => toggleTruckSelection(truck.truckID)}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selectedTrucksForMaster.has(truck.truckID)
                      ? 'bg-button/20 border-button/50'
                      : 'bg-illustration-secondary/10 border-paragraph/10 hover:bg-illustration-secondary/20'
                      }`}
                  >
                    <div>
                      <div className="font-semibold">{truck.truckName}</div>
                      <div className="text-sm text-paragraph/60">{formatDate(truck.createDate)} • {truck.carrier}</div>
                    </div>
                    <div className={`h-6 w-6 rounded-full border flex items-center justify-center ${selectedTrucksForMaster.has(truck.truckID)
                      ? 'bg-blue-500 border-blue-400 text-white'
                      : 'border-white/30'
                      }`}>
                      {selectedTrucksForMaster.has(truck.truckID) && '✓'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowMasterSheetModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExportMasterSheet}
                disabled={selectedTrucksForMaster.size === 0 || loadingAction === 'export-master'}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition font-semibold disabled:opacity-50"
              >
                {loadingAction === 'export-master' ? 'Exporting...' : 'Generate Excel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { Branch, Picker, addStageRecord } from '@/lib/api';
import { dataManager } from '@/lib/dataManager';
import toast from 'react-hot-toast';

interface StageModeProps {
  branches: Branch[];
  pickers: Picker[];
  onExit: () => void;
  onSave: () => void;
}

export default function StageMode({ branches, pickers, onExit, onSave }: StageModeProps) {
  const [pickerID, setPickerID] = useState('');
  const [pickerName, setPickerName] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [pallets, setPallets] = useState('');
  const [boxes, setBoxes] = useState('');
  const [rolls, setRolls] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Refs for focus management
  const branchInputRef = useRef<HTMLInputElement>(null);
  const palletsInputRef = useRef<HTMLInputElement>(null);
  const boxesInputRef = useRef<HTMLInputElement>(null);
  const rollsInputRef = useRef<HTMLInputElement>(null);

  const handlePickerIDSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Don't validate if field is empty (user might be exiting)
    if (!pickerID || pickerID.trim() === '') {
      return;
    }
    
    const picker = pickers.find(p => p.pickerID.toString() === pickerID);
    if (picker) {
      setPickerName(picker.pickerName);
      // Focus branch input after picker is found
      setTimeout(() => branchInputRef.current?.focus(), 100);
    } else {
      toast.error('Picker ID not found. Please contact an administrator.');
      setPickerName('');
      setPickerID(''); // Clear the invalid ID to prevent loop
    }
  };

  const handleBranchInput = (value: string) => {
    setBranchInput(value);
    
    // Auto-find branch as user types
    if (value.trim() === '') {
      setSelectedBranch(null);
      return;
    }

    // Try to find branch by number or name
    const branch = branches.find(
      b => b.branchNumber.toString() === value.trim() || 
           b.branchName.toLowerCase().includes(value.toLowerCase().trim())
    );
    
    setSelectedBranch(branch || null);
  };

  const handleBranchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedBranch) {
        // Branch is selected, move to pallets
        palletsInputRef.current?.focus();
      } else if (branchInput.trim() !== '') {
        // Try to find exact match
        const branch = branches.find(
          b => b.branchNumber.toString() === branchInput.trim() || 
               b.branchName.toLowerCase() === branchInput.toLowerCase().trim()
        );
        if (branch) {
          setSelectedBranch(branch);
          setBranchInput(`${branch.branchNumber} - ${branch.branchName}`);
          setTimeout(() => palletsInputRef.current?.focus(), 100);
        } else {
          alert('Branch not found. Please enter a valid branch number or name.');
        }
      }
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent double submission

    if (!pickerName) {
      toast.error('Please enter a valid Picker ID');
      return;
    }

    if (!selectedBranch) {
      toast.error('Please select a valid branch');
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

    // Check if at least one quantity is entered
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
      setIsSubmitting(true);
      
      await addStageRecord({
        pickerID: parseInt(pickerID),
        pickerName,
        branchNumber: selectedBranch.branchNumber,
        branchName: selectedBranch.branchName,
        pallets: palletsNum,
        boxes: boxesNum,
        rolls: rollsNum,
        // Advanced fields
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
      });

      // Show success message
      toast.success('Stage record added successfully!');
      
      // Reset form
      setPickerID('');
      setPickerName('');
      setBranchInput('');
      setSelectedBranch(null);
      setPallets('');
      setBoxes('');
      setRolls('');
      // Reset advanced fields
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
      
      // Focus back on picker ID for next entry
      setTimeout(() => {
        const pickerInput = document.querySelector('input[type="number"][placeholder="Enter your ID"]') as HTMLInputElement;
        pickerInput?.focus();
      }, 100);
      
      onSave();
    } catch (error) {
      toast.error('Error adding stage record. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-10 flex items-stretch justify-center">
      <div className="w-full max-w-5xl flex flex-col gap-8">
        {/* Header */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl px-6 py-6 text-white flex flex-col gap-4 md:flex-row md:justify-between md:items-center animate-fadeIn">
          <div>
            <p className="uppercase tracking-[0.35em] text-xs text-blue-200/70 mb-2">Stage Mode</p>
            <h1 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-tight">Record Staged Items</h1>
            <p className="text-sm md:text-base text-blue-100/80">
              Log your picking here.
            </p>
          </div>
          <button
            onClick={onExit}
            type="button"
            className="self-start md:self-center px-6 py-3 rounded-full bg-white/10 border border-white/30 text-sm md:text-base font-medium tracking-wide hover:bg-white/15 hover:border-white/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/60"
          >
            Exit
          </button>
        </div>

        {/* Main Form */}
        <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 shadow-2xl px-6 py-8 md:px-10 md:py-10 text-white animate-slideUp">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step indicator */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/8 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/50 text-lg font-semibold">1</div>
                  <div>
                    <p className="text-sm uppercase tracking-wider text-blue-200/70 mb-1">Step One</p>
                    <p className="text-base font-semibold">Enter Picker ID & Branch</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/8 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/50 text-lg font-semibold">2</div>
                  <div>
                    <p className="text-sm uppercase tracking-wider text-blue-200/70 mb-1">Step Two</p>
                    <p className="text-base font-semibold">Enter Quantities & Submit</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Picker ID Section */}
            <div className="rounded-3xl border border-white/15 bg-white/8 px-6 py-6 md:px-8 md:py-7 shadow-inner">
              <label className="block text-blue-100/80 font-semibold text-lg mb-4">Picker Identification</label>
              <input
                type="number"
                value={pickerID}
                onChange={(e) => setPickerID(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePickerIDSubmit();
                  }
                }}
                onBlur={handlePickerIDSubmit}
                className="input-field w-full text-lg md:text-xl bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                placeholder="Enter your ID to begin"
                autoFocus
                required
              />
              {pickerName && (
                <div className="mt-4 rounded-2xl border border-emerald-400/60 bg-emerald-500/15 px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-wide text-emerald-200/80">Picker Found</div>
                    <div className="text-lg md:text-xl font-semibold text-emerald-100">Great work picking, {pickerName}!</div>
                  </div>
                  <div className="hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-500/20 text-emerald-100 text-xl">
                    ✓
                  </div>
                </div>
              )}
            </div>

            {/* Branch Section */}
            <div className="rounded-3xl border border-white/15 bg-white/8 px-6 py-6 md:px-8 md:py-7 shadow-inner">
              <label className="block text-blue-100/80 font-semibold text-lg mb-4">Assign Branch</label>
              <input
                ref={branchInputRef}
                type="text"
                value={branchInput}
                onChange={(e) => handleBranchInput(e.target.value)}
                onKeyDown={handleBranchKeyDown}
                className="input-field w-full text-lg md:text-xl bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                placeholder="Enter branch number or name"
                required
                disabled={!pickerName}
              />
              {selectedBranch && (
                <div className="mt-4 rounded-2xl border border-blue-400/60 bg-blue-500/20 px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-wide text-blue-100/70">Selected Branch</div>
                    <div className="text-lg md:text-xl font-semibold text-white">
                      {selectedBranch.branchNumber} — {selectedBranch.branchName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBranchInput('');
                      setSelectedBranch(null);
                      branchInputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 text-xs uppercase tracking-wide rounded-full bg-white/10 border border-white/20 text-blue-50 hover:bg-white/20 transition"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Quantities Section */}
            <div className="rounded-3xl border border-white/15 bg-white/6 px-6 py-6 md:px-8 md:py-7 shadow-inner">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <label className="text-blue-100/80 font-semibold text-lg">Basic Quantities</label>
                <p className="text-sm text-blue-100/60">
                  Use Enter to move between fields once a branch is selected.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <label className="block text-sm uppercase tracking-wide text-blue-100/70 mb-3">Pallets</label>
                  <input
                    ref={palletsInputRef}
                    type="number"
                    value={pallets}
                    onChange={(e) => setPallets(e.target.value)}
                    onKeyDown={(e) => handleQuantityKeyDown(e, boxesInputRef)}
                    className="input-field w-full text-xl text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                    placeholder="00"
                    min="0"
                    disabled={!selectedBranch}
                  />
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <label className="block text-sm uppercase tracking-wide text-blue-100/70 mb-3">Boxes</label>
                  <input
                    ref={boxesInputRef}
                    type="number"
                    value={boxes}
                    onChange={(e) => setBoxes(e.target.value)}
                    onKeyDown={(e) => handleQuantityKeyDown(e, rollsInputRef)}
                    className="input-field w-full text-xl text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                    placeholder="00"
                    min="0"
                    disabled={!selectedBranch}
                  />
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-5">
                  <label className="block text-sm uppercase tracking-wide text-blue-100/70 mb-3">Rolls</label>
                  <input
                    ref={rollsInputRef}
                    type="number"
                    value={rolls}
                    onChange={(e) => setRolls(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmit(e as any);
                      }
                    }}
                    className="input-field w-full text-xl text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                    placeholder="00"
                    min="0"
                    disabled={!selectedBranch}
                  />
                </div>
              </div>
            </div>

            {/* Advanced Items Toggle */}
            <div className="rounded-3xl border border-white/12 bg-white/6 px-6 py-6 md:px-8 md:py-7 shadow-inner">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-left transition hover:bg-white/15"
                disabled={!selectedBranch}
              >
                <div>
                  <div className="text-sm uppercase tracking-wide text-blue-100/70">Advanced Items</div>
                  <div className="text-base font-medium text-white">Track additional staged materials</div>
                </div>
                <span className="text-xl text-blue-100">{showAdvanced ? '▾' : '▸'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-6 rounded-3xl border border-white/15 bg-slate-900/50 px-6 py-6 md:px-8 md:py-7 animate-slideDown">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Fiber-glass</label>
                      <input
                        type="number"
                        value={fiberglass}
                        onChange={(e) => setFiberglass(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Water Heaters</label>
                      <input
                        type="number"
                        value={waterHeaters}
                        onChange={(e) => setWaterHeaters(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Water Rights</label>
                      <input
                        type="number"
                        value={waterRights}
                        onChange={(e) => setWaterRights(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Box Tub</label>
                      <input
                        type="number"
                        value={boxTub}
                        onChange={(e) => setBoxTub(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Copper Pipe</label>
                      <input
                        type="number"
                        value={copperPipe}
                        onChange={(e) => setCopperPipe(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Plastic Pipe</label>
                      <input
                        type="number"
                        value={plasticPipe}
                        onChange={(e) => setPlasticPipe(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">GALV Pipe</label>
                      <input
                        type="number"
                        value={galvPipe}
                        onChange={(e) => setGalvPipe(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Black Pipe</label>
                      <input
                        type="number"
                        value={blackPipe}
                        onChange={(e) => setBlackPipe(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Wood</label>
                      <input
                        type="number"
                        value={wood}
                        onChange={(e) => setWood(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Galv STRUT</label>
                      <input
                        type="number"
                        value={galvStrut}
                        onChange={(e) => setGalvStrut(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">IM-540 TANK</label>
                      <input
                        type="number"
                        value={im540Tank}
                        onChange={(e) => setIm540Tank(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">IM-1250 TANK</label>
                      <input
                        type="number"
                        value={im1250Tank}
                        onChange={(e) => setIm1250Tank(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
                      <label className="block text-xs uppercase tracking-wide text-blue-100/60 mb-2">Mail Box</label>
                      <input
                        type="number"
                        value={mailBox}
                        onChange={(e) => setMailBox(e.target.value)}
                        className="input-field w-full text-center bg-white/10 border-white/20 text-white placeholder:text-blue-100/40 focus:border-blue-300/70 focus:bg-white/15"
                        placeholder="00"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Items Section */}
            {showAdvanced && (
              <div className="rounded-3xl border border-purple-400/40 bg-purple-500/10 px-6 py-6 md:px-8 md:py-7 text-purple-50 animate-slideDown">
                <h5 className="font-semibold text-sm mb-4 uppercase tracking-wide text-purple-100/80">Custom Items</h5>
                <div className="space-y-2">
                  {customItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...customItems];
                          newItems[index] = { ...newItems[index], name: e.target.value };
                          setCustomItems(newItems);
                        }}
                        placeholder="Item name"
                        className="input-field flex-1 text-sm bg-white/10 border-white/20 text-white placeholder:text-purple-100/40 focus:border-purple-200/70 focus:bg-white/15"
                        disabled={!selectedBranch}
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...customItems];
                          newItems[index] = { ...newItems[index], quantity: e.target.value };
                          setCustomItems(newItems);
                        }}
                        placeholder="Qty"
                        className="input-field w-20 text-sm text-center bg-white/10 border-white/20 text-white placeholder:text-purple-100/40 focus:border-purple-200/70 focus:bg-white/15"
                        min="0"
                        disabled={!selectedBranch}
                      />
                      {customItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = customItems.filter((_, i) => i !== index);
                            setCustomItems(newItems.length > 0 ? newItems : [{ name: '', quantity: '' }]);
                          }}
                          className="px-3 py-2 rounded border border-white/20 bg-white/10 hover:bg-white/20 text-sm font-semibold transition"
                          disabled={!selectedBranch}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomItems([...customItems, { name: '', quantity: '' }])}
                    className="w-full py-2 rounded-full border border-purple-200/40 bg-white/10 text-purple-50 text-sm font-semibold tracking-wide hover:bg-white/20 transition"
                    disabled={!selectedBranch}
                  >
                    + Add Custom Item
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary w-full text-lg md:text-xl py-4 rounded-full relative shadow-lg shadow-blue-900/40"
              disabled={!pickerName || !selectedBranch || isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding Record...
                </span>
              ) : (
                'Submit Stage Record'
              )}
            </button>
          </form>
        </div>

        {/* Available Branches Reference */}
        <div className="rounded-3xl border border-white/10 bg-white/8 backdrop-blur-sm shadow-2xl px-6 py-6 md:px-8 md:py-7">
          <h3 className="text-lg md:text-xl font-semibold text-white mb-4">Quick Branch Reference</h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {branches.map((branch) => (
              <div
                key={branch.branchNumber}
                className="rounded-2xl border border-white/10 bg-white/12 px-4 py-4 text-center cursor-pointer transition hover:bg-white/20 hover:border-white/25 text-white"
                onClick={() => {
                  setBranchInput(`${branch.branchNumber} - ${branch.branchName}`);
                  setSelectedBranch(branch);
                  setTimeout(() => palletsInputRef.current?.focus(), 100);
                }}
              >
                <div className="text-2xl font-semibold">{branch.branchNumber}</div>
                <div className="text-xs uppercase tracking-wide text-blue-100/70 mt-1">{branch.branchName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

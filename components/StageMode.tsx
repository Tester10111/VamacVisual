'use client';

import { useState, useRef } from 'react';
import { Branch, Picker, addStageRecord } from '@/lib/api';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Stage Mode</h1>
          <button onClick={onExit} className="bg-white text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all">
            Exit
          </button>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit}>
            {/* Picker ID Section */}
            <div className="mb-8">
              <label className="block text-gray-700 mb-2 font-semibold text-lg">Picker ID</label>
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
                className="input-field w-full text-xl"
                placeholder="Enter your ID"
                autoFocus
                required
              />
              {pickerName && (
                <div className="mt-3 p-4 bg-green-100 border-2 border-green-500 rounded-lg">
                  <div className="text-green-800 font-semibold text-lg">Great work picking, {pickerName}!</div>
                </div>
              )}
            </div>

            {/* Branch Section */}
            <div className="mb-8">
              <label className="block text-gray-700 mb-2 font-semibold text-lg">Branch</label>
              <input
                ref={branchInputRef}
                type="text"
                value={branchInput}
                onChange={(e) => handleBranchInput(e.target.value)}
                onKeyDown={handleBranchKeyDown}
                className="input-field w-full text-xl"
                placeholder="Enter branch number or name (press Enter)"
                required
                disabled={!pickerName}
              />
              {selectedBranch && (
                <div className="mt-3 p-4 bg-blue-100 border-2 border-blue-500 rounded-lg">
                  <div className="text-blue-800 font-semibold text-lg">
                    Branch {selectedBranch.branchNumber} - {selectedBranch.branchName}
                  </div>
                </div>
              )}
            </div>

            {/* Quantities Section */}
            <div className="mb-6">
              <label className="block text-gray-700 mb-4 font-semibold text-lg">Basic Quantities</label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 mb-2">Pallets</label>
                  <input
                    ref={palletsInputRef}
                    type="number"
                    value={pallets}
                    onChange={(e) => setPallets(e.target.value)}
                    onKeyDown={(e) => handleQuantityKeyDown(e, boxesInputRef)}
                    className="input-field w-full text-xl text-center"
                    placeholder="0"
                    min="0"
                    disabled={!selectedBranch}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-2">Boxes</label>
                  <input
                    ref={boxesInputRef}
                    type="number"
                    value={boxes}
                    onChange={(e) => setBoxes(e.target.value)}
                    onKeyDown={(e) => handleQuantityKeyDown(e, rollsInputRef)}
                    className="input-field w-full text-xl text-center"
                    placeholder="0"
                    min="0"
                    disabled={!selectedBranch}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-2">Rolls</label>
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
                    className="input-field w-full text-xl text-center"
                    placeholder="0"
                    min="0"
                    disabled={!selectedBranch}
                  />
                </div>
              </div>
            </div>

            {/* Advanced Items Toggle */}
            <div className="mb-8">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="btn-secondary w-full flex items-center justify-center gap-2"
                disabled={!selectedBranch}
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                <span>Advanced Items</span>
                {showAdvanced && <span className="text-sm">(Click to hide)</span>}
              </button>

              {showAdvanced && (
                <div className="mt-4 p-6 bg-gray-50 rounded-xl border-2 border-gray-200 animate-slideDown">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Fiber-glass</label>
                      <input
                        type="number"
                        value={fiberglass}
                        onChange={(e) => setFiberglass(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Water Heaters</label>
                      <input
                        type="number"
                        value={waterHeaters}
                        onChange={(e) => setWaterHeaters(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Water Rights</label>
                      <input
                        type="number"
                        value={waterRights}
                        onChange={(e) => setWaterRights(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Box Tub</label>
                      <input
                        type="number"
                        value={boxTub}
                        onChange={(e) => setBoxTub(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Copper Pipe</label>
                      <input
                        type="number"
                        value={copperPipe}
                        onChange={(e) => setCopperPipe(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Plastic Pipe</label>
                      <input
                        type="number"
                        value={plasticPipe}
                        onChange={(e) => setPlasticPipe(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">GALV Pipe</label>
                      <input
                        type="number"
                        value={galvPipe}
                        onChange={(e) => setGalvPipe(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Black Pipe</label>
                      <input
                        type="number"
                        value={blackPipe}
                        onChange={(e) => setBlackPipe(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Wood</label>
                      <input
                        type="number"
                        value={wood}
                        onChange={(e) => setWood(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Galv STRUT</label>
                      <input
                        type="number"
                        value={galvStrut}
                        onChange={(e) => setGalvStrut(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">IM-540 TANK</label>
                      <input
                        type="number"
                        value={im540Tank}
                        onChange={(e) => setIm540Tank(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">IM-1250 TANK</label>
                      <input
                        type="number"
                        value={im1250Tank}
                        onChange={(e) => setIm1250Tank(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 text-sm">Mail Box</label>
                      <input
                        type="number"
                        value={mailBox}
                        onChange={(e) => setMailBox(e.target.value)}
                        className="input-field w-full text-center"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Items Section */}
            {showAdvanced && (
              <div className="mb-6 p-4 bg-purple-50 rounded-xl border-2 border-purple-200 animate-slideDown">
                <h5 className="font-semibold text-sm mb-3 text-purple-900">Custom Items</h5>
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
                        className="input-field flex-1 text-sm"
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
                        className="input-field w-20 text-sm text-center"
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
                          className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                          disabled={!selectedBranch}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomItems([...customItems, { name: '', quantity: '' }])}
                    className="w-full py-2 bg-purple-200 text-purple-800 rounded hover:bg-purple-300 text-sm font-semibold"
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
              className="btn-primary w-full text-xl py-4 relative"
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
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Available Branches</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {branches.map((branch) => (
              <div
                key={branch.branchNumber}
                className="bg-gray-100 rounded-lg p-3 text-center cursor-pointer hover:bg-blue-100 transition-all"
                onClick={() => {
                  setBranchInput(`${branch.branchNumber} - ${branch.branchName}`);
                  setSelectedBranch(branch);
                  setTimeout(() => palletsInputRef.current?.focus(), 100);
                }}
              >
                <div className="font-bold text-lg">{branch.branchNumber}</div>
                <div className="text-sm text-gray-600">{branch.branchName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

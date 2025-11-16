// API functions to interact with Google Apps Script via internal proxy

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

// Validate API URL on initialization
if (typeof window !== 'undefined' && !APPS_SCRIPT_URL) {
  console.error('❌ NEXT_PUBLIC_APPS_SCRIPT_URL is not set! Please configure it in your environment variables.');
  console.error('See VERCEL_SETUP.md for instructions.');
}

if (typeof window !== 'undefined' && APPS_SCRIPT_URL && !APPS_SCRIPT_URL.startsWith('http')) {
  console.error('❌ NEXT_PUBLIC_APPS_SCRIPT_URL must be a valid URL starting with http or https.');
  console.error('Current value:', APPS_SCRIPT_URL);
}

// Utility to get current date in Eastern Time
export function getEasternTimeDate(): string {
  const now = new Date();
  const easternDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return easternDate.toISOString().split('T')[0];
}

// Utility to format date in Eastern Time
export function formatEasternDateTime(date: Date = new Date()): string {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
}

export interface Branch {
  branchNumber: number;
  branchName: string;
  address: string;
  phone: string;
  carrier: string;
}

export interface Picker {
  pickerID: number;
  pickerName: string;
}

export interface StageRecord {
  timestamp: Date | string;
  pickerID: number;
  pickerName: string;
  branchNumber: number;
  branchName: string;
  pallets: number;
  boxes: number;
  rolls: number;
  date: string;
  // Advanced fields
  fiberglass?: number;
  waterHeaters?: number;
  waterRights?: number;
  boxTub?: number;
  copperPipe?: number;
  plasticPipe?: number;
  galvPipe?: number;
  blackPipe?: number;
  wood?: number;
  galvStrut?: number;
  im540Tank?: number;
  im1250Tank?: number;
  mailBox?: number;
  custom?: string; // Format: "Item1:Quantity1,Item2:Quantity2"
  transferNumber?: string; // Transfer number for this branch on this date
  rowIndex?: number; // The Google Sheets row index for deletion
}

export interface BayAssignments {
  [bayNumber: number]: number[] | number | null;
}

export interface Truck {
  truckID: number;
  truckName: string;
  createDate: string;
  createTimestamp: Date | string;
  status: string;
  carrier: string;
}

export interface StagingItem {
  branchNumber: number;
  branchName: string;
  pickDate: string;
  pallets: number;
  boxes: number;
  rolls: number;
  fiberglass?: number;
  waterHeaters?: number;
  waterRights?: number;
  boxTub?: number;
  copperPipe?: number;
  plasticPipe?: number;
  galvPipe?: number;
  blackPipe?: number;
  wood?: number;
  galvStrut?: number;
  im540Tank?: number;
  im1250Tank?: number;
  mailBox?: number;
  custom?: string;
  transferNumber?: string; // Transfer number for this branch on this date
}

export interface TruckLoad extends StagingItem {
  truckID: number;
  loadedTimestamp: Date | string;
  transferNumber?: string;
}

async function fetchFromAppsScript(action: string, params: Record<string, any> = {}, retryCount = 0) {
  // Validate API URL before making request
  if (!APPS_SCRIPT_URL) {
    throw new Error('NEXT_PUBLIC_APPS_SCRIPT_URL environment variable is not set. Please configure it in your Vercel project settings or .env.local file. See VERCEL_SETUP.md for instructions.');
  }

  // Use the internal proxy endpoint to avoid CORS issues
  const proxyUrl = '/api/proxy';
  const searchParams = new URLSearchParams({ action });
  
  Object.keys(params).forEach(key => {
    searchParams.append(key, typeof params[key] === 'object' ? JSON.stringify(params[key]) : String(params[key]));
  });

  const finalUrl = `${proxyUrl}?${searchParams.toString()}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if the API response indicates success
    if (data.success === false) {
      throw new Error(data.error || 'Unknown API error');
    }
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';
    
    // Handle timeout specifically
    if (errorName === 'AbortError') {
      console.error(`Request timeout for action: ${action}`);
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    
    // Handle network errors
    if (errorName === 'TypeError' && errorMessage.includes('fetch')) {
      console.error(`Network error for action: ${action}`, error);
      throw new Error('Network connection error. Please check your internet connection.');
    }
    
    // Retry logic for transient errors (max 2 retries)
    if (retryCount < 2 && (
      errorMessage.includes('Network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('Connection')
    )) {
      console.log(`Retrying ${action} (attempt ${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return fetchFromAppsScript(action, params, retryCount + 1);
    }
    
    // Re-throw other errors
    throw error;
  }
}

export async function getBranches(): Promise<Branch[]> {
  const result = await fetchFromAppsScript('getBranches');
  return result.data;
}

export async function getVersion(): Promise<string> {
  const result = await fetchFromAppsScript('getVersion');
  return result.version || 'Unknown';
}

export async function getPickers(): Promise<Picker[]> {
  const result = await fetchFromAppsScript('getPickers');
  return result.data;
}

export async function getBayAssignments(): Promise<BayAssignments> {
  const result = await fetchFromAppsScript('getBayAssignments');
  return result.data;
}

export async function updateBayAssignments(assignments: BayAssignments): Promise<void> {
  await fetchFromAppsScript('updateBayAssignments', { assignments });
}

export async function getStageRecords(date?: string): Promise<StageRecord[]> {
  console.log('API: Fetching stage records for date:', date);
  const result = await fetchFromAppsScript('getStageRecords', { date });
  console.log('API: Received result:', result);
  return result.data;
}

export async function addStageRecord(record: Omit<StageRecord, 'timestamp' | 'date'>): Promise<void> {
  await fetchFromAppsScript('addStageRecord', { record });
}

export async function addPicker(picker: Picker): Promise<void> {
  await fetchFromAppsScript('addPicker', { picker });
}

// Hard-coded PIN verification (client-side check before API call)
export function verifyPinLocal(pin: string): boolean {
  // Hard-coded PIN: 423323
  // Simple encoding check (but we verify locally for speed)
  return pin === '423323';
}

export async function verifyPin(pin: string): Promise<boolean> {
  // First check locally for speed
  if (!verifyPinLocal(pin)) {
    return false;
  }
  // Then verify with server
  const result = await fetchFromAppsScript('verifyPin', { pin });
  return result.valid;
}

export async function getDailySummary(date?: string): Promise<any> {
  // If no date provided, use current date in Eastern Time
  let dateToUse = date;
  if (!dateToUse) {
    const now = new Date();
    const easternDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    dateToUse = easternDate.toISOString().split('T')[0];
  }
  const result = await fetchFromAppsScript('getDailySummary', { date: dateToUse });
  return result;
}

export async function clearBoard(): Promise<void> {
  await fetchFromAppsScript('clearBoard');
}

export async function deleteStageRecord(rowIndex: number): Promise<void> {
  await fetchFromAppsScript('deleteStageRecord', { rowIndex });
}

// Utility function to calculate ship date (2 business days ahead, skipping weekends)
export function calculateShipDate(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  let daysToAdd = 2;
  
  // Get day of week (0 = Sunday, 4 = Thursday, 5 = Friday)
  const dayOfWeek = date.getDay();
  
  // If Thursday (4), add 4 days to get to Monday
  if (dayOfWeek === 4) {
    daysToAdd = 4;
  }
  // If Friday (5), add 4 days to get to Tuesday
  else if (dayOfWeek === 5) {
    daysToAdd = 4;
  }
  // Otherwise just add 2 days
  
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

// ===== TRUCK LOADING API FUNCTIONS =====

export async function getTrucks(): Promise<Truck[]> {
  const result = await fetchFromAppsScript('getTrucks');
  return result.data;
}

export async function createTruck(truckName?: string, carrier?: string): Promise<Truck> {
  const result = await fetchFromAppsScript('createTruck', { truckName: truckName || '', carrier: carrier || 'STEFI' });
  return result.data;
}

export async function getStagingArea(): Promise<StagingItem[]> {
  const result = await fetchFromAppsScript('getStagingArea');
  return result.data;
}

export async function loadToTruck(truckID: number, loads: StagingItem[]): Promise<void> {
  await fetchFromAppsScript('loadToTruck', { truckID, loads });
}

export async function getTruckLoads(truckID: number): Promise<TruckLoad[]> {
  const result = await fetchFromAppsScript('getTruckLoads', { truckID });
  return result.data;
}

export async function clearStagingArea(): Promise<void> {
  await fetchFromAppsScript('clearStagingArea');
}

export async function updateTruckStatus(truckID: number, status: string): Promise<void> {
  await fetchFromAppsScript('updateTruckStatus', { truckID, status });
}

export async function getDepartedTruckLoadsByDate(date: string): Promise<TruckLoad[]> {
  const result = await fetchFromAppsScript('getDepartedTruckLoadsByDate', { date });
  return result.data || [];
}

// Get existing transfer number for a branch on a specific date
export async function getExistingTransferNumber(branchNumber: number, date: string): Promise<string | null> {
  const result = await fetchFromAppsScript('getExistingTransferNumber', { branchNumber, date });
  return result.data;
}

// Update transfer number for a specific stage record
export async function updateStageRecordTransferNumber(rowIndex: number, transferNumber: string): Promise<void> {
  await fetchFromAppsScript('updateStageRecordTransferNumber', {
    updateParams: JSON.stringify({ rowIndex, transferNumber })
  });
}


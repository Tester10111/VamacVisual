// API functions to interact with Google Apps Script

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

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
}

export interface BayAssignments {
  [bayNumber: number]: number[] | number | null;
}

async function fetchFromAppsScript(action: string, params: Record<string, any> = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.append('action', action);
  
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]);
  });

  const response = await fetch(url.toString());
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }
  
  return data;
}

export async function getBranches(): Promise<Branch[]> {
  const result = await fetchFromAppsScript('getBranches');
  return result.data;
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


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

export interface Truck {
  truckID: number;
  truckName: string;
  createDate: string;
  createTimestamp: Date | string;
  status: string;
  carrier: string;
}

export interface LoadItem {
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

export interface TruckLoad extends LoadItem {
  truckID: number;
  loadedTimestamp: Date | string;
}

async function fetchFromAppsScript(action: string, params: Record<string, any> = {}, retryCount = 0) {
  // Import connection health monitor dynamically to avoid circular imports
  const { connectionHealthMonitor } = await import('./connectionHealthMonitor');

  // Validate API URL before making request
  if (!APPS_SCRIPT_URL) {
    throw new Error('NEXT_PUBLIC_APPS_SCRIPT_URL environment variable is not set. Please configure it in your Vercel project settings or .env.local file. See VERCEL_SETUP.md for instructions.');
  }

  // Check connection health before making request
  if (!connectionHealthMonitor.isHealthy() && retryCount === 0) {
    console.warn('⚠️ Connection health degraded, but proceeding with request...');
  }

  // Use the internal proxy endpoint to avoid CORS issues
  const proxyUrl = '/api/proxy';
  const searchParams = new URLSearchParams({ action });

  Object.keys(params).forEach(key => {
    searchParams.append(key, typeof params[key] === 'object' ? JSON.stringify(params[key]) : String(params[key]));
  });

  const finalUrl = `${proxyUrl}?${searchParams.toString()}`;

  // Create abort controller for timeout with dynamic timeout based on connection health
  const controller = new AbortController();
  const isHealthy = connectionHealthMonitor.isHealthy();
  const timeoutDuration = isHealthy ? 15000 : 30000; // Longer timeout for unhealthy connections
  const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

  // Add request ID for tracking
  const requestId = `${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`🔄 [${requestId}] Making API request: ${action} (attempt ${retryCount + 1})`);

  try {
    const startTime = Date.now();

    const response = await fetch(finalUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Request-ID': requestId,
      },
    });

    const duration = Date.now() - startTime;
    clearTimeout(timeoutId);

    console.log(`✅ [${requestId}] Response received in ${duration}ms`);

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if the API response indicates success
    if (data.success === false) {
      throw new Error(data.error || 'Unknown API error');
    }

    // Log successful response for monitoring
    if (duration > 10000) {
      console.warn(`⚠️ [${requestId}] Slow response detected: ${duration}ms`);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';
    const duration = Date.now() - Date.now();

    console.error(`❌ [${requestId}] Request failed: ${errorName} - ${errorMessage}`);

    // Handle timeout specifically
    if (errorName === 'AbortError') {
      const timeoutMsg = `Request timeout for action: ${action} (${timeoutDuration}ms)`;
      console.error(`⏰ [${requestId}] ${timeoutMsg}`);

      throw new Error('Request timed out. Please check your connection and try again.');
    }

    // Handle network errors
    if (errorName === 'TypeError' && errorMessage.includes('fetch')) {
      console.error(`🌐 [${requestId}] Network error for action: ${action}`, error);
      throw new Error('Network connection error. Please check your internet connection.');
    }

    // Enhanced retry logic for transient errors
    const shouldRetry = retryCount < 2 && (
      errorMessage.includes('Network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('Connection') ||
      errorMessage.includes('HTTP 5') || // Server errors
      errorMessage.includes('HTTP 429') // Rate limiting
    );

    if (shouldRetry) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 8000); // Exponential backoff with cap at 8 seconds
      console.log(`🔄 [${requestId}] Retrying ${action} (attempt ${retryCount + 1}/2) in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
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

// ===== TRUCK LOADING API FUNCTIONS =====

export async function getTrucks(): Promise<Truck[]> {
  const result = await fetchFromAppsScript('getTrucks');
  return result.data;
}

export async function createTruck(truckName?: string, carrier?: string): Promise<Truck> {
  const result = await fetchFromAppsScript('createTruck', { truckName: truckName || '', carrier: carrier || 'STEFI' });
  return result.data;
}

export async function loadToTruck(truckID: number, loads: LoadItem[]): Promise<void> {
  await fetchFromAppsScript('loadToTruck', { truckID, loads });
}

export async function getTruckLoads(truckID: number): Promise<TruckLoad[]> {
  const result = await fetchFromAppsScript('getTruckLoads', { truckID });
  return result.data;
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

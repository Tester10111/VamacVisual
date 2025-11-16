import {
  getBranches,
  getPickers,
  getBayAssignments,
  getVersion,
  getStagingArea,
  getTrucks,
  type Branch,
  type Picker,
  type BayAssignments,
  type StagingItem,
  type Truck
} from './api';
import { performanceMonitor } from './performanceMonitor';
import { connectionHealthMonitor } from './connectionHealthMonitor';

class DataManager {
  private static instance: DataManager;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for stale data
  private isPreloading = false;
  private preloaded = false;
  private connectionStateListeners: (() => void)[] = [];
  private isConnectionHealthy = true;

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  constructor() {
    // Listen for connection state changes
    connectionHealthMonitor.addListener((state) => {
      const wasHealthy = this.isConnectionHealthy;
      this.isConnectionHealthy = state.isOnline;
      
      // Add startup delay to prevent false positives during page refresh
      const isStartupPeriod = typeof window !== 'undefined' && (window as any).__appStartTime
        ? (Date.now() - (window as any).__appStartTime) < 10000 // 10 seconds
        : false;
      
      if (wasHealthy && !this.isConnectionHealthy && !isStartupPeriod) {
        console.warn('📡 Connection lost - switching to stale cache mode');
        this.onConnectionLost();
      } else if (!wasHealthy && this.isConnectionHealthy) {
        console.log('🌐 Connection restored - clearing stale data and refreshing');
        this.onConnectionRestored();
      }
    });
  }

  // Handle connection loss
  private onConnectionLost(): void {
    // Notify listeners to show offline UI
    this.connectionStateListeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });
    
    // Extend cache duration for offline use
    console.log('📦 Switching to extended cache mode for offline use');
  }

  // Handle connection restoration
  private async onConnectionRestored(): Promise<void> {
    console.log('🔄 Connection restored - invalidating cache and refreshing data');
    
    // Clear critical data that might be stale
    const criticalKeys = ['stageRecords', 'stagingArea', 'bayAssignments'];
    criticalKeys.forEach(key => {
      if (this.cache.has(key)) {
        this.cache.delete(key);
        console.log(`🗑️ Cleared stale ${key} cache`);
      }
    });
    
    // Refresh critical data
    try {
      await this.preloadAllData();
    } catch (error) {
      console.error('Failed to refresh critical data after connection restore:', error);
    }
  }

  // Check if we have fresh cached data
  private isCachedFresh(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  // Check if we have stale cached data (for offline mode)
  private isCachedStale(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.STALE_CACHE_DURATION;
  }

  // Get data from cache or fetch fresh with offline support
  async getBranchesCached(): Promise<Branch[]> {
    if (this.isCachedFresh('branches')) {
      return this.cache.get('branches')!.data;
    }
    
    // If connection is unhealthy, try to use stale data
    if (!this.isConnectionHealthy && this.isCachedStale('branches')) {
      const cached = this.cache.get('branches');
      console.warn('📦 Using stale branch data due to connection issues');
      return cached?.data || [];
    }
    
    try {
      const data = await getBranches();
      this.cache.set('branches', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      // Return stale data if available
      const cached = this.cache.get('branches');
      if (cached) {
        console.warn('📦 Using stale branch data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  async getPickersCached(): Promise<Picker[]> {
    if (this.isCachedFresh('pickers')) {
      return this.cache.get('pickers')!.data;
    }
    
    // If connection is unhealthy, try to use stale data
    if (!this.isConnectionHealthy && this.isCachedStale('pickers')) {
      const cached = this.cache.get('pickers');
      console.warn('📦 Using stale picker data due to connection issues');
      return cached?.data || [];
    }
    
    try {
      const data = await getPickers();
      this.cache.set('pickers', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('pickers');
      if (cached) {
        console.warn('📦 Using stale picker data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  async getBayAssignmentsCached(): Promise<BayAssignments> {
    if (this.isCachedFresh('bayAssignments')) {
      return this.cache.get('bayAssignments')!.data;
    }
    
    // If connection is unhealthy, try to use stale data
    if (!this.isConnectionHealthy && this.isCachedStale('bayAssignments')) {
      const cached = this.cache.get('bayAssignments');
      console.warn('📦 Using stale bay assignments data due to connection issues');
      return cached?.data || {};
    }
    
    try {
      const data = await getBayAssignments();
      this.cache.set('bayAssignments', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('bayAssignments');
      if (cached) {
        console.warn('📦 Using stale bay assignment data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  async getVersionCached(): Promise<string> {
    if (this.isCachedFresh('version')) {
      return this.cache.get('version')!.data;
    }
    
    // Version should always try to fetch fresh, but handle errors gracefully
    try {
      const data = await getVersion();
      this.cache.set('version', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('version');
      if (cached) {
        console.warn('📦 Using stale version data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  // Add connection state management
  addConnectionStateListener(callback: () => void): void {
    this.connectionStateListeners.push(callback);
  }

  removeConnectionStateListener(callback: () => void): void {
    this.connectionStateListeners = this.connectionStateListeners.filter(listener => listener !== callback);
  }

  // Get connection status for UI components
  getConnectionStatus(): { isHealthy: boolean; isOnline: boolean; reason?: string } {
    const healthState = connectionHealthMonitor.getState();
    
    // Add startup grace period to prevent false positives
    const isStartupPeriod = (typeof window !== 'undefined' && (window as any).__appStartTime)
      ? (Date.now() - (window as any).__appStartTime) < 10000 // 10 seconds
      : false;
    
    // During startup, be more lenient with connection status
    if (isStartupPeriod) {
      // During startup, assume connection is healthy unless we have clear evidence otherwise
      if (!healthState.isOnline) {
        return {
          isHealthy: true, // Show as healthy during startup
          isOnline: false,
          reason: 'Starting up...'
        };
      }
      
      // Allow 1-2 failures during startup without showing as unhealthy
      if (healthState.consecutiveFailures > 0 && healthState.consecutiveFailures < 2) {
        return {
          isHealthy: true, // Show as healthy during startup
          isOnline: true,
          reason: undefined
        };
      }
    }
    
    // After startup grace period, show actual status
    if (!healthState.isOnline) {
      return {
        isHealthy: false,
        isOnline: false,
        reason: 'No internet connection'
      };
    }
    
    if (healthState.consecutiveFailures > 0) {
      return {
        isHealthy: false,
        isOnline: true,
        reason: `Connection issues detected (${healthState.consecutiveFailures} consecutive failures)`
      };
    }
    
    return {
      isHealthy: true,
      isOnline: true
    };
  }

  async getStagingAreaCached(): Promise<StagingItem[]> {
    if (this.isCachedFresh('stagingArea')) {
      return this.cache.get('stagingArea')!.data;
    }
    
    // If connection is unhealthy, try to use stale data
    if (!this.isConnectionHealthy && this.isCachedStale('stagingArea')) {
      const cached = this.cache.get('stagingArea');
      console.warn('📦 Using stale staging area data due to connection issues');
      return cached?.data || [];
    }
    
    try {
      const data = await getStagingArea();
      this.cache.set('stagingArea', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('stagingArea');
      if (cached) {
        console.warn('📦 Using stale staging area data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  async getTrucksCached(): Promise<Truck[]> {
    if (this.isCachedFresh('trucks')) {
      return this.cache.get('trucks')!.data;
    }
    
    // If connection is unhealthy, try to use stale data
    if (!this.isConnectionHealthy && this.isCachedStale('trucks')) {
      const cached = this.cache.get('trucks');
      console.warn('📦 Using stale truck data due to connection issues');
      return cached?.data || [];
    }
    
    try {
      const data = await getTrucks();
      this.cache.set('trucks', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('trucks');
      if (cached) {
        console.warn('📦 Using stale truck data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  // Preload all critical data in background
  async preloadAllData(): Promise<void> {
    if (this.isPreloading || this.preloaded) {
      return; // Already preloading or completed
    }
    
    this.isPreloading = true;
    console.log('Starting background data preloading...');
    
    const perfId = performanceMonitor.start('data_preload_all');
    const startTime = Date.now();
    
    try {
      // Start all requests in parallel
      const promises = [
        getBranches(),
        getPickers(),
        getBayAssignments(),
        getVersion(),
        getStagingArea(),
        getTrucks()
      ];

      const [
        branchesData,
        pickersData,
        assignmentsData,
        versionData,
        stagingData,
        trucksData
      ] = await Promise.allSettled(promises);

      // Cache successful results
      if (branchesData.status === 'fulfilled') {
        this.cache.set('branches', { data: branchesData.value, timestamp: Date.now() });
      }
      
      if (pickersData.status === 'fulfilled') {
        this.cache.set('pickers', { data: pickersData.value, timestamp: Date.now() });
      }
      
      if (assignmentsData.status === 'fulfilled') {
        this.cache.set('bayAssignments', { data: assignmentsData.value, timestamp: Date.now() });
      }
      
      if (versionData.status === 'fulfilled') {
        this.cache.set('version', { data: versionData.value, timestamp: Date.now() });
      }
      
      if (stagingData.status === 'fulfilled') {
        this.cache.set('stagingArea', { data: stagingData.value, timestamp: Date.now() });
      }
      
      if (trucksData.status === 'fulfilled') {
        this.cache.set('trucks', { data: trucksData.value, timestamp: Date.now() });
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Data preloading completed in ${duration}ms`);
      this.preloaded = true;
      
      // End performance monitoring for successful completion
      performanceMonitor.end(perfId, { duration, totalRequests: 6, successful: true });
      
      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('dataPreloaded', {
        detail: { timestamp: Date.now() }
      }));
      
    } catch (error) {
      console.error(' Error during data preloading:', error);
      // Don't throw - let the app continue with fallback data
    } finally {
      this.isPreloading = false;
    }
  }

  // Force refresh specific data
  async refreshData(force = false): Promise<void> {
    if (force) {
      // Clear cache and refetch
      this.cache.clear();
      this.preloaded = false;
      await this.preloadAllData();
    } else {
      // Normal refresh
      await this.preloadAllData();
    }
  }

  // Get cache status for debugging
  getCacheStatus(): Record<string, { cached: boolean; age: number; size: number }> {
    const status: Record<string, { cached: boolean; age: number; size: number }> = {};
    
    Array.from(this.cache.keys()).forEach(key => {
      const value = this.cache.get(key);
      if (value) {
        status[key] = {
          cached: true,
          age: Date.now() - value.timestamp,
          size: JSON.stringify(value.data).length
        };
      }
    });
    
    return status;
  }

  // Clear all cache
  clearCache(): void {
    this.cache.clear();
    this.preloaded = false;
    console.log(' Data cache cleared');
  }
}

export const dataManager = DataManager.getInstance();
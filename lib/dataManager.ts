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

class DataManager {
  private static instance: DataManager;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private isPreloading = false;
  private preloaded = false;

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // Check if we have fresh cached data
  private isCachedFresh(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  // Get data from cache or fetch fresh
  async getBranchesCached(): Promise<Branch[]> {
    if (this.isCachedFresh('branches')) {
      return this.cache.get('branches')!.data;
    }
    
    try {
      const data = await getBranches();
      this.cache.set('branches', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      // Return stale data if available
      const cached = this.cache.get('branches');
      if (cached) {
        console.warn('Using stale branch data due to fetch error');
        return cached.data;
      }
      throw error;
    }
  }

  async getPickersCached(): Promise<Picker[]> {
    if (this.isCachedFresh('pickers')) {
      return this.cache.get('pickers')!.data;
    }
    
    try {
      const data = await getPickers();
      this.cache.set('pickers', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('pickers');
      if (cached) {
        console.warn('Using stale picker data due to fetch error');
        return cached.data;
      }
      throw error;
    }
  }

  async getBayAssignmentsCached(): Promise<BayAssignments> {
    if (this.isCachedFresh('bayAssignments')) {
      return this.cache.get('bayAssignments')!.data;
    }
    
    try {
      const data = await getBayAssignments();
      this.cache.set('bayAssignments', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('bayAssignments');
      if (cached) {
        console.warn('Using stale bay assignment data due to fetch error');
        return cached.data;
      }
      throw error;
    }
  }

  async getVersionCached(): Promise<string> {
    if (this.isCachedFresh('version')) {
      return this.cache.get('version')!.data;
    }
    
    try {
      const data = await getVersion();
      this.cache.set('version', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('version');
      if (cached) {
        console.warn('Using stale version data due to fetch error');
        return cached.data;
      }
      throw error;
    }
  }

  async getStagingAreaCached(): Promise<StagingItem[]> {
    if (this.isCachedFresh('stagingArea')) {
      return this.cache.get('stagingArea')!.data;
    }
    
    try {
      const data = await getStagingArea();
      this.cache.set('stagingArea', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('stagingArea');
      if (cached) {
        console.warn('Using stale staging area data due to fetch error');
        return cached.data;
      }
      throw error;
    }
  }

  async getTrucksCached(): Promise<Truck[]> {
    if (this.isCachedFresh('trucks')) {
      return this.cache.get('trucks')!.data;
    }
    
    try {
      const data = await getTrucks();
      this.cache.set('trucks', { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      const cached = this.cache.get('trucks');
      if (cached) {
        console.warn('Using stale truck data due to fetch error');
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
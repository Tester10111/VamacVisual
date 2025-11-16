// Connection Health Monitor for managing API timeouts and connection state
import { performanceMonitor } from './performanceMonitor';

interface HealthCheckResult {
  isHealthy: boolean;
  latency: number;
  error?: string;
  timestamp: number;
}

interface ConnectionState {
  isOnline: boolean;
  lastHeartbeat: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
}

class ConnectionHealthMonitor {
  private static instance: ConnectionHealthMonitor;
  private state: ConnectionState = {
    isOnline: true,
    lastHeartbeat: Date.now(),
    consecutiveFailures: 0,
    totalRequests: 0,
    successfulRequests: 0,
    averageLatency: 0
  };

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly STARTUP_GRACE_PERIOD = 15000; // 15 seconds of grace period
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_INTERVAL = 60000; // 1 minute
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly MAX_LATENCY = 10000; // 10 seconds
  private readonly OFFLINE_TIMEOUT = 120000; // 2 minutes

  private listeners: ((state: ConnectionState) => void)[] = [];

  static getInstance(): ConnectionHealthMonitor {
    if (!ConnectionHealthMonitor.instance) {
      ConnectionHealthMonitor.instance = new ConnectionHealthMonitor();
    }
    return ConnectionHealthMonitor.instance;
  }

  // Check if this is a page refresh vs fresh load
  private isPageRefresh(): boolean {
    // Check if we're in browser environment and navigation API is available
    if (typeof window === 'undefined' || !('navigation' in performance)) {
      return false; // Default to fresh load during SSR
    }
    return performance.navigation.type === performance.navigation.TYPE_RELOAD;
  }

  // Start monitoring
  start(): void {
    if (this.healthCheckInterval) return; // Already running

    console.log('🔍 Starting connection health monitoring...');
    
    // Extended warm-up period during page refresh (3 seconds instead of 1)
    const isRefresh = this.isPageRefresh();
    const warmupDelay = isRefresh ? 3000 : 1000;
    
    console.log(`⏳ Starting health monitoring with ${warmupDelay}ms warm-up period (${isRefresh ? 'refresh' : 'fresh load'})`);
    
    // Initial health check after warm-up period
    setTimeout(() => this.performHealthCheck(), warmupDelay);
    
    // Regular health checks (start after warm-up + one interval)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Heartbeat to keep connection alive (start after warm-up)
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    // Monitor online/offline events
    this.setupEventListeners();
  }

  // Stop monitoring
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.removeEventListeners();
    console.log('⏹️ Connection health monitoring stopped');
  }

  // Perform health check
  private async performHealthCheck(): Promise<void> {
    const perfId = performanceMonitor.start('health_check');
    const startTime = Date.now();
    const isStartupPeriod = (Date.now() - this.state.lastHeartbeat) < this.STARTUP_GRACE_PERIOD;
    
    try {
      const result = await this.checkConnectionHealth();
      const latency = Date.now() - startTime;

      this.updateHealthMetrics(result, latency, isStartupPeriod);
      
      performanceMonitor.end(perfId, { latency, healthy: result.isHealthy });
      
      // Notify listeners of state changes
      this.notifyListeners();
      
    } catch (error) {
      console.warn('Health check failed:', error);
      // Only record failures after startup grace period
      if (!isStartupPeriod) {
        this.recordFailure();
      } else {
        console.log('🛡️ Startup grace period - not counting this failure');
      }
      this.notifyListeners();
      performanceMonitor.end(perfId, { error: String(error), healthy: false });
    }
  }

  // Check connection health by making a simple API call
  private async checkConnectionHealth(): Promise<HealthCheckResult> {
    // Skip health check if we're in server-side rendering
    if (typeof window === 'undefined') {
      return {
        isHealthy: true,
        latency: 0,
        timestamp: Date.now()
      };
    }

    try {
      const controller = new AbortController();
      const isStartupPeriod = (Date.now() - this.state.lastHeartbeat) < this.STARTUP_GRACE_PERIOD;
      const timeoutDuration = isStartupPeriod ? 10000 : 5000; // 10s during startup, 5s normally
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      try {
        const startTime = Date.now();
        
        console.log(`🔍 Performing health check (${isStartupPeriod ? 'startup' : 'normal'} mode, ${timeoutDuration}ms timeout)`);
        
        // Use a lightweight endpoint for health checks
        const response = await fetch('/api/proxy?action=getVersion', {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        console.log(`✅ Health check completed in ${latency}ms`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success === false) {
          throw new Error(data.error || 'API returned error');
        }

        return {
          isHealthy: true,
          latency,
          timestamp: Date.now()
        };
        
      } catch (innerError) {
        clearTimeout(timeoutId);
        throw innerError; // Re-throw to be caught by outer try-catch
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      
      console.warn(`❌ Health check failed: ${isTimeout ? 'timeout' : errorMessage}`);
      
      return {
        isHealthy: false,
        latency: this.state.averageLatency || 0,
        error: isTimeout ? `Health check timeout` : errorMessage,
        timestamp: Date.now()
      };
    }
  }

  // Send lightweight heartbeat to keep connection alive
  private async sendHeartbeat(): Promise<void> {
    try {
      // Only send heartbeat if we think we're online
      if (!this.state.isOnline) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('/api/proxy?action=getVersion', {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);
      this.state.lastHeartbeat = Date.now();
      
    } catch (error) {
      console.warn('Heartbeat failed:', error);
      this.recordFailure();
    }
  }

  // Update health metrics
  private updateHealthMetrics(result: HealthCheckResult, latency: number, isStartupPeriod: boolean = false): void {
    if (result.isHealthy) {
      this.state.isOnline = true;
      // Don't reset failures during startup period to avoid confusion
      if (!isStartupPeriod) {
        this.state.consecutiveFailures = 0;
      }
      this.state.totalRequests++;
      this.state.successfulRequests++;
      
      // Update average latency using exponential moving average
      const alpha = 0.1; // Smoothing factor
      this.state.averageLatency = this.state.averageLatency === 0
        ? latency
        : (alpha * latency + (1 - alpha) * this.state.averageLatency);
        
    } else {
      // Only record failures after startup grace period
      if (!isStartupPeriod) {
        this.recordFailure();
      }
    }
    
    this.state.lastHeartbeat = Date.now();
  }

  // Record a failure
  private recordFailure(): void {
    this.state.consecutiveFailures++;
    this.state.totalRequests++;
    
    // Mark as offline if too many consecutive failures
    if (this.state.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.state.isOnline = false;
      console.warn('🚨 Connection marked as offline due to consecutive failures');
    }
  }

  // Setup online/offline event listeners
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  // Remove event listeners
  private removeEventListeners(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
  }

  // Handle coming online
  private handleOnline(): void {
    console.log('🌐 Connection restored');
    this.state.isOnline = true;
    this.state.consecutiveFailures = 0;
    this.performHealthCheck(); // Immediate health check
    this.notifyListeners();
  }

  // Handle going offline
  private handleOffline(): void {
    console.log('📡 Connection lost');
    this.state.isOnline = false;
    this.state.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES; // Force offline state
    this.notifyListeners();
  }

  // Check if connection is healthy for operations
  isHealthy(): boolean {
    return this.state.isOnline && 
           this.state.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES &&
           this.state.averageLatency < this.MAX_LATENCY;
  }

  // Get current connection state
  getState(): ConnectionState {
    return { ...this.state };
  }

  // Add state change listener
  addListener(callback: (state: ConnectionState) => void): void {
    this.listeners.push(callback);
  }

  // Remove state change listener
  removeListener(callback: (state: ConnectionState) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of state changes
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback({ ...this.state });
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });
  }

  // Get success rate percentage
  getSuccessRate(): number {
    if (this.state.totalRequests === 0) return 100;
    return Math.round((this.state.successfulRequests / this.state.totalRequests) * 100);
  }

  // Reset metrics
  reset(): void {
    this.state = {
      isOnline: true,
      lastHeartbeat: Date.now(),
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      averageLatency: 0
    };
    this.notifyListeners();
  }
}

export const connectionHealthMonitor = ConnectionHealthMonitor.getInstance();
export type { ConnectionState, HealthCheckResult };
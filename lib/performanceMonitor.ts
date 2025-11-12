interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private isEnabled: boolean = process.env.NODE_ENV !== 'production';

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start timing a performance metric
  start(name: string, metadata?: Record<string, any>): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.isEnabled) {
      this.metrics.push({
        name,
        startTime: performance.now(),
        metadata
      });
      
      // Log to console for development
      if (typeof window !== 'undefined' && window.console) {
        console.log(` Performance: Started "${name}"`, metadata);
      }
    }
    
    return id;
  }

  // End timing for a specific metric
  end(id: string, additionalMetadata?: Record<string, any>) {
    if (!this.isEnabled) return;

    const metric = this.metrics.find(m => 
      m.name === id.split('_')[0] && 
      m.startTime === parseFloat(id.split('_')[1])
    );

    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      
      if (additionalMetadata) {
        metric.metadata = { ...metric.metadata, ...additionalMetadata };
      }

      // Log completion
      if (typeof window !== 'undefined' && window.console) {
        console.log(`✅ Performance: "${metric.name}" completed in ${metric.duration.toFixed(2)}ms`, metric.metadata);
        
        // Highlight slow operations
        if (metric.duration > 1000) {
          console.warn(` SLOW OPERATION: "${metric.name}" took ${metric.duration.toFixed(2)}ms`, metric.metadata);
        }
      }
    }
  }

  // Time a function automatically
  async time<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      if (this.isEnabled && typeof window !== 'undefined' && window.console) {
        console.log(` Performance: "${name}" completed in ${duration.toFixed(2)}ms`, metadata);
        
        if (duration > 1000) {
          console.warn(` SLOW OPERATION: "${name}" took ${duration.toFixed(2)}ms`, metadata);
        }
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      if (this.isEnabled && typeof window !== 'undefined' && window.console) {
        console.error(` Performance: "${name}" failed after ${duration.toFixed(2)}ms`, { error, ...metadata });
      }
      
      throw error;
    }
  }

  // Get all metrics for analysis
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Clear all metrics
  clear() {
    this.metrics = [];
  }

  // Generate performance report
  generateReport(): string {
    if (!this.isEnabled) return 'Performance monitoring is disabled in production';

    const completedMetrics = this.metrics.filter(m => m.duration !== undefined);
    
    if (completedMetrics.length === 0) {
      return 'No performance metrics recorded';
    }

    const report = completedMetrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .map(m => `${m.name}: ${m.duration?.toFixed(2)}ms`)
      .join('\n');

    return `Performance Report:\n${report}`;
  }

  // Enable/disable monitoring
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Hook for React components
export function usePerformanceMonitor() {
  return {
    start: performanceMonitor.start.bind(performanceMonitor),
    end: performanceMonitor.end.bind(performanceMonitor),
    time: performanceMonitor.time.bind(performanceMonitor),
  };
}
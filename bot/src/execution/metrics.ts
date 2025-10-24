/**
 * Prometheus metrics for execution tracking
 * This module provides counters and gauges for monitoring arbitrage execution performance
 */

interface MetricsData {
  exec_success_total: number;
  exec_revert_total: number;
  exec_blocked_total: number;
  avg_gas_used: number;
  avg_profit_wei: number;
  total_executions: number;
  last_execution_timestamp: number;
}

class ExecutionMetrics {
  private metrics: MetricsData = {
    exec_success_total: 0,
    exec_revert_total: 0,
    exec_blocked_total: 0,
    avg_gas_used: 0,
    avg_profit_wei: 0,
    total_executions: 0,
    last_execution_timestamp: 0,
  };

  private gasUsedHistory: number[] = [];
  private profitHistory: number[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Record a successful execution
   */
  recordSuccess(gasUsed: bigint, profitWei: bigint): void {
    this.metrics.exec_success_total++;
    this.metrics.total_executions++;
    this.metrics.last_execution_timestamp = Date.now();
    
    this.updateAverages(Number(gasUsed), Number(profitWei));
  }

  /**
   * Record a reverted execution
   */
  recordRevert(gasUsed?: bigint, profitWei?: bigint): void {
    this.metrics.exec_revert_total++;
    this.metrics.total_executions++;
    this.metrics.last_execution_timestamp = Date.now();
    
    if (gasUsed !== undefined && profitWei !== undefined) {
      this.updateAverages(Number(gasUsed), Number(profitWei));
    }
  }

  /**
   * Record a blocked execution (safety guards triggered)
   */
  recordBlocked(reason: string): void {
    this.metrics.exec_blocked_total++;
    this.metrics.total_executions++;
    this.metrics.last_execution_timestamp = Date.now();
    
    // Log the blocking reason for analysis
    console.log(`[METRICS] Execution blocked: ${reason}`);
  }

  /**
   * Update running averages for gas and profit
   */
  private updateAverages(gasUsed: number, profitWei: number): void {
    // Add to history
    this.gasUsedHistory.push(gasUsed);
    this.profitHistory.push(profitWei);
    
    // Maintain max history size
    if (this.gasUsedHistory.length > this.maxHistorySize) {
      this.gasUsedHistory.shift();
    }
    if (this.profitHistory.length > this.maxHistorySize) {
      this.profitHistory.shift();
    }
    
    // Calculate averages
    this.metrics.avg_gas_used = this.gasUsedHistory.reduce((a, b) => a + b, 0) / this.gasUsedHistory.length;
    this.metrics.avg_profit_wei = this.profitHistory.reduce((a, b) => a + b, 0) / this.profitHistory.length;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): MetricsData {
    return { ...this.metrics };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const timestamp = Date.now();
    return [
      `# HELP exec_success_total Total number of successful arbitrage executions`,
      `# TYPE exec_success_total counter`,
      `exec_success_total ${this.metrics.exec_success_total} ${timestamp}`,
      ``,
      `# HELP exec_revert_total Total number of reverted arbitrage executions`,
      `# TYPE exec_revert_total counter`,
      `exec_revert_total ${this.metrics.exec_revert_total} ${timestamp}`,
      ``,
      `# HELP exec_blocked_total Total number of blocked arbitrage executions`,
      `# TYPE exec_blocked_total counter`,
      `exec_blocked_total ${this.metrics.exec_blocked_total} ${timestamp}`,
      ``,
      `# HELP avg_gas_used Average gas used per execution`,
      `# TYPE avg_gas_used gauge`,
      `avg_gas_used ${this.metrics.avg_gas_used} ${timestamp}`,
      ``,
      `# HELP avg_profit_wei Average profit in wei per execution`,
      `# TYPE avg_profit_wei gauge`,
      `avg_profit_wei ${this.metrics.avg_profit_wei} ${timestamp}`,
      ``,
      `# HELP total_executions Total number of execution attempts`,
      `# TYPE total_executions counter`,
      `total_executions ${this.metrics.total_executions} ${timestamp}`,
      ``,
      `# HELP last_execution_timestamp Timestamp of last execution attempt`,
      `# TYPE last_execution_timestamp gauge`,
      `last_execution_timestamp ${this.metrics.last_execution_timestamp} ${timestamp}`,
    ].join('\n');
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.metrics.total_executions === 0) return 0;
    return (this.metrics.exec_success_total / this.metrics.total_executions) * 100;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    successRate: number;
    totalExecutions: number;
    avgGasUsed: number;
    avgProfitEth: number;
    lastExecution: Date | null;
  } {
    return {
      successRate: this.getSuccessRate(),
      totalExecutions: this.metrics.total_executions,
      avgGasUsed: this.metrics.avg_gas_used,
      avgProfitEth: this.metrics.avg_profit_wei / 1e18,
      lastExecution: this.metrics.last_execution_timestamp > 0 
        ? new Date(this.metrics.last_execution_timestamp) 
        : null,
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      exec_success_total: 0,
      exec_revert_total: 0,
      exec_blocked_total: 0,
      avg_gas_used: 0,
      avg_profit_wei: 0,
      total_executions: 0,
      last_execution_timestamp: 0,
    };
    this.gasUsedHistory = [];
    this.profitHistory = [];
  }
}

// Global metrics instance
export const executionMetrics = new ExecutionMetrics();

/**
 * Helper function to record execution result in metrics
 */
export function recordExecutionResult(
  status: 'success' | 'reverted' | 'blocked',
  gasUsed?: bigint,
  profitWei?: bigint,
  revertReason?: string
): void {
  switch (status) {
    case 'success':
      if (gasUsed !== undefined && profitWei !== undefined) {
        executionMetrics.recordSuccess(gasUsed, profitWei);
      }
      break;
    case 'reverted':
      executionMetrics.recordRevert(gasUsed, profitWei);
      break;
    case 'blocked':
      executionMetrics.recordBlocked(revertReason || 'unknown');
      break;
  }
}

/**
 * Express middleware to serve Prometheus metrics
 */
export function createMetricsHandler() {
  return (req: any, res: any) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(executionMetrics.getPrometheusMetrics());
  };
}

export { ExecutionMetrics };
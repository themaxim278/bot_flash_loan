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
declare class ExecutionMetrics {
    private metrics;
    private gasUsedHistory;
    private profitHistory;
    private readonly maxHistorySize;
    /**
     * Record a successful execution
     */
    recordSuccess(gasUsed: bigint, profitWei: bigint): void;
    /**
     * Record a reverted execution
     */
    recordRevert(gasUsed?: bigint, profitWei?: bigint): void;
    /**
     * Record a blocked execution (safety guards triggered)
     */
    recordBlocked(reason: string): void;
    /**
     * Update running averages for gas and profit
     */
    private updateAverages;
    /**
     * Get current metrics snapshot
     */
    getMetrics(): MetricsData;
    /**
     * Get metrics in Prometheus format
     */
    getPrometheusMetrics(): string;
    /**
     * Get success rate as percentage
     */
    getSuccessRate(): number;
    /**
     * Get summary statistics
     */
    getSummary(): {
        successRate: number;
        totalExecutions: number;
        avgGasUsed: number;
        avgProfitEth: number;
        lastExecution: Date | null;
    };
    /**
     * Reset all metrics (useful for testing)
     */
    reset(): void;
}
export declare const executionMetrics: ExecutionMetrics;
/**
 * Helper function to record execution result in metrics
 */
export declare function recordExecutionResult(status: 'success' | 'reverted' | 'blocked', gasUsed?: bigint, profitWei?: bigint, revertReason?: string): void;
/**
 * Express middleware to serve Prometheus metrics
 */
export declare function createMetricsHandler(): (req: any, res: any) => void;
export { ExecutionMetrics };

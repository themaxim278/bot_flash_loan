import { JsonRpcProvider } from 'ethers';
import type { Opportunity } from '../discovery/types';
import type { EvaluationContext } from '../evaluation/types';
import type { OnChainSimulationResult } from '../simulation/simulate';
export interface ExecutionResult {
    txHash?: string;
    gasUsed?: bigint;
    profitExpected: bigint;
    relayUsed: boolean;
    status: 'success' | 'reverted' | 'blocked' | 'dry-run';
    revertReason?: string;
    txData?: {
        to: string;
        data: string;
        value: string;
        gasLimit: string;
        maxFeePerGas: string;
        maxPriorityFeePerGas: string;
    };
}
export interface ExecutionOptions {
    dryRun?: boolean;
    privateKey?: string;
}
/**
 * Executes an arbitrage opportunity with safety guards and MEV protection
 */
export declare function executeOpportunity(opportunity: Opportunity, simulationResult: OnChainSimulationResult, ctx: EvaluationContext, provider: JsonRpcProvider, options?: ExecutionOptions): Promise<ExecutionResult>;

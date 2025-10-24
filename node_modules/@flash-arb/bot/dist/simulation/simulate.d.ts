import { JsonRpcProvider } from 'ethers';
import type { Opportunity } from '../discovery/types';
import type { EvaluationContext } from '../evaluation/types';
export interface OnChainSimulationResult {
    path: string[];
    expectedOutWei: bigint;
    gasEstimatedWei: bigint;
    netProfitWei: bigint;
    ok: boolean;
    simulated: boolean;
    revertReason?: string;
}
export declare function simulateOnChain(opp: Opportunity, ctx: EvaluationContext, provider: JsonRpcProvider, executorAddress?: string): Promise<OnChainSimulationResult>;

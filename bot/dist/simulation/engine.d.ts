import { JsonRpcProvider } from 'ethers';
import type { Opportunity } from '../discovery/types';
import type { EvaluationContext } from '../evaluation/types';
export interface SimulationResult {
    path: string[];
    expectedOutWei: bigint;
    gasEstimatedWei: bigint;
    ok: boolean;
    netProfitWei: bigint;
    reason?: string;
}
export declare function simulateOpportunity(opp: Opportunity, ctx: EvaluationContext, provider: JsonRpcProvider): Promise<SimulationResult>;

import type { Opportunity } from '../discovery/types';
import type { RuntimeConfig } from '../types';
export interface EvaluatedOpportunity extends Opportunity {
    gasWei: number;
    netProfitWei: number;
    notionalUsd: number;
    reason?: string;
}
export interface EvaluationContext {
    cfg: RuntimeConfig;
    mevBufferBps: number;
    ethUsdPrice: number;
}

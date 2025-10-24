import type { Opportunity } from '../discovery/types';
import type { RuntimeConfig } from '../types';

export interface EvaluatedOpportunity extends Opportunity {
  gasWei: number;
  netProfitWei: number;
  notionalUsd: number;
  reason?: string; // rejection reason if any
}

export interface EvaluationContext {
  cfg: RuntimeConfig;
  mevBufferBps: number; // default safety buffer for MEV risk
  ethUsdPrice: number; // assumed ETH/USD price for USD<->Wei conversions
}
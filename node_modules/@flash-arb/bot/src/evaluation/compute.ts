import type { Opportunity } from '../discovery/types';
import type { EvaluationContext, EvaluatedOpportunity } from './types';

const BASE_UNITS = 250000; // baseline used to derive per-unit price so that est gas <= cap

function estimateGasUnits(hops: number): number {
  const base = 50000; // overhead
  const perHop = 70000; // rough per hop cost
  return base + hops * perHop;
}

function usdToWei(usd: number, ethUsdPrice: number): number {
  const eth = usd / ethUsdPrice; // ETH amount
  return Math.round(eth * 1e18);
}

export function chooseNotionalUsd(opp: Opportunity, ctx: EvaluationContext): number {
  const cap = 50000; // avoid unrealistically large size in demo
  const size = Math.max(1000, Math.floor(opp.minLiquidityUsd * 0.05)); // 5% of path liquidity
  return Math.min(size, cap);
}

export function evaluateOpportunity(opp: Opportunity, ctx: EvaluationContext): EvaluatedOpportunity {
  const { cfg, mevBufferBps, ethUsdPrice } = ctx;
  const notionalUsd = (cfg.notionalUsdDefault ?? chooseNotionalUsd(opp, ctx));

  const units = estimateGasUnits(opp.hops);
  const assumedGasPricePerUnit = cfg.maxGasWei / BASE_UNITS; // derive conservative price per unit
  const gasWei = Math.round(units * assumedGasPricePerUnit);

  // Gross profit from spread
  const grossProfitUsd = notionalUsd * (opp.spreadBps / 10000);
  const grossProfitWei = usdToWei(grossProfitUsd, ethUsdPrice);

  const inputWei = usdToWei(notionalUsd, ethUsdPrice);
  const flashFeeWei = Math.round((inputWei * cfg.flashLoan.feeBps) / 10000);
  const mevBufferWei = Math.round((inputWei * mevBufferBps) / 10000);

  const netProfitWei = grossProfitWei - flashFeeWei - gasWei - mevBufferWei;

  // Hard limit checks and reasons (prioritize economic viability first)
  let reason: string | undefined;
  if (opp.minLiquidityUsd < cfg.minLiquidityUsd) {
    reason = 'low-liquidity';
  } else if (Math.abs(opp.spreadBps) > cfg.maxSlippageBps) {
    // Treat absolute spread as a proxy for slippage risk in demo
    reason = 'slippage-too-high';
  } else if (netProfitWei <= 0) {
    reason = 'negative-profit';
  } else if (netProfitWei < cfg.minNetProfitWei) {
    reason = 'below-min-profit';
  } else if (gasWei > cfg.maxGasWei) {
    reason = 'gas-too-expensive';
  }

  return {
    ...opp,
    gasWei,
    netProfitWei,
    notionalUsd,
    reason,
  };
}
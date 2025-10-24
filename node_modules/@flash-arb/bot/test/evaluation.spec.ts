import { describe, it, expect } from 'vitest';
import { evaluateOpportunity } from '../src/evaluation/compute';
import type { EvaluationContext } from '../src/evaluation/types';
import type { Opportunity } from '../src/discovery/types';

const baseCtx: EvaluationContext = {
  cfg: {
    network: 'local',
    rpcUrl: 'http://localhost:8545',
    relayUrl: 'http://localhost:8080',
    minNetProfitWei: 1, // allow tiny profit
    maxSlippageBps: 50, // 0.5%
    deadlineSeconds: 30,
    scanIntervalMs: 1000,
    maxGasWei: 2e11, // 200,000,000,000 wei
    minLiquidityUsd: 100000,
    dexes: ['uniswapv2', 'uniswapv3', 'sushi'],
    flashLoan: { provider: 'aaveV3', feeBps: 9 },
  },
  mevBufferBps: 5,
  ethUsdPrice: 3500,
};

function opp(spreadBps: number, hops: number, minLiquidityUsd = 300000): Opportunity {
  return { path: ['WETH', 'USDC'], hops, spreadBps, minLiquidityUsd } as Opportunity;
}

describe('evaluation edge cases', () => {
  it('rejects negative profit', () => {
    const e = evaluateOpportunity(opp(-10, 2), baseCtx);
    expect(e.reason).toBe('negative-profit');
  });

  it('rejects slippage too high', () => {
    const e = evaluateOpportunity(opp(100, 2), { ...baseCtx, cfg: { ...baseCtx.cfg, maxSlippageBps: 50 } });
    expect(e.reason).toBe('slippage-too-high');
  });

  it('rejects gas too expensive', () => {
    const e = evaluateOpportunity(opp(500, 3), { ...baseCtx, cfg: { ...baseCtx.cfg, maxGasWei: 2e11, maxSlippageBps: 1000 } });
    expect(e.reason).toBe('gas-too-expensive');
  });
});
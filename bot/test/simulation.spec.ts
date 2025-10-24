import { describe, it, expect } from 'vitest';
import { simulateOpportunity } from '../src/simulation/engine';
import type { EvaluationContext } from '../src/evaluation/types';
import type { Opportunity } from '../src/discovery/types';

class FakeProvider {
  async estimateGas(): Promise<bigint> {
    return 150000n;
  }
  async call(): Promise<string> {
    return '0x';
  }
}

const baseCtx: EvaluationContext = {
  cfg: {
    network: 'local',
    rpcUrl: 'http://localhost:8545',
    relayUrl: 'http://localhost:8080',
    minNetProfitWei: 1,
    maxSlippageBps: 50,
    deadlineSeconds: 30,
    scanIntervalMs: 1000,
    maxGasWei: 2e11,
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

describe('simulation engine', () => {
  it('simulation succeeded with positive profit', async () => {
    const res = await simulateOpportunity(opp(50, 2), baseCtx, new FakeProvider() as any);
    expect(res.ok).toBe(true);
    expect(res.netProfitWei > 0n).toBe(true);
  });
  it('simulation failed with revert reason', async () => {
    const ctx = { ...baseCtx, cfg: { ...baseCtx.cfg, deadlineSeconds: 0 } };
    const res = await simulateOpportunity(opp(10, 2), ctx, new FakeProvider() as any);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('deadline-expired');
  });
});
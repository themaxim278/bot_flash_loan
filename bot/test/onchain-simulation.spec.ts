import { describe, it, expect, vi } from 'vitest';
import { simulateOnChain } from '../src/simulation/simulate';
import type { EvaluationContext } from '../src/evaluation/types';
import type { Opportunity } from '../src/discovery/types';

// Mock ethers to control Contract behavior
vi.mock('ethers', () => ({
  AbiCoder: {
    defaultAbiCoder: () => ({
      encode: vi.fn(() => '0xdeadbeef'),
    }),
  },
  Contract: vi.fn(() => ({
    executeOperation: {
      estimateGas: vi.fn().mockResolvedValue(200000n),
      staticCall: vi.fn().mockResolvedValue(true),
    },
    interface: {
      encodeFunctionData: vi.fn(() => '0xcall'),
    },
  })),
}));

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

describe('on-chain simulation', () => {
  it('simulazione riuscita → simulated=true, profit>0', async () => {
    const res = await simulateOnChain(opp(28, 2), baseCtx, {} as any, '0x0000000000000000000000000000000000001234');
    expect(res.simulated).toBe(true);
    expect(res.ok).toBe(true);
    expect(res.netProfitWei > 0n).toBe(true);
  });

  it('simulazione fallita → revertReason valorizzata', async () => {
    // Override Contract to simulate revert on staticCall
    const { Contract } = await import('ethers');
    (Contract as any).mockImplementation(() => ({
      executeOperation: {
        estimateGas: vi.fn().mockResolvedValue(200000n),
        staticCall: vi.fn().mockRejectedValue(Object.assign(new Error('min-amount-out'), { reason: 'min-amount-out' })),
      },
      interface: {
        encodeFunctionData: vi.fn(() => '0xcall'),
      },
    }));

    const res = await simulateOnChain(opp(10, 2), baseCtx, {} as any, '0x0000000000000000000000000000000000001234');
    expect(res.simulated).toBe(true);
    expect(res.ok).toBe(false);
    expect(res.revertReason).toBeDefined();
  });
});
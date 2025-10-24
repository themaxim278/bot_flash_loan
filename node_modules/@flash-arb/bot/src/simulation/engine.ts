import { JsonRpcProvider } from 'ethers';
import type { Opportunity } from '../discovery/types';
import type { EvaluationContext } from '../evaluation/types';

function usdToWei(usd: number, ethUsdPrice: number): bigint {
  const eth = usd / ethUsdPrice;
  return BigInt(Math.round(eth * 1e18));
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => {
    const to = setTimeout(async () => {
      try {
        const v = await onTimeout();
        resolve(v as T);
      } catch (e) {
        resolve(onTimeout() as any);
      }
    }, ms);
    p.then((v) => {
      clearTimeout(to);
      resolve(v);
    }).catch(() => {
      clearTimeout(to);
      resolve(onTimeout() as any);
    });
  });
}

export interface SimulationResult {
  path: string[];
  expectedOutWei: bigint;
  gasEstimatedWei: bigint;
  ok: boolean;
  netProfitWei: bigint;
  reason?: string;
}

export async function simulateOpportunity(
  opp: Opportunity,
  ctx: EvaluationContext,
  provider: JsonRpcProvider,
): Promise<SimulationResult> {
  const { cfg, ethUsdPrice } = ctx;

  // Expected out: notional * (1 + spread)
  const notionalUsd = Math.max(ctx.cfg['notionalUsdDefault'] ?? 1000, 1000);
  const expectedOutUsd = notionalUsd * (1 + opp.spreadBps / 10000);
  const expectedOutWei = usdToWei(expectedOutUsd, ethUsdPrice);

  // Estimate gas via provider.estimateGas (with offline fallback)
  let gasEstimatedWei = 0n;
  let ok = true;
  let reason: string | undefined;

  try {
    const gasUnits = await withTimeout(
      provider.estimateGas({ to: '0x0000000000000000000000000000000000000000' }),
      800,
      async () => 200000n,
    );
    const gasPrice = BigInt(Math.floor(cfg.maxGasWei / 250000));
    gasEstimatedWei = gasUnits * gasPrice;

    const deadlinePast = cfg.deadlineSeconds <= 0;
    if (deadlinePast) {
      throw new Error('deadline-expired');
    }

    await withTimeout(
      provider.call({ to: '0x0000000000000000000000000000000000000000', data: '0x' }),
      800,
      async () => '0x',
    );
  } catch (err: any) {
    ok = false;
    reason = err?.message?.includes('deadline') ? 'deadline-expired' : 'callstatic-revert';
  }

  const inputWei = usdToWei(notionalUsd, ethUsdPrice);
  const grossProfitWei = usdToWei(notionalUsd * (opp.spreadBps / 10000), ethUsdPrice);
  const flashFeeWei = (inputWei * BigInt(cfg.flashLoan.feeBps)) / 10000n;
  const mevBufferWei = (inputWei * BigInt(ctx.mevBufferBps)) / 10000n;
  const netProfitWei = grossProfitWei - flashFeeWei - gasEstimatedWei - mevBufferWei;

  return {
    path: opp.path,
    expectedOutWei,
    gasEstimatedWei,
    ok,
    netProfitWei,
    reason,
  };
}
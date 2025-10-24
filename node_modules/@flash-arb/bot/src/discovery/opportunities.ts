import { Opportunity, Pool } from './types';

function round(n: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function generateTwoHop(pools: Pool[]): Opportunity[] {
  const opps: Opportunity[] = [];
  // Try paths: WETH -> USDC -> DAI and reverse
  for (const a of pools) {
    for (const b of pools) {
      if (a === b) continue;
      // chain token1 of a to token0 of b
      if (a.token1.symbol === b.token0.symbol) {
        const p1 = a.price0to1; // token0 -> token1
        const p2 = b.price0to1; // token0 -> token1 for b
        // net: token0(a) -> token1(a)=token0(b) -> token1(b)
        const eff = p1 * p2;
        const ref = 3500; // reference price baseline for WETH->USD
        const spread = (eff - ref) / ref; // relative deviation
        const spreadBps = Math.floor(spread * 10000);
        const minLiq = Math.min(a.liquidityUsd, b.liquidityUsd);
        opps.push({
          path: [a.token0.symbol, a.token1.symbol, b.token1.symbol],
          hops: 2,
          spreadBps,
          minLiquidityUsd: round(minLiq),
        });
      }
    }
  }
  return opps.sort((x, y) => y.spreadBps - x.spreadBps);
}

export function generateThreeHop(pools: Pool[]): Opportunity[] {
  const opps: Opportunity[] = [];
  for (const a of pools) {
    for (const b of pools) {
      for (const c of pools) {
        if (a === b || b === c || a === c) continue;
        if (a.token1.symbol === b.token0.symbol && b.token1.symbol === c.token0.symbol) {
          const eff = a.price0to1 * b.price0to1 * c.price0to1;
          const ref = 3500; // baseline
          const spread = (eff - ref) / ref;
          const spreadBps = Math.floor(spread * 10000);
          const minLiq = Math.min(a.liquidityUsd, b.liquidityUsd, c.liquidityUsd);
          opps.push({
            path: [a.token0.symbol, a.token1.symbol, b.token1.symbol, c.token1.symbol],
            hops: 3,
            spreadBps,
            minLiquidityUsd: round(minLiq),
          });
        }
      }
    }
  }
  return opps.sort((x, y) => y.spreadBps - x.spreadBps);
}
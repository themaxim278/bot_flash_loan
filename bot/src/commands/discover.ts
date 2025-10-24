import { loadConfig } from '../config';
import { fetchMockPools } from '../discovery/mockDex';
import { generateTwoHop, generateThreeHop } from '../discovery/opportunities';

export async function discover() {
  const cfg = loadConfig();

  const pools = fetchMockPools();
  const twoHop = generateTwoHop(pools).filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);
  const threeHop = generateThreeHop(pools).filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);

  const top2 = twoHop.slice(0, 5);
  const top3 = threeHop.slice(0, 5);

  console.log('[discover] network=', cfg.network, 'dexes=', cfg.dexes.join(','));
  console.log('  thresholds: minLiquidityUsd=', cfg.minLiquidityUsd, 'maxSlippageBps=', cfg.maxSlippageBps);

  console.log('\nTop 2-hop opportunities:');
  for (const o of top2) {
    console.log(` - path=${o.path.join(' -> ')} hops=${o.hops} spreadBps=${o.spreadBps} minLiqUsd=${o.minLiquidityUsd}`);
  }

  console.log('\nTop 3-hop opportunities:');
  for (const o of top3) {
    console.log(` - path=${o.path.join(' -> ')} hops=${o.hops} spreadBps=${o.spreadBps} minLiqUsd=${o.minLiquidityUsd}`);
  }
}
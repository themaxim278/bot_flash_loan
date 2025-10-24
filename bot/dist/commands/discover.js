"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discover = discover;
const config_1 = require("../config");
const mockDex_1 = require("../discovery/mockDex");
const opportunities_1 = require("../discovery/opportunities");
async function discover() {
    const cfg = (0, config_1.loadConfig)();
    const pools = (0, mockDex_1.fetchMockPools)();
    const twoHop = (0, opportunities_1.generateTwoHop)(pools).filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);
    const threeHop = (0, opportunities_1.generateThreeHop)(pools).filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);
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
//# sourceMappingURL=discover.js.map
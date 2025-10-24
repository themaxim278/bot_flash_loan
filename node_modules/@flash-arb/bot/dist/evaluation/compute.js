"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseNotionalUsd = chooseNotionalUsd;
exports.evaluateOpportunity = evaluateOpportunity;
const BASE_UNITS = 250000; // baseline used to derive per-unit price so that est gas <= cap
function estimateGasUnits(hops) {
    const base = 50000; // overhead
    const perHop = 70000; // rough per hop cost
    return base + hops * perHop;
}
function usdToWei(usd, ethUsdPrice) {
    const eth = usd / ethUsdPrice; // ETH amount
    return Math.round(eth * 1e18);
}
function chooseNotionalUsd(opp, ctx) {
    const cap = 50000; // avoid unrealistically large size in demo
    const size = Math.max(1000, Math.floor(opp.minLiquidityUsd * 0.05)); // 5% of path liquidity
    return Math.min(size, cap);
}
function evaluateOpportunity(opp, ctx) {
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
    let reason;
    if (opp.minLiquidityUsd < cfg.minLiquidityUsd) {
        reason = 'low-liquidity';
    }
    else if (Math.abs(opp.spreadBps) > cfg.maxSlippageBps) {
        // Treat absolute spread as a proxy for slippage risk in demo
        reason = 'slippage-too-high';
    }
    else if (netProfitWei <= 0) {
        reason = 'negative-profit';
    }
    else if (netProfitWei < cfg.minNetProfitWei) {
        reason = 'below-min-profit';
    }
    else if (gasWei > cfg.maxGasWei) {
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
//# sourceMappingURL=compute.js.map
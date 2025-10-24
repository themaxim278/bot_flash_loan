"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateOpportunity = simulateOpportunity;
function usdToWei(usd, ethUsdPrice) {
    const eth = usd / ethUsdPrice;
    return BigInt(Math.round(eth * 1e18));
}
function withTimeout(p, ms, onTimeout) {
    return new Promise((resolve) => {
        const to = setTimeout(async () => {
            try {
                const v = await onTimeout();
                resolve(v);
            }
            catch (e) {
                resolve(onTimeout());
            }
        }, ms);
        p.then((v) => {
            clearTimeout(to);
            resolve(v);
        }).catch(() => {
            clearTimeout(to);
            resolve(onTimeout());
        });
    });
}
async function simulateOpportunity(opp, ctx, provider) {
    const { cfg, ethUsdPrice } = ctx;
    // Expected out: notional * (1 + spread)
    const notionalUsd = Math.max(ctx.cfg['notionalUsdDefault'] ?? 1000, 1000);
    const expectedOutUsd = notionalUsd * (1 + opp.spreadBps / 10000);
    const expectedOutWei = usdToWei(expectedOutUsd, ethUsdPrice);
    // Estimate gas via provider.estimateGas (with offline fallback)
    let gasEstimatedWei = 0n;
    let ok = true;
    let reason;
    try {
        const gasUnits = await withTimeout(provider.estimateGas({ to: '0x0000000000000000000000000000000000000000' }), 800, async () => 200000n);
        const gasPrice = BigInt(Math.floor(cfg.maxGasWei / 250000));
        gasEstimatedWei = gasUnits * gasPrice;
        const deadlinePast = cfg.deadlineSeconds <= 0;
        if (deadlinePast) {
            throw new Error('deadline-expired');
        }
        await withTimeout(provider.call({ to: '0x0000000000000000000000000000000000000000', data: '0x' }), 800, async () => '0x');
    }
    catch (err) {
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
//# sourceMappingURL=engine.js.map
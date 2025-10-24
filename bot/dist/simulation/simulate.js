"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateOnChain = simulateOnChain;
const ethers_1 = require("ethers");
function usdToWei(usd, ethUsdPrice) {
    const eth = usd / ethUsdPrice;
    return BigInt(Math.round(eth * 1e18));
}
function parseRevertReason(err) {
    const msg = err?.reason || err?.shortMessage || err?.message;
    if (typeof msg === 'string')
        return msg;
    const data = err?.data;
    if (typeof data === 'string')
        return data;
    return undefined;
}
async function simulateOnChain(opp, ctx, provider, executorAddress) {
    const { cfg, ethUsdPrice } = ctx;
    const notionalUsd = Math.max(ctx.cfg['notionalUsdDefault'] ?? 1000, 1000);
    const inputWei = usdToWei(notionalUsd, ethUsdPrice);
    const expectedOutUsd = notionalUsd * (1 + opp.spreadBps / 10000);
    const expectedOutWei = usdToWei(expectedOutUsd, ethUsdPrice);
    const flashFeeWei = (inputWei * BigInt(cfg.flashLoan.feeBps)) / 10000n;
    const mevBufferWei = (inputWei * BigInt(ctx.mevBufferBps)) / 10000n;
    const gp = {
        deadline: BigInt(Math.floor(Date.now() / 1000) + cfg.deadlineSeconds),
        minAmountOut: expectedOutWei - (expectedOutWei * BigInt(cfg.maxSlippageBps)) / 10000n,
        slippageBpsMax: BigInt(cfg.maxSlippageBps),
    };
    const assets = ['0x0000000000000000000000000000000000000000'];
    const amounts = [inputWei];
    const premiums = [flashFeeWei];
    const initiator = '0x000000000000000000000000000000000000beEf';
    // Encode params (GuardParams, expectedOut)
    const coder = ethers_1.AbiCoder.defaultAbiCoder();
    const params = coder.encode(['tuple(uint256 deadline,uint256 minAmountOut,uint256 slippageBpsMax)', 'uint256'], [[gp.deadline, gp.minAmountOut, gp.slippageBpsMax], expectedOutWei]);
    let gasEstimatedWei = 0n;
    let ok = true;
    let revertReason;
    try {
        if (!executorAddress)
            throw new Error('missing-executor-address');
        const abi = [
            'function executeOperation(address[] assets,uint256[] amounts,uint256[] premiums,address initiator,bytes params) returns (bool)'
        ];
        const contract = new ethers_1.Contract(executorAddress, abi, provider);
        // Estimate gas units and gas price -> gas cost in wei
        const gasUnits = await contract.executeOperation.estimateGas(assets, amounts, premiums, initiator, params);
        const gasPrice = BigInt(Math.floor(cfg.maxGasWei / 250000));
        gasEstimatedWei = BigInt(gasUnits.toString()) * gasPrice;
        // Static call to check for revert
        await contract.executeOperation.staticCall(assets, amounts, premiums, initiator, params);
    }
    catch (err) {
        ok = false;
        revertReason = parseRevertReason(err) || 'callstatic-revert';
        // Fallback gas cost
        const gasUnitsFallback = 200000n;
        const gasPrice = BigInt(Math.floor(cfg.maxGasWei / 250000));
        gasEstimatedWei = gasUnitsFallback * gasPrice;
    }
    const grossProfitWei = usdToWei(notionalUsd * (opp.spreadBps / 10000), ethUsdPrice);
    const netProfitWei = grossProfitWei - premiums[0] - gasEstimatedWei - mevBufferWei;
    return {
        path: opp.path,
        expectedOutWei,
        gasEstimatedWei,
        netProfitWei,
        ok,
        simulated: true,
        revertReason,
    };
}
//# sourceMappingURL=simulate.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeOpportunity = executeOpportunity;
const ethers_1 = require("ethers");
const metrics_1 = require("./metrics");
/**
 * Calculates EIP-1559 gas pricing based on current network conditions
 */
async function calculateEIP1559Pricing(provider) {
    try {
        // Get current base fee and priority fee
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            // Use network suggested fees with 10% buffer
            const maxFeePerGas = (feeData.maxFeePerGas * 110n) / 100n;
            const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 110n) / 100n;
            return { maxFeePerGas, maxPriorityFeePerGas };
        }
        // Fallback: use gasPrice as maxFeePerGas
        const gasPrice = feeData.gasPrice || (0, ethers_1.parseUnits)('20', 'gwei');
        return {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: (0, ethers_1.parseUnits)('2', 'gwei'), // 2 gwei priority
        };
    }
    catch (error) {
        console.warn('Failed to get EIP-1559 pricing, using fallback:', error);
        return {
            maxFeePerGas: (0, ethers_1.parseUnits)('30', 'gwei'),
            maxPriorityFeePerGas: (0, ethers_1.parseUnits)('2', 'gwei'),
        };
    }
}
/**
 * Sends transaction via private relay if configured, otherwise uses direct submission
 */
async function sendTransaction(signedTx, relayUrl, provider) {
    if (relayUrl && relayUrl !== '') {
        try {
            // Try private relay first (Flashbots-style)
            const response = await fetch(relayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_sendRawTransaction',
                    params: [signedTx],
                    id: 1,
                }),
            });
            const result = await response.json();
            if (result.result) {
                return { txHash: result.result, relayUsed: true };
            }
            console.warn('Relay failed, falling back to direct submission:', result.error);
        }
        catch (error) {
            console.warn('Relay error, falling back to direct submission:', error);
        }
    }
    // Fallback to direct submission
    if (!provider)
        throw new Error('No provider available for direct submission');
    const txHash = await provider.send('eth_sendRawTransaction', [signedTx]);
    return { txHash, relayUsed: false };
}
/**
 * Executes an arbitrage opportunity with safety guards and MEV protection
 */
async function executeOpportunity(opportunity, simulationResult, ctx, provider, options = {}) {
    const { cfg } = ctx;
    const { dryRun = false, privateKey } = options;
    // Safety guard: Only execute on Sepolia
    if (cfg.network !== 'sepolia') {
        const result = {
            profitExpected: simulationResult.netProfitWei,
            relayUsed: false,
            status: 'blocked',
            revertReason: 'network-not-sepolia',
        };
        (0, metrics_1.recordExecutionResult)('blocked', undefined, simulationResult.netProfitWei, result.revertReason);
        return result;
    }
    // Safety guard: Check minimum profit
    if (simulationResult.netProfitWei <= BigInt(cfg.minNetProfitWei)) {
        const result = {
            profitExpected: simulationResult.netProfitWei,
            relayUsed: false,
            status: 'blocked',
            revertReason: 'profit-below-minimum',
        };
        (0, metrics_1.recordExecutionResult)('blocked', undefined, simulationResult.netProfitWei, result.revertReason);
        return result;
    }
    // Safety guard: Check simulation success
    if (!simulationResult.ok) {
        const result = {
            profitExpected: simulationResult.netProfitWei,
            relayUsed: false,
            status: 'blocked',
            revertReason: simulationResult.revertReason || 'simulation-failed',
        };
        (0, metrics_1.recordExecutionResult)('blocked', undefined, simulationResult.netProfitWei, result.revertReason);
        return result;
    }
    // Safety guard: Check executor address
    if (!cfg.executorAddress) {
        const result = {
            profitExpected: simulationResult.netProfitWei,
            relayUsed: false,
            status: 'blocked',
            revertReason: 'missing-executor-address',
        };
        (0, metrics_1.recordExecutionResult)('blocked', undefined, simulationResult.netProfitWei, result.revertReason);
        return result;
    }
    try {
        // Prepare transaction parameters
        const notionalUsd = Math.max(cfg['notionalUsdDefault'] ?? 1000, 1000);
        const inputWei = (BigInt(Math.round(notionalUsd * 1e18)) * BigInt(1e18)) / BigInt(Math.round(ctx.ethUsdPrice * 1e18));
        const flashFeeWei = (inputWei * BigInt(cfg.flashLoan.feeBps)) / 10000n;
        const gp = {
            deadline: BigInt(Math.floor(Date.now() / 1000) + cfg.deadlineSeconds),
            minAmountOut: simulationResult.expectedOutWei - (simulationResult.expectedOutWei * BigInt(cfg.maxSlippageBps)) / 10000n,
            slippageBpsMax: BigInt(cfg.maxSlippageBps),
        };
        const assets = ['0x0000000000000000000000000000000000000000'];
        const amounts = [inputWei];
        const premiums = [flashFeeWei];
        const initiator = '0x000000000000000000000000000000000000beEf';
        // Encode params
        const coder = ethers_1.AbiCoder.defaultAbiCoder();
        const params = coder.encode(['tuple(uint256 deadline,uint256 minAmountOut,uint256 slippageBpsMax)', 'uint256'], [[gp.deadline, gp.minAmountOut, gp.slippageBpsMax], simulationResult.expectedOutWei]);
        // Prepare contract call
        const abi = [
            'function executeOperation(address[] assets,uint256[] amounts,uint256[] premiums,address initiator,bytes params) returns (bool)'
        ];
        const contract = new ethers_1.Contract(cfg.executorAddress, abi, provider);
        // Estimate gas
        const gasLimit = await contract.executeOperation.estimateGas(assets, amounts, premiums, initiator, params);
        const gasLimitWithBuffer = (gasLimit * 120n) / 100n; // 20% buffer
        // Calculate EIP-1559 pricing
        const { maxFeePerGas, maxPriorityFeePerGas } = await calculateEIP1559Pricing(provider);
        // Safety guard: Check max gas cost
        const maxGasCostWei = gasLimitWithBuffer * maxFeePerGas;
        if (!dryRun && maxGasCostWei > BigInt(cfg.maxGasWei)) {
            const result = {
                profitExpected: simulationResult.netProfitWei,
                relayUsed: false,
                status: 'blocked',
                revertReason: 'gas-cost-too-high',
            };
            (0, metrics_1.recordExecutionResult)('blocked', undefined, simulationResult.netProfitWei, result.revertReason);
            return result;
        }
        // Prepare transaction data
        const txData = {
            to: cfg.executorAddress,
            data: contract.interface.encodeFunctionData('executeOperation', [assets, amounts, premiums, initiator, params]),
            value: '0',
            gasLimit: gasLimitWithBuffer.toString(),
            maxFeePerGas: maxFeePerGas.toString(),
            maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        };
        // Dry run mode - return transaction details without sending
        if (dryRun) {
            const result = {
                profitExpected: simulationResult.netProfitWei,
                relayUsed: false,
                status: 'dry-run',
                txData,
            };
            // Note: We don't record metrics for dry-run as it's not a real execution
            return result;
        }
        // Real execution - need private key
        if (!privateKey) {
            const result = {
                profitExpected: simulationResult.netProfitWei,
                relayUsed: false,
                status: 'blocked',
                revertReason: 'missing-private-key',
            };
            (0, metrics_1.recordExecutionResult)('blocked', undefined, simulationResult.netProfitWei, result.revertReason);
            return result;
        }
        // Create wallet and sign transaction
        const wallet = new ethers_1.Wallet(privateKey, provider);
        const nonce = await wallet.getNonce();
        const tx = {
            to: txData.to,
            data: txData.data,
            value: 0,
            gasLimit: BigInt(txData.gasLimit),
            maxFeePerGas: BigInt(txData.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(txData.maxPriorityFeePerGas),
            nonce,
            type: 2, // EIP-1559
        };
        const signedTx = await wallet.signTransaction(tx);
        // Send transaction
        const { txHash, relayUsed } = await sendTransaction(signedTx, cfg.relayUrl, provider);
        // Wait for transaction receipt
        const receipt = await provider.waitForTransaction(txHash, 1, 30000); // 30s timeout
        if (!receipt) {
            const result = {
                txHash,
                profitExpected: simulationResult.netProfitWei,
                relayUsed,
                status: 'reverted',
                revertReason: 'transaction-timeout',
            };
            (0, metrics_1.recordExecutionResult)('reverted', undefined, simulationResult.netProfitWei, result.revertReason);
            return result;
        }
        const success = receipt.status === 1;
        const result = {
            txHash,
            gasUsed: receipt.gasUsed,
            profitExpected: simulationResult.netProfitWei,
            relayUsed,
            status: success ? 'success' : 'reverted',
            revertReason: success ? undefined : 'transaction-reverted',
            txData,
        };
        // Record metrics
        if (success) {
            (0, metrics_1.recordExecutionResult)('success', receipt.gasUsed, simulationResult.netProfitWei);
        }
        else {
            (0, metrics_1.recordExecutionResult)('reverted', receipt.gasUsed, simulationResult.netProfitWei, result.revertReason);
        }
        return result;
    }
    catch (error) {
        console.error('Execution error:', error);
        const result = {
            profitExpected: simulationResult.netProfitWei,
            relayUsed: false,
            status: 'reverted',
            revertReason: error.message || 'execution-error',
        };
        (0, metrics_1.recordExecutionResult)('reverted', undefined, simulationResult.netProfitWei, result.revertReason);
        return result;
    }
}
//# sourceMappingURL=execute.js.map
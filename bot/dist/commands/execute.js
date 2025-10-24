"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = execute;
const dotenv_1 = __importDefault(require("dotenv"));
const ethers_1 = require("ethers");
const config_1 = require("../config");
const mockDex_1 = require("../discovery/mockDex");
const opportunities_1 = require("../discovery/opportunities");
const evaluation_1 = require("../evaluation");
const simulate_1 = require("../simulation/simulate");
const execute_1 = require("../execution/execute");
const metrics_1 = require("../execution/metrics");
const logger_1 = __importDefault(require("../logger"));
const db_1 = require("../db");
const metrics_2 = require("../metrics");
function toEth(wei) {
    return Number(wei) / 1e18 + '';
}
async function execute() {
    dotenv_1.default.config();
    const args = process.argv.slice(2);
    const jsonOut = args.includes('--json');
    const dryRun = args.includes('--dry-run');
    const disableDb = args.includes('--no-db');
    const disableMetrics = args.includes('--no-metrics');
    const sizeUsdArg = args.find((a) => a.startsWith('--sizeUsd='));
    const sizeUsd = sizeUsdArg ? Number(sizeUsdArg.split('=')[1]) : undefined;
    try {
        const cfg = (0, config_1.loadConfig)();
        const envRpc = (process.env.RPC_URL || '').replace(/[`"']/g, '').trim();
        const envNet = (process.env.NETWORK || '').trim();
        const privateKey = (process.env.PRIVATE_KEY || '').trim();
        const executorAddress = cfg.executorAddress || process.env.EXECUTOR_ADDRESS;
        const rpcUrl = envRpc || cfg.rpcUrl;
        const net = envNet || cfg.network;
        if (!disableMetrics) {
            (0, metrics_2.initMetricsServer)(Number(process.env.METRICS_PORT || 9090));
        }
        if (!disableDb) {
            (0, db_1.initDb)();
        }
        const provider = new ethers_1.JsonRpcProvider(rpcUrl);
        const pools = (0, mockDex_1.fetchMockPools)();
        const candidates = [
            ...(0, opportunities_1.generateTwoHop)(pools),
            ...(0, opportunities_1.generateThreeHop)(pools),
        ].filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);
        const ctx = {
            cfg: { ...cfg, network: net, rpcUrl, notionalUsdDefault: sizeUsd ?? cfg.notionalUsdDefault },
            mevBufferBps: cfg.mevBufferBps ?? 5,
            ethUsdPrice: 3500,
        };
        const evals = candidates.map((o) => (0, evaluation_1.evaluateOpportunity)(o, ctx));
        const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0).slice(0, 1);
        if (accepted.length === 0) {
            const message = 'No profitable opportunities found';
            if (jsonOut) {
                console.log(JSON.stringify({ network: net, status: 'no-opportunities', message }, null, 2));
            }
            else {
                logger_1.default.info(message);
            }
            return;
        }
        const opportunity = accepted[0];
        const simulationResult = await (0, simulate_1.simulateOnChain)(opportunity, ctx, provider, executorAddress);
        if (!simulationResult.ok && !dryRun) {
            const message = `Simulation failed: ${simulationResult.revertReason}`;
            if (jsonOut) {
                console.log(JSON.stringify({
                    network: net,
                    status: 'simulation-failed',
                    revertReason: simulationResult.revertReason,
                    path: opportunity.path.join('->'),
                    message,
                }, null, 2));
            }
            else {
                logger_1.default.error(message);
            }
            return;
        }
        const executionResult = await (0, execute_1.executeOpportunity)(opportunity, simulationResult, ctx, provider, { dryRun, privateKey });
        const logData = {
            network: net,
            path: opportunity.path.join('->'),
            spreadBps: opportunity.spreadBps,
            txHash: executionResult.txHash,
            gasUsed: executionResult.gasUsed?.toString(),
            gasEstimated: simulationResult.gasEstimatedWei.toString(),
            profitExpected: executionResult.profitExpected.toString(),
            profitExpectedEth: toEth(executionResult.profitExpected),
            relayUsed: executionResult.relayUsed,
            status: executionResult.status,
            revertReason: executionResult.revertReason,
            txData: executionResult.txData,
        };
        if (!disableDb || !disableMetrics) {
            const trade = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: Date.now(),
                path: opportunity.path,
                sizeUsd: Number(ctx.cfg?.notionalUsdDefault) || 0,
                profitWei: executionResult.profitExpected.toString(),
                gasWei: (executionResult.gasUsed ?? simulationResult.gasEstimatedWei).toString(),
                status: executionResult.status,
                revertReason: executionResult.revertReason,
            };
            if (!disableDb)
                (0, db_1.saveTrade)(trade);
            if (!disableMetrics)
                (0, metrics_2.recordTradeMetric)(trade);
        }
        if (jsonOut) {
            console.log(JSON.stringify(logData, null, 2));
        }
        else {
            console.log('\n=== Execution Result ===');
            console.log(`Network: ${net}`);
            console.log(`Path: ${opportunity.path.join(' -> ')}`);
            console.log(`Spread: ${opportunity.spreadBps} bps`);
            console.log(`Status: ${executionResult.status}`);
            if (executionResult.status === 'dry-run') {
                console.log('✅ Dry-run completed successfully');
                console.log(`Expected Profit: ${toEth(executionResult.profitExpected)} ETH`);
                console.log(`Gas Limit: ${executionResult.txData?.gasLimit}`);
                console.log(`Max Fee Per Gas: ${executionResult.txData?.maxFeePerGas} wei`);
                console.log(`Max Priority Fee: ${executionResult.txData?.maxPriorityFeePerGas} wei`);
            }
            else if (executionResult.status === 'success') {
                console.log('✅ Transaction executed successfully');
                console.log(`TX Hash: ${executionResult.txHash}`);
                console.log(`Gas Used: ${executionResult.gasUsed}`);
                console.log(`Profit: ${toEth(executionResult.profitExpected)} ETH`);
                console.log(`Relay Used: ${executionResult.relayUsed ? 'Yes' : 'No'}`);
            }
            else if (executionResult.status === 'blocked') {
                console.log('⚠️ Execution blocked by safety guards');
                console.log(`Reason: ${executionResult.revertReason}`);
            }
            else {
                console.log('❌ Execution failed');
                console.log(`Reason: ${executionResult.revertReason}`);
                if (executionResult.txHash) {
                    console.log(`TX Hash: ${executionResult.txHash}`);
                }
            }
            if (!disableDb)
                console.log('💾 Risultato salvato in bot/db.sqlite');
            if (!disableMetrics)
                console.log('📈 Metrics aggiornate su http://localhost:9090/metrics');
        }
        logger_1.default.info(logData, 'execute-opportunity');
        if (!jsonOut) {
            console.log('\n📊 Execution Metrics:');
            console.log(metrics_1.executionMetrics.getPrometheusMetrics());
        }
    }
    catch (error) {
        const errorData = {
            network: undefined,
            status: 'error',
            error: error.message,
            dryRun: undefined,
        };
        if (jsonOut) {
            console.log(JSON.stringify(errorData, null, 2));
        }
        else {
            logger_1.default.error(error, 'Execution failed');
        }
        process.exit(1);
    }
}
//# sourceMappingURL=execute.js.map
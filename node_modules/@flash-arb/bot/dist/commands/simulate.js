"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulate = simulate;
const dotenv_1 = __importDefault(require("dotenv"));
const ethers_1 = require("ethers");
const config_1 = require("../config");
const mockDex_1 = require("../discovery/mockDex");
const opportunities_1 = require("../discovery/opportunities");
const evaluation_1 = require("../evaluation");
const simulate_1 = require("../simulation/simulate");
const logger_1 = __importDefault(require("../logger"));
const db_1 = require("../db");
const metrics_1 = require("../metrics");
function toEth(wei) {
    return Number(wei) / 1e18 + '';
}
async function simulate() {
    dotenv_1.default.config();
    const cfg = (0, config_1.loadConfig)();
    const args = process.argv.slice(2);
    const jsonOut = args.includes('--json');
    const includeFailure = args.includes('--include-failure');
    const offlineArg = args.includes('--offline');
    const disableDb = args.includes('--no-db');
    const disableMetrics = args.includes('--no-metrics');
    const sizeUsdArg = args.find((a) => a.startsWith('--sizeUsd='));
    const sizeUsd = sizeUsdArg ? Number(sizeUsdArg.split('=')[1]) : undefined;
    const envRpc = (process.env.RPC_URL || '').replace(/[`"']/g, '').trim();
    const envNet = (process.env.NETWORK || '').trim();
    const executorAddress = cfg.executorAddress || process.env.EXECUTOR_ADDRESS;
    const rpcUrl = offlineArg ? cfg.rpcUrl : (envRpc || cfg.rpcUrl);
    const net = envNet || cfg.network;
    const offline = net === 'local' || offlineArg;
    if (!disableMetrics) {
        (0, metrics_1.initMetricsServer)(Number(process.env.METRICS_PORT || 9090));
    }
    if (!disableDb) {
        (0, db_1.initDb)();
    }
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
    const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0).slice(0, 3);
    const provider = offline
        ? {
            getBlock: async () => ({ baseFeePerGas: BigInt('50000000000') }),
        }
        : new ethers_1.JsonRpcProvider(rpcUrl);
    const results = [];
    for (let i = 0; i < accepted.length; i++) {
        const res = await (0, simulate_1.simulateOnChain)(accepted[i], ctx, provider, executorAddress);
        if (res.ok || includeFailure) {
            results.push({
                ok: res.ok,
                path: accepted[i].path,
                expectedOutWei: res.expectedOutWei,
                gasEstimatedWei: res.gasEstimatedWei,
                netProfitWei: res.netProfitWei,
                revertReason: res.revertReason,
            });
            if (!disableDb || !disableMetrics) {
                const trade = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    timestamp: Date.now(),
                    path: accepted[i].path,
                    sizeUsd: Number(ctx.cfg?.notionalUsdDefault) || 0,
                    profitWei: res.netProfitWei.toString(),
                    gasWei: res.gasEstimatedWei.toString(),
                    status: res.ok ? 'simulated' : 'reverted',
                    revertReason: res.revertReason,
                };
                if (!disableDb)
                    (0, db_1.saveTrade)(trade);
                if (!disableMetrics)
                    (0, metrics_1.recordTradeMetric)(trade);
            }
        }
    }
    logger_1.default.info({ network: net }, 'simulate start');
    if (!jsonOut) {
        console.log('\nSimulazioni:');
    }
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const e = accepted[i] || accepted[0];
        const status = r.ok ? 'ok' : `revert(${r.revertReason})`;
        if (!jsonOut) {
            console.log(` - path=${r.path.join(' -> ')} spreadBps=${e?.spreadBps} expectedOutWei=${r.expectedOutWei} gasEstimatedWei=${r.gasEstimatedWei} profitNetWei=${r.netProfitWei} (~${toEth(r.netProfitWei)} ETH) esito=${status}`);
        }
    }
    if (!jsonOut) {
        console.log('\n✅ Simulazione completata');
        if (!disableDb)
            console.log('💾 Risultato salvato in bot/db.sqlite');
        if (!disableMetrics)
            console.log('📈 Metrics aggiornate su http://localhost:9090/metrics');
    }
}
//# sourceMappingURL=simulate.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluate = evaluate;
const config_1 = require("../config");
const mockDex_1 = require("../discovery/mockDex");
const opportunities_1 = require("../discovery/opportunities");
const evaluation_1 = require("../evaluation");
const logger_1 = __importDefault(require("../logger"));
const db_1 = require("../db");
const metrics_1 = require("../metrics");
function toEth(wei) {
    return wei / 1e18 + '';
}
async function evaluate() {
    const cfg = (0, config_1.loadConfig)();
    const args = process.argv.slice(2);
    const jsonOut = args.includes('--json');
    const disableDb = args.includes('--no-db');
    const disableMetrics = args.includes('--no-metrics');
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
        cfg,
        mevBufferBps: 5,
        ethUsdPrice: 3500,
    };
    const evals = candidates.map((o) => (0, evaluation_1.evaluateOpportunity)(o, ctx));
    const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0);
    const rejected = evals.filter((e) => e.reason);
    const topAccepted = accepted.sort((a, b) => b.netProfitWei - a.netProfitWei).slice(0, 3);
    if (!disableDb || !disableMetrics) {
        for (const e of topAccepted) {
            const trade = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: Date.now(),
                path: e.path,
                sizeUsd: Number(ctx.cfg?.notionalUsdDefault) || (e.notionalUsd || 0),
                profitWei: e.netProfitWei.toString(),
                gasWei: e.gasWei.toString(),
                status: 'evaluated',
                revertReason: undefined,
            };
            if (!disableDb)
                (0, db_1.saveTrade)(trade);
            if (!disableMetrics)
                (0, metrics_1.recordTradeMetric)(trade);
        }
    }
    if (jsonOut) {
        const output = topAccepted.map((e) => ({
            path: e.path,
            spreadBps: e.spreadBps,
            gasEstimatedWei: e.gasWei,
            netProfitWei: e.netProfitWei,
            notionalUsd: e.notionalUsd,
        }));
        console.log(JSON.stringify({ network: cfg.network, opportunities: output }, null, 2));
        return;
    }
    logger_1.default.info({ network: cfg.network, dexes: cfg.dexes }, 'evaluation start');
    logger_1.default.info({
        thresholds: {
            minNetProfitWei: cfg.minNetProfitWei,
            maxSlippageBps: cfg.maxSlippageBps,
            maxGasWei: cfg.maxGasWei,
            minLiquidityUsd: cfg.minLiquidityUsd,
            deadlineSeconds: cfg.deadlineSeconds,
            mevBufferBps: ctx.mevBufferBps,
        },
    }, 'limits applied');
    console.log('\nOpportunità accettate (top 3):');
    for (const e of topAccepted) {
        console.log(` - path=${e.path.join(' -> ')} spreadBps=${e.spreadBps} gasWei=${e.gasWei} netProfitWei=${e.netProfitWei} (~${toEth(e.netProfitWei)} ETH)`);
    }
    console.log('\nEsempi di opportunità scartate:');
    for (const r of rejected.slice(0, 3)) {
        console.log(` - path=${r.path.join(' -> ')} spreadBps=${r.spreadBps} gasWei=${r.gasWei} netProfitWei=${r.netProfitWei} (~${toEth(r.netProfitWei)} ETH) reason=${r.reason}`);
    }
}
//# sourceMappingURL=evaluate.js.map
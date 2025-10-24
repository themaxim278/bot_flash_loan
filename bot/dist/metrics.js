"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRegister = void 0;
exports.initMetricsServer = initMetricsServer;
exports.recordTradeMetric = recordTradeMetric;
exports.updateSummaryMetrics = updateSummaryMetrics;
const http_1 = __importDefault(require("http"));
const prom_client_1 = require("prom-client");
const db_1 = require("./db");
const logger_1 = __importDefault(require("./logger"));
const register = new prom_client_1.Registry();
(0, prom_client_1.collectDefaultMetrics)({ register });
const arbOpportunitiesTotal = new prom_client_1.Counter({
    name: 'arb_opportunities_total',
    help: 'Total opportunità valutate/simulate',
    registers: [register],
});
const arbExecutedTotal = new prom_client_1.Counter({
    name: 'arb_executed_total',
    help: 'Total esecuzioni',
    registers: [register],
});
const arbRevertedTotal = new prom_client_1.Counter({
    name: 'arb_reverted_total',
    help: 'Total revert',
    registers: [register],
});
const arbProfitTotalWei = new prom_client_1.Gauge({
    name: 'arb_profit_total_wei',
    help: 'Profitto totale (wei)',
    registers: [register],
});
const gasUsedTotalWei = new prom_client_1.Gauge({
    name: 'gas_used_total_wei',
    help: 'Gas totale stimato/usato (wei)',
    registers: [register],
});
function initMetricsServer(port) {
    const p = port ?? Number(process.env.METRICS_PORT || 9090);
    const server = http_1.default.createServer(async (req, res) => {
        if (req.url === '/metrics') {
            try {
                const metrics = await register.metrics();
                res.writeHead(200, { 'Content-Type': register.contentType });
                res.end(metrics);
            }
            catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`# metrics error: ${err?.message || 'unknown'}`);
            }
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });
    server.listen(p, () => logger_1.default.info({ port: p }, 'metrics server started'));
    return server;
}
function recordTradeMetric(trade) {
    // opportunities counted for evaluate and simulate
    if (trade.status === 'evaluated' || trade.status === 'simulated') {
        arbOpportunitiesTotal.inc(1);
    }
    if (trade.status === 'success' || trade.status === 'dry-run') {
        arbExecutedTotal.inc(1);
    }
    if (trade.status === 'reverted' || trade.status === 'blocked') {
        arbRevertedTotal.inc(1);
    }
    const profit = Number(trade.profitWei || '0');
    const gas = Number(trade.gasWei || '0');
    if (!Number.isNaN(profit))
        arbProfitTotalWei.inc(profit);
    if (!Number.isNaN(gas))
        gasUsedTotalWei.inc(gas);
}
function updateSummaryMetrics() {
    const summary = (0, db_1.getMetricsSummary)();
    // If DB has totals, update gauges (profit/gas)
    if (typeof summary['arb_profit_total_wei'] === 'number') {
        arbProfitTotalWei.set(summary['arb_profit_total_wei']);
    }
    if (typeof summary['gas_used_total_wei'] === 'number') {
        gasUsedTotalWei.set(summary['gas_used_total_wei']);
    }
}
exports.metricsRegister = register;
//# sourceMappingURL=metrics.js.map
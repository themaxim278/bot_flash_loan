import http from 'http';
import client, { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import { TradeRecord, getMetricsSummary } from './db';
import logger from './logger';

const register = new Registry();
collectDefaultMetrics({ register });

const arbOpportunitiesTotal = new Counter({
  name: 'arb_opportunities_total',
  help: 'Total opportunità valutate/simulate',
  registers: [register],
});

const arbExecutedTotal = new Counter({
  name: 'arb_executed_total',
  help: 'Total esecuzioni',
  registers: [register],
});

const arbRevertedTotal = new Counter({
  name: 'arb_reverted_total',
  help: 'Total revert',
  registers: [register],
});

const arbProfitTotalWei = new Gauge({
  name: 'arb_profit_total_wei',
  help: 'Profitto totale (wei)',
  registers: [register],
});

const gasUsedTotalWei = new Gauge({
  name: 'gas_used_total_wei',
  help: 'Gas totale stimato/usato (wei)',
  registers: [register],
});

const botPausedTotal = new Counter({
  name: 'bot_paused_total',
  help: 'Conteggio totale pause attivate',
  registers: [register],
});

const botPausedState = new Gauge({
  name: 'bot_paused_state',
  help: 'Stato pausa bot (0/1)',
  registers: [register],
});

export function initMetricsServer(port?: number): http.Server {
  const p = port ?? Number(process.env.METRICS_PORT || 9090);
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        const metrics = await register.metrics();
        res.writeHead(200, { 'Content-Type': register.contentType });
        res.end(metrics);
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`# metrics error: ${err?.message || 'unknown'}`);
      }
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
  server.listen(p, () => logger.info({ port: p }, 'metrics server started'));
  return server;
}

export function recordTradeMetric(trade: TradeRecord): void {
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
  if (!Number.isNaN(profit)) arbProfitTotalWei.inc(profit);
  if (!Number.isNaN(gas)) gasUsedTotalWei.inc(gas);
}

export function updateSummaryMetrics(): void {
  const summary = getMetricsSummary();
  // If DB has totals, update gauges (profit/gas)
  if (typeof summary['arb_profit_total_wei'] === 'number') {
    arbProfitTotalWei.set(summary['arb_profit_total_wei']);
  }
  if (typeof summary['gas_used_total_wei'] === 'number') {
    gasUsedTotalWei.set(summary['gas_used_total_wei']);
  }
}

export function setBotPaused(paused: boolean): void {
  botPausedState.set(paused ? 1 : 0);
  if (paused) botPausedTotal.inc(1);
}

export const metricsRegister = register;
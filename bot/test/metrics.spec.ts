import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { initDb, saveTrade, saveMetric, getMetricsSummary, TradeRecord } from '../src/db';
import { initMetricsServer, recordTradeMetric } from '../src/metrics';

const TEST_DB_PATH = path.join(process.cwd(), 'bot', 'test-db.sqlite');

describe('Observability & Storage', () => {
  beforeAll(() => {
    process.env.DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates DB and writes trades/metrics', () => {
    const db = initDb();
    const trade: TradeRecord = {
      id: 't1',
      timestamp: Date.now(),
      path: ['WETH', 'USDC', 'DAI'],
      sizeUsd: 1000,
      profitWei: '1000000000000000',
      gasWei: '50000000000000',
      status: 'simulated',
    };
    saveTrade(trade);
    saveMetric('arb_profit_total_wei', 1.5e16);
    saveMetric('gas_used_total_wei', 5e13);

    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    const summary = getMetricsSummary();
    expect(summary['arb_profit_total_wei']).toBeGreaterThan(0);
    expect(summary['gas_used_total_wei']).toBeGreaterThan(0);
  });

  it('serves Prometheus metrics over HTTP', async () => {
    const port = 9091;
    const server = initMetricsServer(port);

    // Record one executed trade to increment counters
    recordTradeMetric({
      id: 't2',
      timestamp: Date.now(),
      path: ['A', 'B'],
      sizeUsd: 500,
      profitWei: '2000000000000000',
      gasWei: '30000000000',
      status: 'success',
    });

    const body = await new Promise<string>((resolve, reject) => {
      http.get(`http://localhost:${port}/metrics`, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }).on('error', reject);
    });

    expect(body.includes('arb_executed_total')).toBe(true);
    expect(body.includes('arb_profit_total_wei')).toBe(true);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterAll(() => {
    try { if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH); } catch {}
  });
});
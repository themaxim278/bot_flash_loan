import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { initDb, saveMetric } from '../src/db';
import { initMetricsServer, metricsRegister, setBotPaused } from '../src/metrics';
import { applyPauseIfNeeded, isPaused, unpause, checkSecurityGuards } from '../src/security';
import { JsonRpcProvider, Wallet } from 'ethers';

const TEST_DB_PATH = path.join(process.cwd(), 'bot', 'test-db-security.sqlite');

describe('Security Guards & Metrics', () => {
  let server: http.Server | undefined;

  beforeAll(() => {
    process.env.DB_PATH = TEST_DB_PATH;
    process.env.LOSS_LIMIT_WEI = '5000000000000000';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDb();
    server = initMetricsServer(9092);
  });

  it('pauses when loss exceeds LOSS_LIMIT_WEI and updates metrics', async () => {
    applyPauseIfNeeded({ lossWei: BigInt('7000000000000000'), revert: false, testMode: false });
    expect(isPaused()).toBe(true);

    const body = await new Promise<string>((resolve, reject) => {
      http.get('http://localhost:9092/metrics', (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }).on('error', reject);
    });
    expect(body.includes('bot_paused_state 1')).toBe(true);
  });

  it('unpause resets bot_paused_state to 0', async () => {
    unpause();
    expect(isPaused()).toBe(false);

    const body = await new Promise<string>((resolve, reject) => {
      http.get('http://localhost:9092/metrics', (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }).on('error', reject);
    });
    expect(body.includes('bot_paused_state 0')).toBe(true);
  });

  it('autoPause triggers after 3 consecutive reverts in testMode', () => {
    // reset any prior state
    setBotPaused(false);
    saveMetric('daily_loss_total_wei', 0);

    applyPauseIfNeeded({ revert: true, testMode: true });
    applyPauseIfNeeded({ revert: true, testMode: true });
    applyPauseIfNeeded({ revert: true, testMode: true });

    expect(isPaused()).toBe(true);
  });

  it('checkSecurityGuards logs warning when owner equals executor', async () => {
    const pk = Wallet.createRandom().privateKey;
    const w = new Wallet(pk);
    process.env.PRIVATE_KEY = pk;
    process.env.OWNER_ADDRESS = w.address;
    const provider = new JsonRpcProvider('http://localhost:8545');

    // Should not throw and should produce a warning (not asserted here)
    await checkSecurityGuards(provider);
  });

  afterAll(async () => {
    try { if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); } catch {}
    try { if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH); } catch {}
  });
});
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface TradeRecord {
  id: string;
  timestamp: number;
  path: string[];
  sizeUsd: number;
  profitWei: string; // store as string to avoid bigint issues
  gasWei: string;    // store as string
  status: string;    // evaluated | simulated | success | reverted | blocked | dry-run
  revertReason?: string;
}

let db: Database.Database | null = null;

function getDbPath(): string {
  const p = (process.env.DB_PATH || './bot/db.sqlite').trim();
  // Ensure parent directory exists
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
}

export function initDb(): Database.Database {
  if (db) return db;
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables if not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      timestamp INTEGER,
      path TEXT,
      sizeUsd REAL,
      profitWei TEXT,
      gasWei TEXT,
      status TEXT,
      revertReason TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY,
      name TEXT,
      value REAL,
      timestamp INTEGER
    );
  `);

  return db;
}

function ensureDb(): Database.Database {
  return initDb();
}

export function saveTrade(trade: TradeRecord): void {
  const d = ensureDb();
  const stmt = d.prepare(`
    INSERT INTO trades (id, timestamp, path, sizeUsd, profitWei, gasWei, status, revertReason)
    VALUES (@id, @timestamp, @path, @sizeUsd, @profitWei, @gasWei, @status, @revertReason)
  `);
  const record = {
    ...trade,
    path: Array.isArray(trade.path) ? trade.path.join('->') : String(trade.path || ''),
    revertReason: trade.revertReason ?? null,
  } as any;
  stmt.run(record);
}

export function saveMetric(name: string, value: number): void {
  const d = ensureDb();
  const stmt = d.prepare(`
    INSERT INTO metrics (name, value, timestamp)
    VALUES (?, ?, ?)
  `);
  stmt.run(name, value, Date.now());
}

export function getMetricsSummary(): Record<string, number> {
  const d = ensureDb();
  const stmt = d.prepare(`SELECT name, SUM(value) as total FROM metrics GROUP BY name`);
  const res = stmt.all();
  const out: Record<string, number> = {};
  for (const row of res as any[]) {
    out[row.name] = Number(row.total || 0);
  }
  return out;
}
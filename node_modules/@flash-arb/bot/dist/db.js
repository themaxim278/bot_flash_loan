"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.saveTrade = saveTrade;
exports.saveMetric = saveMetric;
exports.getMetricsSummary = getMetricsSummary;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let db = null;
function getDbPath() {
    const p = (process.env.DB_PATH || './bot/db.sqlite').trim();
    // Ensure parent directory exists
    const dir = path_1.default.dirname(p);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return p;
}
function initDb() {
    if (db)
        return db;
    const dbPath = getDbPath();
    db = new better_sqlite3_1.default(dbPath);
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
function ensureDb() {
    return initDb();
}
function saveTrade(trade) {
    const d = ensureDb();
    const stmt = d.prepare(`
    INSERT INTO trades (id, timestamp, path, sizeUsd, profitWei, gasWei, status, revertReason)
    VALUES (@id, @timestamp, @path, @sizeUsd, @profitWei, @gasWei, @status, @revertReason)
  `);
    const record = {
        ...trade,
        path: Array.isArray(trade.path) ? trade.path.join('->') : String(trade.path || ''),
        revertReason: trade.revertReason ?? null,
    };
    stmt.run(record);
}
function saveMetric(name, value) {
    const d = ensureDb();
    const stmt = d.prepare(`
    INSERT INTO metrics (name, value, timestamp)
    VALUES (?, ?, ?)
  `);
    stmt.run(name, value, Date.now());
}
function getMetricsSummary() {
    const d = ensureDb();
    const stmt = d.prepare(`SELECT name, SUM(value) as total FROM metrics GROUP BY name`);
    const res = stmt.all();
    const out = {};
    for (const row of res) {
        out[row.name] = Number(row.total || 0);
    }
    return out;
}
//# sourceMappingURL=db.js.map
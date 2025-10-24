import Database from 'better-sqlite3';
export interface TradeRecord {
    id: string;
    timestamp: number;
    path: string[];
    sizeUsd: number;
    profitWei: string;
    gasWei: string;
    status: string;
    revertReason?: string;
}
export declare function initDb(): Database.Database;
export declare function saveTrade(trade: TradeRecord): void;
export declare function saveMetric(name: string, value: number): void;
export declare function getMetricsSummary(): Record<string, number>;

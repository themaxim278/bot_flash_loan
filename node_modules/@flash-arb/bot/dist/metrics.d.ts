import http from 'http';
import client from 'prom-client';
import { TradeRecord } from './db';
export declare function initMetricsServer(port?: number): http.Server;
export declare function recordTradeMetric(trade: TradeRecord): void;
export declare function updateSummaryMetrics(): void;
export declare const metricsRegister: client.Registry<"text/plain; version=0.0.4; charset=utf-8">;

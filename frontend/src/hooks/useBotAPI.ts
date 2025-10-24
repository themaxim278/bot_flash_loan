import { toast } from 'react-hot-toast';
import type { BotAPI, SimulationParams, ExecuteParams } from '../services/api';
import * as api from '../services/api';

export const useBotAPI = (): BotAPI & {
  parseMetrics: (text: string) => Record<string, number>;
} => {
  const handleError = (err: any, label: string) => {
    const msg = err?.response?.data?.message || err?.message || 'Errore sconosciuto';
    toast.error(`${label}: ${msg}`);
  };

  const parseMetrics = (text: string) => {
    const result: Record<string, number> = {};
    const lines = text.split(/\n+/);
    for (const line of lines) {
      if (/^#/.test(line) || !line.trim()) continue;
      const parts = line.trim().split(/\s+/);
      const maybeValue = parts[parts.length - 1];
      const name = parts[0].split('{')[0];
      const val = Number(maybeValue);
      if (!Number.isNaN(val)) {
        result[name] = val;
      }
    }
    return result;
  };

  return {
    discover: async () => {
      try {
        return await api.discover();
      } catch (e) {
        handleError(e, 'discover()');
        return [];
      }
    },
    evaluate: async () => {
      try {
        return await api.evaluate();
      } catch (e) {
        handleError(e, 'evaluate()');
        return [];
      }
    },
    simulate: async (params: SimulationParams) => {
      try {
        return await api.simulate(params);
      } catch (e) {
        handleError(e, 'simulate()');
        return null;
      }
    },
    execute: async (params: ExecuteParams) => {
      try {
        return await api.execute(params);
      } catch (e) {
        handleError(e, 'execute()');
        return null;
      }
    },
    fetchMetrics: async () => {
      try {
        return await api.fetchMetrics();
      } catch (e) {
        // Log warning senza stack trace per errore di rete
        console.warn("⚠️ Metrics endpoint unavailable, using mock data");
        
        // Restituisce mock data invece di stringa vuota
        const mockMetrics = {
          arb_executed_total: 0,
          arb_reverted_total: 0,
          arb_profit_total_wei: 0,
          gas_used_total_wei: 0,
          bot_paused_state: 0,
          timestamp: Date.now()
        };
        
        // Converte mock data in formato Prometheus per compatibilità
        return Object.entries(mockMetrics)
          .map(([key, value]) => `${key} ${value}`)
          .join('\n');
      }
    },
    fetchHistory: async () => {
      try {
        return await api.fetchHistory();
      } catch (e) {
        handleError(e, 'fetchHistory()');
        return [];
      }
    },
    parseMetrics,
  };
};
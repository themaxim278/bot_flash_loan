import axios from 'axios';
import type { AxiosInstance } from 'axios';

const API_BASE = 'http://localhost:3000';
const METRICS_URL = 'http://localhost:9090/metrics';

export interface SimulationParams {
  minNetProfitWei?: number;
  maxSlippageBps?: number;
  deadlineSeconds?: number;
  dryRun?: boolean;
}

export interface ExecuteParams {
  minNetProfitWei?: number;
  maxSlippageBps?: number;
  deadlineSeconds?: number;
  testnet?: boolean;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
});

// Istanza separata per le metriche con timeout più breve
const metricsApi: AxiosInstance = axios.create({
  timeout: 5_000,
});

export const discover = async () => {
  const { data } = await api.get('/discover');
  return data;
};

export const evaluate = async () => {
  const { data } = await api.get('/evaluate');
  return data;
};

export const simulate = async (params: SimulationParams) => {
  const { data } = await api.post('/simulate', params);
  return data;
};

export const execute = async (params: ExecuteParams) => {
  const { data } = await api.post('/execute', params);
  return data;
};

export const fetchMetrics = async (): Promise<string> => {
  try {
    const { data } = await metricsApi.get(METRICS_URL, { responseType: 'text' });
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch (error) {
    // Rilancia l'errore per essere gestito da useBotAPI
    throw error;
  }
};

export const fetchHistory = async () => {
  const { data } = await api.get('/history');
  return data;
};

export type BotAPI = {
  discover: typeof discover;
  evaluate: typeof evaluate;
  simulate: typeof simulate;
  execute: typeof execute;
  fetchMetrics: typeof fetchMetrics;
  fetchHistory: typeof fetchHistory;
};
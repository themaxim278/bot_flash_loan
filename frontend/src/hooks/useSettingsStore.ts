import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  minNetProfitWei: number;
  maxSlippageBps: number;
  deadlineSeconds: number;
  rpcUrl: string;
  relayUrl: string;
  network: string;
  set: (key: keyof Settings, value: any) => void;
}

const envNum = (key: string, fallback: number) => {
  const v = (import.meta as any)?.env?.[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const envStr = (key: string, fallback: string) => {
  const v = (import.meta as any)?.env?.[key];
  return typeof v === 'string' ? v : fallback;
};

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      minNetProfitWei: envNum('VITE_MIN_NET_PROFIT_WEI', 5_000_000_000_000_000),
      maxSlippageBps: envNum('VITE_MAX_SLIPPAGE_BPS', 30),
      deadlineSeconds: envNum('VITE_DEADLINE_SECONDS', 300),
      rpcUrl: envStr('VITE_RPC_URL', 'http://localhost:8545'),
      relayUrl: envStr('VITE_RELAY_URL', 'http://localhost:3000'),
      network: envStr('VITE_NETWORK', 'sepolia'),
      set: (key, value) => set((s) => ({ ...s, [key]: value })),
    }),
    {
      name: 'flash-arb-settings',
      version: 1,
    }
  )
);
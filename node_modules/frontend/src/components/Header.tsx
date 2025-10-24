import { useEffect, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useBotAPI } from '../hooks/useBotAPI';

export const Header = () => {
  const { fetchMetrics, parseMetrics } = useBotAPI();
  const [paused, setPaused] = useState(false);
  const [network, setNetwork] = useState('local');
  const [balanceEth, setBalanceEth] = useState<string>('—');

  useEffect(() => {
    const load = async () => {
      try {
        const txt = await fetchMetrics();
        const m = parseMetrics(txt);
        setPaused(m['bot_paused_state'] === 1);
        setNetwork(m['bot_network_id'] ? String(m['bot_network_id']) : 'local');
        setBalanceEth(m['bot_wallet_balance_eth'] ? `${m['bot_wallet_balance_eth'].toFixed?.(4)}` : '—');
      } catch (err) {
        // Fallback: keep defaults, avoid error breaking UI
        setPaused(false);
        setNetwork('local');
        setBalanceEth('—');
      }
    };
    load();
  }, [fetchMetrics, parseMetrics]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold text-cyan-400">Flash-Arb Bot</span>
        <span className={`text-xs px-2 py-1 rounded ${paused ? 'bg-red-900 text-red-300' : 'bg-emerald-900 text-emerald-300'}`}>
          {paused ? '⛔ Paused' : '✅ Active'}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-300">
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="cursor-help">Network: {network}</span>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-slate-700">
              Rete connessa. Configurabile in Settings.
            </Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="cursor-help">Balance: {balanceEth} ETH</span>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-slate-700">
              Saldo wallet operativo (placeholder).
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    </div>
  );
};
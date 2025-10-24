import { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { useBotAPI } from '../hooks/useBotAPI';
import { LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Home() {
  const { fetchMetrics, parseMetrics, evaluate, execute } = useBotAPI();
  const [loading, setLoading] = useState(false);
  const [metricsText, setMetricsText] = useState<string>('');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const txt = await fetchMetrics();
      if (!mounted) return;
      setMetricsText(txt || '');
      const m = parseMetrics(txt);
      setPaused(m['bot_paused_state'] === 1);
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [fetchMetrics, parseMetrics]);

  const m = useMemo(() => parseMetrics(metricsText), [metricsText, parseMetrics]);

  // Rileva se stiamo usando mock data (tutti i valori principali sono zero)
  const isUsingMockData = useMemo(() => {
    return m['arb_executed_total'] === 0 && 
           m['arb_reverted_total'] === 0 && 
           m['arb_profit_total_wei'] === 0 && 
           m['gas_used_total_wei'] === 0 &&
           m['timestamp'] > 0; // timestamp presente indica mock data
  }, [m]);

  const lineData = useMemo(() => {
    // Mock latest 24h profit series from metrics mean profit
    const base = Number(m['profit_mean_eth'] || 0);
    return Array.from({ length: 24 }).map((_, i) => ({ hour: `${i}:00`, profit: base + Math.sin(i / 3) * base * 0.25 }));
  }, [m]);

  const barData = useMemo(() => {
    // Mock distribution based on average gas/slippage
    const gas = Number(m['gas_mean_wei'] || 0);
    const slip = Number(m['slippage_mean_bps'] || 0);
    return [
      { name: 'Slippage bps', value: slip },
      { name: 'Gas wei', value: gas },
    ];
  }, [m]);

  const onScan = async () => {
    if (paused) return;
    setLoading(true);
    await evaluate();
    setLoading(false);
  };

  const onExecuteTestnet = async () => {
    if (paused) return;
    if (!window.confirm('Confermi esecuzione in testnet/dry-run?')) return;
    setLoading(true);
    await execute({ amountWei: 0, maxSlippageBps: 0, deadlineSeconds: 0, path: [] });
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Banner giallo per metriche offline */}
      {isUsingMockData && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          ⚠️ Metriche offline: i valori sono mock finché il backend non viene avviato.
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard title="Profit medio (ETH)" value={(m['profit_mean_eth'] ?? 0).toFixed?.(6)} hint="Media ultime opportunità" />
        <MetricCard title="Gas medio (wei)" value={(m['gas_mean_wei'] ?? 0).toFixed?.(0)} />
        <MetricCard title="Tx riuscite" value={m['tx_success_count'] ?? 0} />
        <MetricCard title="Tx revertite" value={m['tx_revert_count'] ?? 0} />
        <MetricCard title="Paused?" value={m['bot_paused_state'] === 1 ? '⛔ yes' : '✅ no'} />
      </div>

      <div className="flex gap-2">
        <button disabled={paused || loading} className="px-3 py-2 rounded bg-cyan-700 disabled:bg-slate-700 text-white" onClick={onScan}>Scan</button>
        <button disabled={paused || loading} className="px-3 py-2 rounded bg-cyan-700 disabled:bg-slate-700 text-white" onClick={() => setLoading(true)}>Simulate</button>
        <button disabled={paused || loading} className="px-3 py-2 rounded bg-cyan-700 disabled:bg-slate-700 text-white" onClick={onExecuteTestnet}>Execute Testnet</button>
        {loading && <div className="spinner" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <div className="text-slate-300 mb-2">Profit vs tempo (24h)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData}>
              <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
              <ChartTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="profit" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <div className="text-slate-300 mb-2">Distribuzione slippage e gas</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
              <ChartTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Bar dataKey="value" fill="#0e7490" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded p-3 text-xs text-slate-400">
        <div className="mb-2">Raw /metrics:</div>
        <pre className="overflow-auto max-h-48 whitespace-pre-wrap">{metricsText || '—'}</pre>
      </div>
    </div>
  );
}
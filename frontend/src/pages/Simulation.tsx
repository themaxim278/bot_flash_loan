import { useEffect, useState } from 'react';
import { useBotAPI } from '../hooks/useBotAPI';

export default function Simulation() {
  const { simulate } = useBotAPI();
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const runSim = async () => {
    setRunning(true);
    setLogs((l) => [...l, '▶️ Avvio simulazione...']);
    const res = await simulate({ amountWei: 0, maxSlippageBps: 0, deadlineSeconds: 300, path: [] });
    setLogs((l) => [...l, `Gas: ${res?.gasUsedWei}`, `Profit: ${res?.netProfitWei}`, `Status: ${res?.status}`]);
    setRunning(false);
  };

  useEffect(() => {
    // Auto-run once as demo
    runSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <button disabled={running} className="px-3 py-2 rounded bg-cyan-700 disabled:bg-slate-700 text-white" onClick={runSim}>Esegui simulazione</button>
        {running && <div className="spinner" />}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded p-3 text-sm text-slate-300">
        <div className="mb-2">Log step-by-step</div>
        <div className="space-y-1">
          {logs.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-cyan-400">•</span>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
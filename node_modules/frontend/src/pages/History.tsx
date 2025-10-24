import { useEffect, useState } from 'react';
import { useBotAPI } from '../hooks/useBotAPI';

export default function History() {
  const { fetchHistory } = useBotAPI();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetchHistory();
      setRows(res || []);
      setLoading(false);
    };
    load();
  }, [fetchHistory]);

  return (
    <div className="p-4">
      <div className="bg-slate-900 border border-slate-800 rounded p-2">
        {loading ? (
          <div className="p-4 text-slate-300">Caricamento storico…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Tx Hash</th>
                <th className="text-right p-2">Profit (ETH)</th>
                <th className="text-right p-2">Gas (wei)</th>
                <th className="text-center p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="p-2 text-slate-200">{r.date}</td>
                  <td className="p-2 text-cyan-400">{r.txHash}</td>
                  <td className="p-2 text-right text-slate-200">{r.profitEth}</td>
                  <td className="p-2 text-right text-slate-200">{r.gasWei}</td>
                  <td className="p-2 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${r.status === 'ok' ? 'bg-emerald-900 text-emerald-300' : 'bg-yellow-900 text-yellow-300'}`}>
                      {r.status === 'ok' ? '✅ ok' : '⚠️ reverted'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
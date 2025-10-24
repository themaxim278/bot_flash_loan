import { useEffect, useState } from 'react';
import { useBotAPI } from '../hooks/useBotAPI';

type Opportunity = {
  path: string;
  spreadBps: number;
  slippageBps: number;
  liquidityUsd: number;
  profitEth: number;
};

type Props = {
  onSimulate: (opp: Opportunity) => void;
};

export const OpportunityTable = ({ onSimulate }: Props) => {
  const { discover } = useBotAPI();
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await discover();
      setRows(res || []);
      setLoading(false);
    };
    load();
  }, [discover]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-2">
      {loading ? (
        <div className="p-4 text-slate-300">Caricamento opportunità…</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="text-left p-2">Path</th>
              <th className="text-right p-2">Spread (bps)</th>
              <th className="text-right p-2">Slippage (bps)</th>
              <th className="text-right p-2">Liquidity (USD)</th>
              <th className="text-right p-2">Profit (ETH)</th>
              <th className="text-right p-2">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800">
                <td className="p-2 text-slate-200">{r.path}</td>
                <td className="p-2 text-right text-slate-200">{r.spreadBps.toFixed?.(2)}</td>
                <td className="p-2 text-right text-slate-200">{r.slippageBps.toFixed?.(2)}</td>
                <td className="p-2 text-right text-slate-200">{r.liquidityUsd.toLocaleString?.()}</td>
                <td className="p-2 text-right text-slate-200">{r.profitEth.toFixed?.(6)}</td>
                <td className="p-2 text-right">
                  <button
                    className="text-sm px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white"
                    onClick={() => onSimulate(r)}
                    title="Simula"
                  >
                    Simula
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
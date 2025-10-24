import { useEffect } from 'react';

export type SimulationResult = {
  status: 'ok' | 'reverted';
  gasUsedWei: number;
  netProfitWei: number;
  reason?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  result?: SimulationResult | null;
};

export const SimulationDrawer = ({ open, onClose, result }: Props) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end">
      <div className="w-full max-h-[70vh] bg-slate-900 border-t border-slate-800 rounded-t p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-cyan-400">Output Simulazione</h3>
          <button className="text-slate-300 hover:text-white" onClick={onClose}>Chiudi</button>
        </div>
        <div className="mt-4">
          {result ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-slate-300">Stato: {result.status === 'ok' ? '✅ ok' : '⚠️ reverted'}</div>
              <div className="text-slate-300">Gas usato (wei): {result.gasUsedWei}</div>
              <div className="text-slate-300">Profit netto (wei): {result.netProfitWei}</div>
              {result.reason && <div className="text-slate-300">Reason: {result.reason}</div>}
            </div>
          ) : (
            <div className="text-slate-300">Nessun risultato.</div>
          )}
        </div>
      </div>
    </div>
  );
};
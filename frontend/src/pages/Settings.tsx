import { useSettingsStore } from '../hooks/useSettingsStore';

export default function Settings() {
  const settings = useSettingsStore();

  const Field = ({ label, name, type = 'text' }: { label: string; name: keyof typeof settings; type?: string }) => (
    <div className="space-y-1">
      <label className="text-sm text-slate-300">{label}</label>
      <input
        className="w-full px-3 py-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
        type={type}
        value={String(settings[name] ?? '')}
        onChange={(e) => settings.set(name as any, type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
        <h3 className="text-lg font-semibold text-cyan-400">Configurazione</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Min Net Profit (wei)" name={"minNetProfitWei" as any} type="number" />
          <Field label="Max Slippage (bps)" name={"maxSlippageBps" as any} type="number" />
          <Field label="Deadline (s)" name={"deadlineSeconds" as any} type="number" />
          <Field label="Relay URL" name={"relayUrl" as any} />
          <Field label="RPC URL" name={"rpcUrl" as any} />
          <Field label="Network" name={"network" as any} />
        </div>
      </div>
      <div className="text-xs text-slate-400">Le modifiche vengono salvate in localStorage e applicate alle chiamate API.</div>
    </div>
  );
}
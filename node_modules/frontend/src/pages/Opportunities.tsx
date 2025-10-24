import { useState } from 'react';
import { OpportunityTable } from '../components/OpportunityTable';
import { SimulationDrawer } from '../components/SimulationDrawer';
import type { SimulationResult } from '../components/SimulationDrawer';
import { useBotAPI } from '../hooks/useBotAPI';
import { useSettingsStore } from '../hooks/useSettingsStore';

export default function Opportunities() {
  const { simulate } = useBotAPI();
  const settings = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async (opp: any) => {
    const res = await simulate({
      amountWei: Number(settings.minNetProfitWei || 0),
      maxSlippageBps: Number(settings.maxSlippageBps || 0),
      deadlineSeconds: Number(settings.deadlineSeconds || 300),
      path: opp?.path?.split?.('->') || [],
    });
    setResult(res as any);
    setOpen(true);
  };

  return (
    <div className="p-4 space-y-4">
      <OpportunityTable onSimulate={handleSimulate} />
      <SimulationDrawer open={open} onClose={() => setOpen(false)} result={result ?? undefined} />
    </div>
  );
}
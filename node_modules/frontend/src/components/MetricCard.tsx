import * as Tooltip from '@radix-ui/react-tooltip';

type Props = {
  title: string;
  value: string | number;
  hint?: string;
};

export const MetricCard = ({ title, value, hint }: Props) => (
  <div className="bg-slate-900 border border-slate-800 rounded p-4 w-full">
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{title}</span>
      {hint && (
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="text-slate-400 cursor-help">ℹ️</span>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-slate-700">
              {hint}
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </div>
    <div className="mt-2 text-2xl font-semibold text-cyan-400">{value}</div>
  </div>
);
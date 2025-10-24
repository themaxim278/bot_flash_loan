import { loadConfig } from '../config';
import { fetchMockPools } from '../discovery/mockDex';
import { generateTwoHop, generateThreeHop } from '../discovery/opportunities';
import { evaluateOpportunity, EvaluationContext } from '../evaluation';
import logger from '../logger';
import { initDb, saveTrade, TradeRecord } from '../db';
import { initMetricsServer, recordTradeMetric } from '../metrics';
import { checkSecurityGuards } from '../security';

function toEth(wei: number): string {
  return wei / 1e18 + '';
}

export async function evaluate() {
  const cfg = loadConfig();

  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const disableDb = args.includes('--no-db');
  const disableMetrics = args.includes('--no-metrics');

  if (!disableMetrics) {
    initMetricsServer(Number(process.env.METRICS_PORT || 9090));
  }
  if (!disableDb) {
    initDb();
  }

  // Security warning checks (owner/executor coincidence)
  await checkSecurityGuards();

  const pools = fetchMockPools();
  const candidates = [
    ...generateTwoHop(pools),
    ...generateThreeHop(pools),
  ].filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);

  const ctx: EvaluationContext = {
    cfg,
    mevBufferBps: 5,
    ethUsdPrice: 3500,
  };

  const evals = candidates.map((o) => evaluateOpportunity(o, ctx));

  const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0);
  const rejected = evals.filter((e) => e.reason);

  const topAccepted = accepted.sort((a, b) => b.netProfitWei - a.netProfitWei).slice(0, 3);

  if (!disableDb || !disableMetrics) {
    for (const e of topAccepted) {
      const trade: TradeRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        path: e.path,
        sizeUsd: Number((ctx as any).cfg?.notionalUsdDefault) || (e.notionalUsd || 0),
        profitWei: e.netProfitWei.toString(),
        gasWei: e.gasWei.toString(),
        status: 'evaluated',
        revertReason: undefined,
      };
      if (!disableDb) saveTrade(trade);
      if (!disableMetrics) recordTradeMetric(trade);
    }
  }

  if (jsonOut) {
    const output = topAccepted.map((e) => ({
      path: e.path,
      spreadBps: e.spreadBps,
      gasEstimatedWei: e.gasWei,
      netProfitWei: e.netProfitWei,
      notionalUsd: e.notionalUsd,
    }));
    console.log(JSON.stringify({ network: cfg.network, opportunities: output }, null, 2));
    return;
  }

  logger.info({ network: cfg.network, dexes: cfg.dexes }, 'evaluation start');
  logger.info(
    {
      thresholds: {
        minNetProfitWei: cfg.minNetProfitWei,
        maxSlippageBps: cfg.maxSlippageBps,
        maxGasWei: cfg.maxGasWei,
        minLiquidityUsd: cfg.minLiquidityUsd,
        deadlineSeconds: cfg.deadlineSeconds,
        mevBufferBps: (ctx as any).mevBufferBps,
      },
    },
    'limits applied',
  );

  console.log('\nOpportunità accettate (top 3):');
  for (const e of topAccepted) {
    console.log(
      ` - path=${e.path.join(' -> ')} spreadBps=${e.spreadBps} gasWei=${e.gasWei} netProfitWei=${e.netProfitWei} (~${toEth(e.netProfitWei)} ETH)`,
    );
  }

  console.log('\nEsempi di opportunità scartate:');
  for (const r of rejected.slice(0, 3)) {
    console.log(
      ` - path=${r.path.join(' -> ')} spreadBps=${r.spreadBps} gasWei=${r.gasWei} netProfitWei=${r.netProfitWei} (~${toEth(r.netProfitWei)} ETH) reason=${r.reason}`,
    );
  }
}
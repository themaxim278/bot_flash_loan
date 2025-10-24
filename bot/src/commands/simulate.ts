import dotenv from 'dotenv';
import { JsonRpcProvider } from 'ethers';
import { loadConfig } from '../config';
import { fetchMockPools } from '../discovery/mockDex';
import { generateTwoHop, generateThreeHop } from '../discovery/opportunities';
import { evaluateOpportunity, EvaluationContext } from '../evaluation';
import { simulateOnChain } from '../simulation/simulate';
import logger from '../logger';
import { initDb, saveTrade, TradeRecord } from '../db';
import { initMetricsServer, recordTradeMetric } from '../metrics';
import { checkSecurityGuards } from '../security';

function toEth(wei: bigint): string {
  return Number(wei) / 1e18 + '';
}

export async function simulate() {
  dotenv.config();
  const cfg = loadConfig();
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const includeFailure = args.includes('--include-failure');
  const offlineArg = args.includes('--offline');
  const disableDb = args.includes('--no-db');
  const disableMetrics = args.includes('--no-metrics');
  const sizeUsdArg = args.find((a) => a.startsWith('--sizeUsd='));
  const sizeUsd = sizeUsdArg ? Number(sizeUsdArg.split('=')[1]) : undefined;

  const envRpc = (process.env.RPC_URL || '').replace(/[`"']/g, '').trim();
  const envNet = (process.env.NETWORK || '').trim();
  const executorAddress = (cfg as any).executorAddress || process.env.EXECUTOR_ADDRESS;
  const rpcUrl = offlineArg ? cfg.rpcUrl : (envRpc || cfg.rpcUrl);
  const net = envNet || cfg.network;
  const offline = net === 'local' || offlineArg;

  if (!disableMetrics) {
    initMetricsServer(Number(process.env.METRICS_PORT || 9090));
  }
  if (!disableDb) {
    initDb();
  }

  const pools = fetchMockPools();
  const candidates = [
    ...generateTwoHop(pools),
    ...generateThreeHop(pools),
  ].filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);

  const ctx: EvaluationContext = {
    cfg: { ...cfg, network: net, rpcUrl, notionalUsdDefault: sizeUsd ?? (cfg as any).notionalUsdDefault },
    mevBufferBps: (cfg as any).mevBufferBps ?? 5,
    ethUsdPrice: 3500,
  } as any;

  const evals = candidates.map((o) => evaluateOpportunity(o, ctx));
  const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0).slice(0, 3);

  const provider: any = offline
    ? {
        getBlock: async () => ({ baseFeePerGas: BigInt('50000000000') }),
      }
    : new JsonRpcProvider(rpcUrl);

  // Security warning checks (owner/executor coincidence, low balance)
  await checkSecurityGuards(provider);

  const results = [] as Array<{
    ok: boolean;
    path: string[];
    expectedOutWei: bigint;
    gasEstimatedWei: bigint;
    netProfitWei: bigint;
    revertReason?: string;
  }>;

  for (let i = 0; i < accepted.length; i++) {
    const res = await simulateOnChain(accepted[i], ctx, provider, executorAddress);
    if (res.ok || includeFailure) {
      results.push({
        ok: res.ok,
        path: accepted[i].path,
        expectedOutWei: res.expectedOutWei,
        gasEstimatedWei: res.gasEstimatedWei,
        netProfitWei: res.netProfitWei,
        revertReason: res.revertReason,
      });
      if (!disableDb || !disableMetrics) {
        const trade: TradeRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          path: accepted[i].path,
          sizeUsd: Number((ctx as any).cfg?.notionalUsdDefault) || 0,
          profitWei: res.netProfitWei.toString(),
          gasWei: res.gasEstimatedWei.toString(),
          status: res.ok ? 'simulated' : 'reverted',
          revertReason: res.revertReason,
        };
        if (!disableDb) saveTrade(trade);
        if (!disableMetrics) recordTradeMetric(trade);
      }
    }
  }

  logger.info({ network: net }, 'simulate start');
  if (!jsonOut) {
    console.log('\nSimulazioni:');
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const e = accepted[i] || accepted[0];
    const status = r.ok ? 'ok' : `revert(${r.revertReason})`;
    if (!jsonOut) {
      console.log(
        ` - path=${r.path.join(' -> ')} spreadBps=${e?.spreadBps} expectedOutWei=${r.expectedOutWei} gasEstimatedWei=${r.gasEstimatedWei} profitNetWei=${r.netProfitWei} (~${toEth(r.netProfitWei)} ETH) esito=${status}`,
      );
    }
  }

  if (!jsonOut) {
    console.log('\n✅ Simulazione completata');
    if (!disableDb) console.log('💾 Risultato salvato in bot/db.sqlite');
    if (!disableMetrics) console.log('📈 Metrics aggiornate su http://localhost:9090/metrics');
  }
}
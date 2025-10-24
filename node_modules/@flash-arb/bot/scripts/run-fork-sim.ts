import pino from 'pino';
import { JsonRpcProvider } from 'ethers';
import { loadConfig } from '../src/config';
import { fetchMockPools } from '../src/discovery/mockDex';
import { generateTwoHop, generateThreeHop } from '../src/discovery/opportunities';
import { evaluateOpportunity, EvaluationContext } from '../src/evaluation';
import { simulateOpportunity } from '../src/simulation/engine';

async function main() {
  const logger = pino({ level: 'info' });
  const cfg = loadConfig();

  const forkRpc = process.env.FORK_RPC_URL || cfg.rpcUrl;
  const targetBlock = process.env.FORK_BLOCK ? Number(process.env.FORK_BLOCK) : undefined;
  const provider = new JsonRpcProvider(forkRpc);

  logger.info({ network: cfg.network, forkRpc }, 'fork simulate start');

  const pools = fetchMockPools();
  const candidates = [
    ...generateTwoHop(pools),
    ...generateThreeHop(pools),
  ].filter((o) => o.minLiquidityUsd >= cfg.minLiquidityUsd);

  const ctx: EvaluationContext = {
    cfg,
    mevBufferBps: (cfg as any).mevBufferBps ?? 5,
    ethUsdPrice: 3500,
  };

  const evals = candidates.map((o) => evaluateOpportunity(o, ctx));
  const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0).slice(0, 3);

  const results = [] as any[];
  for (const e of accepted) {
    const res = await simulateOpportunity(e, ctx, provider);
    results.push(res);
  }

  // Print three outcomes
  console.log('\nFork Sim Results:');
  for (const r of results) {
    const status = r.ok ? 'ok' : `revert(${r.reason})`;
    console.log(
      ` - path=${r.path.join(' -> ')} expectedOutWei=${r.expectedOutWei} gasEstimatedWei=${r.gasEstimatedWei} netProfitWei=${r.netProfitWei} esito=${status}`,
    );
  }
}

main().catch((err) => {
  console.error('run-fork-sim error', err);
  process.exit(1);
});
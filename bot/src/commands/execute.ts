import dotenv from 'dotenv';
import { JsonRpcProvider } from 'ethers';
import { loadConfig } from '../config';
import { fetchMockPools } from '../discovery/mockDex';
import { generateTwoHop, generateThreeHop } from '../discovery/opportunities';
import { evaluateOpportunity, EvaluationContext } from '../evaluation';
import { simulateOnChain } from '../simulation/simulate';
import { executeOpportunity } from '../execution/execute';
import { executionMetrics } from '../execution/metrics';
import logger from '../logger';
import { initDb, saveTrade, TradeRecord } from '../db';
import { initMetricsServer, recordTradeMetric } from '../metrics';
import { checkSecurityGuards, applyPauseIfNeeded, isPaused } from '../security';

function toEth(wei: bigint): string {
  return Number(wei) / 1e18 + '';
}

export async function execute() {
  dotenv.config();
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const dryRun = args.includes('--dry-run');
  const disableDb = args.includes('--no-db');
  const disableMetrics = args.includes('--no-metrics');
  const sizeUsdArg = args.find((a) => a.startsWith('--sizeUsd='));
  const sizeUsd = sizeUsdArg ? Number(sizeUsdArg.split('=')[1]) : undefined;

  try {
    const cfg = loadConfig();
    const envRpc = (process.env.RPC_URL || '').replace(/[`"']/g, '').trim();
    const envNet = (process.env.NETWORK || '').trim();
    const privateKey = (process.env.PRIVATE_KEY || '').trim();
    const executorAddress = (cfg as any).executorAddress || process.env.EXECUTOR_ADDRESS;
    const rpcUrl = envRpc || cfg.rpcUrl;
    const net = envNet || cfg.network;

    if (!disableMetrics) {
      initMetricsServer(Number(process.env.METRICS_PORT || 9090));
    }
    if (!disableDb) {
      initDb();
    }

    const provider = new JsonRpcProvider(rpcUrl);

    // Security pre-flight checks
    await checkSecurityGuards(provider);

    // Check paused state or loss limit reached
    if (isPaused()) {
      logger.warn({ security: true }, '⚠️ Loss limit reached, pausing bot');
      logger.warn({ security: true }, '🔒 Bot paused until manual unpause by owner.');
      executionMetrics.recordBlocked('paused');
      return;
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
    const accepted = evals.filter((e) => !e.reason && e.netProfitWei > 0).slice(0, 1);

    if (accepted.length === 0) {
      const message = 'No profitable opportunities found';
      if (jsonOut) {
        console.log(JSON.stringify({ network: net, status: 'no-opportunities', message }, null, 2));
      } else {
        logger.info(message);
      }
      return;
    }

    const opportunity = accepted[0];
    const simulationResult = await simulateOnChain(opportunity, ctx, provider, executorAddress);

    if (!simulationResult.ok && !dryRun) {
      const message = `Simulation failed: ${simulationResult.revertReason}`;
      if (jsonOut) {
        console.log(
          JSON.stringify(
            {
              network: net,
              status: 'simulation-failed',
              revertReason: simulationResult.revertReason,
              path: opportunity.path.join('->'),
              message,
            },
            null,
            2,
          ),
        );
      } else {
        logger.error(message);
      }
      return;
    }

    const executionResult = await executeOpportunity(opportunity, simulationResult, ctx, provider, { dryRun, privateKey });

    const logData = {
      network: net,
      path: opportunity.path.join('->'),
      spreadBps: opportunity.spreadBps,
      txHash: executionResult.txHash,
      gasUsed: executionResult.gasUsed?.toString(),
      gasEstimated: simulationResult.gasEstimatedWei.toString(),
      profitExpected: executionResult.profitExpected.toString(),
      profitExpectedEth: toEth(executionResult.profitExpected),
      relayUsed: executionResult.relayUsed,
      status: executionResult.status,
      revertReason: executionResult.revertReason,
      txData: executionResult.txData,
    };

    if (!disableDb || !disableMetrics) {
      const trade: TradeRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        path: opportunity.path,
        sizeUsd: Number((ctx as any).cfg?.notionalUsdDefault) || 0,
        profitWei: executionResult.profitExpected.toString(),
        gasWei: (executionResult.gasUsed ?? simulationResult.gasEstimatedWei).toString(),
        status: executionResult.status,
        revertReason: executionResult.revertReason,
      };
      if (!disableDb) saveTrade(trade);
      if (!disableMetrics) recordTradeMetric(trade);
    }

    if (jsonOut) {
      console.log(JSON.stringify(logData, null, 2));
    } else {
      console.log('\n=== Execution Result ===');
      console.log(`Network: ${net}`);
      console.log(`Path: ${opportunity.path.join(' -> ')}`);
      console.log(`Spread: ${opportunity.spreadBps} bps`);
      console.log(`Status: ${executionResult.status}`);

      if (executionResult.status === 'dry-run') {
        console.log('✅ Dry-run completed successfully');
        console.log(`Expected Profit: ${toEth(executionResult.profitExpected)} ETH`);
        console.log(`Gas Limit: ${executionResult.txData?.gasLimit}`);
        console.log(`Max Fee Per Gas: ${executionResult.txData?.maxFeePerGas} wei`);
        console.log(`Max Priority Fee: ${executionResult.txData?.maxPriorityFeePerGas} wei`);
      } else if (executionResult.status === 'success') {
        console.log('✅ Transaction executed successfully');
        console.log(`TX Hash: ${executionResult.txHash}`);
        console.log(`Gas Used: ${executionResult.gasUsed}`);
        console.log(`Profit: ${toEth(executionResult.profitExpected)} ETH`);
        console.log(`Relay Used: ${executionResult.relayUsed ? 'Yes' : 'No'}`);
      } else if (executionResult.status === 'blocked') {
        console.log('⚠️ Execution blocked by safety guards');
        console.log(`Reason: ${executionResult.revertReason}`);
      } else {
        console.log('❌ Execution failed');
        console.log(`Reason: ${executionResult.revertReason}`);
        if (executionResult.txHash) {
          console.log(`TX Hash: ${executionResult.txHash}`);
        }
      }

      if (!disableDb) console.log('💾 Risultato salvato in bot/db.sqlite');
      if (!disableMetrics) console.log('📈 Metrics aggiornate su http://localhost:9090/metrics');
    }

    logger.info(logData, 'execute-opportunity');

    if (!jsonOut) {
      console.log('\n📊 Execution Metrics:');
      console.log(executionMetrics.getPrometheusMetrics());
    }
  } catch (error: any) {
    const errorData = {
      network: undefined,
      status: 'error',
      error: error.message,
      dryRun: undefined,
    };

    if (jsonOut) {
      console.log(JSON.stringify(errorData, null, 2));
    } else {
      logger.error(error, 'Execution failed');
    }

    process.exit(1);
  }
}
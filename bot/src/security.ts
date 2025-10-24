import { JsonRpcProvider, Wallet } from 'ethers';
import logger from './logger';
import { setBotPaused } from './metrics';
import { getMetricsSummary, saveMetric } from './db';

let consecutiveReverts = 0;
let pausedState = false;

function toEth(valueWei: bigint): number {
  return Number(valueWei) / 1e18;
}

export function isPaused(): boolean {
  return pausedState;
}

export function unpause(): void {
  pausedState = false;
  setBotPaused(false);
  logger.info({ security: true }, 'Bot unpaused');
}

export async function checkSecurityGuards(provider?: JsonRpcProvider): Promise<void> {
  const owner = (process.env.OWNER_ADDRESS || '').trim().toLowerCase();
  const pk = (process.env.PRIVATE_KEY || '').trim();
  const executor = (process.env.EXECUTOR_ADDRESS || '').trim().toLowerCase();

  // Owner/executor coincidence warnings
  try {
    if (owner) {
      const execAddr = executor || (pk ? new Wallet(pk).address.toLowerCase() : '');
      if (execAddr && execAddr === owner) {
        logger.warn({ security: true, owner, executor: execAddr }, '⚠️ Owner and executor addresses coincide');
      }
    }
  } catch {}

  // Balance check
  try {
    if (provider && pk) {
      const addr = new Wallet(pk).connect(provider).address;
      const bal = await provider.getBalance(addr);
      const minEth = Number(process.env.MIN_REQUIRED_ETH || '0.01');
      if (toEth(bal) < minEth) {
        logger.warn({ security: true, address: addr, balanceEth: toEth(bal), minEth }, '⚠️ Low wallet balance');
      }
    }
  } catch {}
}

export function applyPauseIfNeeded(opts: { lossWei?: bigint | number; revert?: boolean; testMode?: boolean }): void {
  const limitWei = BigInt(process.env.LOSS_LIMIT_WEI || '0');
  const lossWei = opts.lossWei !== undefined ? BigInt(opts.lossWei as any) : 0n;

  if (lossWei > 0n) {
    // Persist daily loss metric (simple aggregate)
    saveMetric('daily_loss_total_wei', Number(lossWei));
  }

  // Check aggregate loss against limit
  if (limitWei > 0n) {
    const summary = getMetricsSummary();
    const dailyLoss = BigInt(Math.floor(Number(summary['daily_loss_total_wei'] || 0)));
    if (dailyLoss > limitWei) {
      pausedState = true;
      setBotPaused(true);
      logger.warn({ security: true, lossWei: Number(dailyLoss), limitWei: Number(limitWei) }, '⚠️ Loss limit reached, pausing bot');
      logger.warn({ security: true }, '🔒 Bot paused until manual unpause by owner.');
      return;
    }
  }

  // Test-mode auto pause on 3 consecutive reverts
  if (opts.testMode && opts.revert) {
    consecutiveReverts += 1;
    saveMetric('consecutive_reverts', 1);
    if (consecutiveReverts >= 3) {
      pausedState = true;
      setBotPaused(true);
      logger.warn({ security: true, consecutiveReverts }, '⚠️ AutoPause: 3 consecutive reverts');
    }
  }
  if (opts.revert === false) {
    consecutiveReverts = 0; // reset on success
  }
}
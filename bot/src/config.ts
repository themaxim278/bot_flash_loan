import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type { RuntimeConfig } from './types';

dotenv.config();

const RuntimeConfigSchema = z.object({
  network: z.string(),
  rpcUrl: z.string().min(1),
  relayUrl: z.string().min(1),
  minNetProfitWei: z.number().int().nonnegative(),
  maxSlippageBps: z.number().int().nonnegative(),
  deadlineSeconds: z.number().int().positive(),
  scanIntervalMs: z.number().int().positive(),
  maxGasWei: z.number().int().nonnegative(),
  minLiquidityUsd: z.number().nonnegative(),
  mevBufferBps: z.number().int().nonnegative().optional(),
  notionalUsdDefault: z.number().nonnegative().optional(),
  dexes: z.array(z.enum(['uniswapv2', 'uniswapv3', 'sushi', 'curve', 'balancer'])),
  flashLoan: z.object({ provider: z.literal('aaveV3'), feeBps: z.number().int().nonnegative() }),
});

function resolveConfigPath(): string {
  const custom = process.env.CONFIG_PATH;
  if (custom && fs.existsSync(custom)) return custom;
  const profile = process.env.FL_CONFIG ?? 'default';
  const filename = `${profile}.yaml`;
  const local = path.resolve(process.cwd(), 'config', filename);
  if (fs.existsSync(local)) return local;
  const monorepoRoot = path.resolve(process.cwd(), '..', 'config', filename);
  return monorepoRoot;
}

export function loadConfig(): RuntimeConfig {
  const cfgPath = resolveConfigPath();
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const parsed = parseYaml(raw);
  const validated = RuntimeConfigSchema.parse(parsed);
  return validated as RuntimeConfig as any;
}

if (require.main === module) {
  const cfg = loadConfig();
  console.log('[config] loaded', cfg.network);
}
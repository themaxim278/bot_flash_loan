import { loadConfig } from './config';
import { discover } from './commands/discover';
import { evaluate } from './commands/evaluate';
import { simulate } from './commands/simulate';
import { execute } from './commands/execute';

export async function main() {
  const cmd = process.argv[2] ?? 'help';
  if (cmd === 'discover') {
    await discover();
    return;
  }
  if (cmd === 'evaluate') {
    await evaluate();
    return;
  }
  if (cmd === 'simulate') {
    await simulate();
    return;
  }
  if (cmd === 'execute') {
    await execute();
    return;
  }
  const cfg = loadConfig();
  console.log(`[cli] Available commands: discover, evaluate, simulate, execute`);
  console.log(`[cli] config: ${cfg.network} dexes=${cfg.dexes.join(',')}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('CLI error', err);
    process.exit(1);
  });
}
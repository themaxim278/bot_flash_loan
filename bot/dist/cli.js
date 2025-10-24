"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const config_1 = require("./config");
const discover_1 = require("./commands/discover");
const evaluate_1 = require("./commands/evaluate");
const simulate_1 = require("./commands/simulate");
const execute_1 = require("./commands/execute");
async function main() {
    const cmd = process.argv[2] ?? 'help';
    if (cmd === 'discover') {
        await (0, discover_1.discover)();
        return;
    }
    if (cmd === 'evaluate') {
        await (0, evaluate_1.evaluate)();
        return;
    }
    if (cmd === 'simulate') {
        await (0, simulate_1.simulate)();
        return;
    }
    if (cmd === 'execute') {
        await (0, execute_1.execute)();
        return;
    }
    const cfg = (0, config_1.loadConfig)();
    console.log(`[cli] Available commands: discover, evaluate, simulate, execute`);
    console.log(`[cli] config: ${cfg.network} dexes=${cfg.dexes.join(',')}`);
}
if (require.main === module) {
    main().catch((err) => {
        console.error('CLI error', err);
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map
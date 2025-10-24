"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const yaml_1 = require("yaml");
const zod_1 = require("zod");
dotenv_1.default.config();
const RuntimeConfigSchema = zod_1.z.object({
    network: zod_1.z.string(),
    rpcUrl: zod_1.z.string().min(1),
    relayUrl: zod_1.z.string().min(1),
    minNetProfitWei: zod_1.z.number().int().nonnegative(),
    maxSlippageBps: zod_1.z.number().int().nonnegative(),
    deadlineSeconds: zod_1.z.number().int().positive(),
    scanIntervalMs: zod_1.z.number().int().positive(),
    maxGasWei: zod_1.z.number().int().nonnegative(),
    minLiquidityUsd: zod_1.z.number().nonnegative(),
    mevBufferBps: zod_1.z.number().int().nonnegative().optional(),
    notionalUsdDefault: zod_1.z.number().nonnegative().optional(),
    dexes: zod_1.z.array(zod_1.z.enum(['uniswapv2', 'uniswapv3', 'sushi', 'curve', 'balancer'])),
    flashLoan: zod_1.z.object({ provider: zod_1.z.literal('aaveV3'), feeBps: zod_1.z.number().int().nonnegative() }),
});
function resolveConfigPath() {
    const custom = process.env.CONFIG_PATH;
    if (custom && node_fs_1.default.existsSync(custom))
        return custom;
    const profile = process.env.FL_CONFIG ?? 'default';
    const filename = `${profile}.yaml`;
    const local = node_path_1.default.resolve(process.cwd(), 'config', filename);
    if (node_fs_1.default.existsSync(local))
        return local;
    const monorepoRoot = node_path_1.default.resolve(process.cwd(), '..', 'config', filename);
    return monorepoRoot;
}
function loadConfig() {
    const cfgPath = resolveConfigPath();
    const raw = node_fs_1.default.readFileSync(cfgPath, 'utf8');
    const parsed = (0, yaml_1.parse)(raw);
    const validated = RuntimeConfigSchema.parse(parsed);
    return validated;
}
if (require.main === module) {
    const cfg = loadConfig();
    console.log('[config] loaded', cfg.network);
}
//# sourceMappingURL=config.js.map
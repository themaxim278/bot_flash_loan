export type DexId = 'uniswapv2' | 'uniswapv3' | 'sushi' | 'curve' | 'balancer';
export interface FlashLoanConfig {
    provider: 'aaveV3';
    feeBps: number;
}
export interface RuntimeConfig {
    network: string;
    rpcUrl: string;
    relayUrl: string;
    minNetProfitWei: number;
    maxSlippageBps: number;
    deadlineSeconds: number;
    scanIntervalMs: number;
    maxGasWei: number;
    minLiquidityUsd: number;
    dexes: string[];
    flashLoan: {
        provider: string;
        feeBps: number;
    };
    mevBufferBps?: number;
    notionalUsdDefault?: number;
    executorAddress?: string;
}

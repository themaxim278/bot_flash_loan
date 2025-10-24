export type Address = string;
export interface Token {
    symbol: string;
    address: Address;
    decimals: number;
}
export interface Pool {
    dex: string;
    token0: Token;
    token1: Token;
    liquidityUsd: number;
    price0to1: number;
    price1to0: number;
}
export interface Opportunity {
    path: string[];
    hops: number;
    spreadBps: number;
    minLiquidityUsd: number;
}

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
  price0to1: number; // token0 -> token1 price per unit
  price1to0: number; // token1 -> token0 price per unit
}

export interface Opportunity {
  path: string[]; // token symbols sequence
  hops: number;
  spreadBps: number;
  minLiquidityUsd: number;
}
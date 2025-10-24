"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMockPools = fetchMockPools;
const WETH = { symbol: 'WETH', address: '0xWETH', decimals: 18 };
const DAI = { symbol: 'DAI', address: '0xDAI', decimals: 18 };
const USDC = { symbol: 'USDC', address: '0xUSDC', decimals: 6 };
function fetchMockPools() {
    return [
        // UniswapV2-style pools
        {
            dex: 'uniswapv2',
            token0: WETH,
            token1: DAI,
            liquidityUsd: 500000,
            price0to1: 3500, // 1 WETH -> 3500 DAI
            price1to0: 1 / 3500,
        },
        {
            dex: 'uniswapv2',
            token0: WETH,
            token1: USDC,
            liquidityUsd: 400000,
            price0to1: 3500, // 1 WETH -> 3500 USDC
            price1to0: 1 / 3500,
        },
        // Sushi pools
        {
            dex: 'sushi',
            token0: DAI,
            token1: USDC,
            liquidityUsd: 300000,
            price0to1: 1.0, // near parity
            price1to0: 1.0,
        },
        // Add reverse USDC->DAI pool to enable WETH->USDC->DAI path
        {
            dex: 'sushi',
            token0: USDC,
            token1: DAI,
            liquidityUsd: 300000,
            price0to1: 1.0,
            price1to0: 1.0,
        },
        // UniswapV3 pool slight price variation (WETH->USDC)
        {
            dex: 'uniswapv3',
            token0: WETH,
            token1: USDC,
            liquidityUsd: 800000,
            price0to1: 3510,
            price1to0: 1 / 3510,
        },
        // UniswapV3 pool slight price variation (WETH->DAI)
        {
            dex: 'uniswapv3',
            token0: WETH,
            token1: DAI,
            liquidityUsd: 700000,
            price0to1: 3510,
            price1to0: 1 / 3510,
        },
    ];
}
//# sourceMappingURL=mockDex.js.map
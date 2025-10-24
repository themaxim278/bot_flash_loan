import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

dotenv.config();

function sanitizeUrl(u: string | undefined): string {
  return (u || '').replace(/[`"']/g, '').trim();
}

async function loadHardhat(): Promise<HardhatRuntimeEnvironment> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const contractsDir = path.resolve(__dirname, '..', 'contracts');
  process.chdir(contractsDir);
  // dynamic import after chdir so it picks up contracts/hardhat.config.ts
  const hre = (await import('hardhat')) as any;
  return hre as HardhatRuntimeEnvironment;
}

function nowPlus(seconds: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}

function encodeParams(ethers: any, deadline: bigint, minAmountOut: bigint, slippageBpsMax: bigint, expectedOut: bigint): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(uint256,uint256,uint256)', 'uint256'],
    [[deadline, minAmountOut, slippageBpsMax], expectedOut],
  );
}

async function simulateOnce(ethers: any, executor: any, initiator: any, label: string, amountInWei: bigint, premiumWei: bigint, expectedOutWei: bigint, gp: { deadline: bigint; minAmountOut: bigint; slippageBpsMax: bigint; }) {
  const assets: string[] = [];
  const amounts: bigint[] = [amountInWei];
  const premiums: bigint[] = [premiumWei];
  const params = encodeParams(ethers, gp.deadline, gp.minAmountOut, gp.slippageBpsMax, expectedOutWei);

  let status = 'ok';
  let revertReason: string | undefined;
  let gasUsedWei = 0n;
  try {
    const gasUnits = await executor.executeOperation.estimateGas(assets, amounts, premiums, initiator.address, params);
    const gasPrice = await ethers.provider.getGasPrice();
    gasUsedWei = BigInt(gasUnits.toString()) * BigInt(gasPrice.toString());
    await executor.executeOperation.staticCall(assets, amounts, premiums, initiator.address, params);
  } catch (e: any) {
    status = 'reverted';
    revertReason = e?.reason || e?.shortMessage || e?.message || 'callstatic-revert';
    const gasUnitsFallback = 200000n;
    const gasPrice = await ethers.provider.getGasPrice();
    gasUsedWei = gasUnitsFallback * BigInt(gasPrice.toString());
  }

  const repay = amountInWei + premiumWei;
  const profitNet = expectedOutWei - repay - gasUsedWei;
  console.log(JSON.stringify({
    path: ['WETH','USDC','DAI'],
    spreadBps: 28,
    gasUsedWei: gasUsedWei.toString(),
    profitNetWei: profitNet.toString(),
    status,
    revertReason,
  }));
}

(async () => {
  const rpcUrl = sanitizeUrl(process.env.RPC_URL);
  const hre = await loadHardhat();
  const { ethers, network } = hre as any;

  // reset hardhat network with forking
  await network.provider.request({
    method: 'hardhat_reset',
    params: [{ forking: { jsonRpcUrl: rpcUrl } }],
  });

  const [owner, initiator] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('FlashArbExecutor');
  const executor = await Factory.deploy(owner.address);
  await executor.waitForDeployment();

  const amountIn = ethers.parseEther('1');
  const premium = ethers.parseEther('0.009');

  // sim 1: ok
  await simulateOnce(
    ethers,
    executor,
    initiator,
    'sim-ok-1',
    amountIn,
    premium,
    ethers.parseEther('1.02'),
    { deadline: nowPlus(300), minAmountOut: ethers.parseEther('1.01'), slippageBpsMax: 50n },
  );

  // sim 2: ok
  await simulateOnce(
    ethers,
    executor,
    initiator,
    'sim-ok-2',
    amountIn,
    premium,
    ethers.parseEther('1.03'),
    { deadline: nowPlus(300), minAmountOut: ethers.parseEther('1.00'), slippageBpsMax: 50n },
  );

  // sim 3: revert (min-amount-out)
  await simulateOnce(
    ethers,
    executor,
    initiator,
    'sim-revert-3',
    amountIn,
    premium,
    ethers.parseEther('1.01'),
    { deadline: nowPlus(300), minAmountOut: ethers.parseEther('1.05'), slippageBpsMax: 50n },
  );
})();
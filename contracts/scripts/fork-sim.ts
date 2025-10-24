import { ethers, network } from 'hardhat';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function sanitize(u?: string): string { return (u || '').replace(/[`"']/g, '').trim(); }
function nowPlus(seconds: number): number { return Math.floor(Date.now() / 1000) + seconds; }

function encodeParams(deadline: number, minAmountOut: bigint, slippageBpsMax: bigint, expectedOut: bigint): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(uint256,uint256,uint256)', 'uint256'],
    [[deadline, minAmountOut, slippageBpsMax], expectedOut],
  );
}

async function simulateOnce(executor: any, initiator: any, label: string, amountInWei: bigint, premiumWei: bigint, expectedOutWei: bigint, gp: { deadline: number; minAmountOut: bigint; slippageBpsMax: bigint; }) {
  const assets: string[] = [];
  const amounts: bigint[] = [amountInWei];
  const premiums: bigint[] = [premiumWei];
  const params = encodeParams(gp.deadline, gp.minAmountOut, gp.slippageBpsMax, expectedOutWei);

  let status = 'ok';
  let revertReason: string | undefined;
  let gasUsedWei = 0n;
  try {
    const gasUnits = await executor.executeOperation.estimateGas(assets, amounts, premiums, initiator.address, params);
    const gasPriceHex: string = await network.provider.send('eth_gasPrice', []);
    const gasPrice = BigInt(gasPriceHex);
    gasUsedWei = BigInt(gasUnits.toString()) * gasPrice;
    await executor.executeOperation.staticCall(assets, amounts, premiums, initiator.address, params);
  } catch (e: any) {
    status = 'reverted';
    revertReason = e?.reason || e?.shortMessage || e?.message || 'callstatic-revert';
    const gasUnitsFallback = 200000n;
    const gasPriceHex: string = await network.provider.send('eth_gasPrice', []);
    const gasPrice = BigInt(gasPriceHex);
    gasUsedWei = gasUnitsFallback * gasPrice;
  }

  const repay = amountInWei + premiumWei;
  const profitNet = expectedOutWei - repay - gasUsedWei;
  console.log(JSON.stringify({ label, gasUsedWei: gasUsedWei.toString(), profitNetWei: profitNet.toString(), status, revertReason }));
}

async function main() {
  const rpcUrl = sanitize(process.env.RPC_URL);
  if (!rpcUrl) throw new Error('RPC_URL missing');

  await network.provider.request({ method: 'hardhat_reset', params: [{ forking: { jsonRpcUrl: rpcUrl } }] });
  const [owner, initiator] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('FlashArbExecutor');
  const executor = await Factory.deploy(owner.address);
  await executor.waitForDeployment();

  const amountIn = ethers.parseEther('1');
  const premium = ethers.parseEther('0.009');

  await simulateOnce(executor, initiator, 'sim-ok-1', amountIn, premium, ethers.parseEther('1.02'), { deadline: nowPlus(300), minAmountOut: ethers.parseEther('1.01'), slippageBpsMax: 50n });
  await simulateOnce(executor, initiator, 'sim-ok-2', amountIn, premium, ethers.parseEther('1.03'), { deadline: nowPlus(300), minAmountOut: ethers.parseEther('1.00'), slippageBpsMax: 50n });
  await simulateOnce(executor, initiator, 'sim-revert-3', amountIn, premium, ethers.parseEther('1.01'), { deadline: nowPlus(300), minAmountOut: ethers.parseEther('1.05'), slippageBpsMax: 50n });
}

main().catch((err) => { console.error(err); process.exit(1); });
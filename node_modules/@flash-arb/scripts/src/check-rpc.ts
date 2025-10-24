import { JsonRpcProvider } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const urlRaw = process.env.RPC_URL || "";
const url = urlRaw.replace(/[`"']/g, '').trim();

(async () => {
  try {
    const provider = new JsonRpcProvider(url);
    const net = await provider.getNetwork();
    const block = await provider.getBlockNumber();
    console.log(`✅ RPC OK network=${net.name} chainId=${Number(net.chainId)} latestBlock=${block}`);
  } catch (e: any) {
    console.log(`❌ RPC ERROR: ${e?.message || e}`);
  }
})();
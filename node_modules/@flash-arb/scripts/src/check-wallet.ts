import { Wallet } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const pk = process.env.PRIVATE_KEY || "";

if (!pk) {
  console.log("❌ Wallet not set: PRIVATE_KEY empty");
} else {
  const w = new Wallet(pk);
  console.log(`✅ Wallet address: ${w.address}`);
}
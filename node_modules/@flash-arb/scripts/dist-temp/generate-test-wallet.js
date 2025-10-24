"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();
const envPath = ".env";
// Genera wallet in modo sicuro
const w = ethers_1.Wallet.createRandom();
// OUTPUT: soltanto l'indirizzo pubblico (non la private key)
console.log("✅ Generated test wallet address:", w.address);
// Leggi .env esistente (se presente)
let envContent = "";
try {
    envContent = fs.readFileSync(envPath, "utf8");
}
catch (e) {
    envContent = "";
}
// Rimuovi eventuale riga PRIVATE_KEY= precedente
const lines = envContent.split(/\r?\n/).filter(Boolean).filter(l => !l.startsWith("PRIVATE_KEY="));
// Aggiungi la nuova PRIVATE_KEY in modo SILENZIOSO (non stamparla)
lines.push(`PRIVATE_KEY="${w.privateKey}"`);
const newEnv = lines.join("\n") + "\n";
fs.writeFileSync(envPath, newEnv, { encoding: "utf8", flag: "w" });
// Conferma scritto senza rivelare la key
console.log("🔐 Private key stored securely in .env (not printed).");
console.log("ℹ️ Fund the address on Sepolia using a faucet:", w.address);

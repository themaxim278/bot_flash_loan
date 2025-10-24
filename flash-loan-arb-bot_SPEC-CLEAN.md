# Flash Loan Arbitrage Bot — Specifica Tecnica Completa

## 🎯 Obiettivo

Costruire un **bot di arbitraggio DeFi con flash‑loan** realmente eseguibile, prima in **testnet** e poi (solo dopo audit) in **mainnet**, con:

- Orchestrazione completa: discovery → simulazione → esecuzione atomica → report.  
- Gestione gas e concorrenza (MEV‑safe, mempool privata).  
- Sicurezza by‑design e test automatici.  
- **UI frontend** per uso semplice.  
- Nessuna assunzione di “profitto garantito”: il bot **esegue solo se il profit netto atteso > soglia** e tutte le guardie passano.  

> 🔒 Vincolo: **non saltare alcun passaggio**. Ogni step deve avere criteri di accettazione, test e log chiari. Se un test fallisce, correggere e ripetere prima di procedere.

---

## 🧱 Stack tecnico richiesto

- Solidity ^0.8.20, Foundry o Hardhat  
- Node.js 20, TypeScript, Ethers v6  
- DEX: Uniswap v2/v3, Sushi, Curve, Balancer (via adapter)  
- Flash‑loan: Aave V3 su testnet; fallback Balancer/Uniswap se disponibile  
- RPC dedicati low‑latency; relays privati (Flashbots o equivalenti)  
- DB: SQLite (POC), Postgres (opzionale)  
- CI: GitHub Actions  
- UI: React + Vite + TypeScript + Tailwind + shadcn/ui + Recharts  

---

## 📁 Struttura Repository (obbligatoria)

```plaintext
/contracts
  FlashArbExecutor.sol
  libs/*
  interfaces/*

/bot
  discovery/...
  simulation/...
  execution/...
  risk/...
  adapters/{uniswapv2,uniswapv3,sushi,curve,balancer}.ts
  cli.ts
  config.ts
  types.ts
  db.ts
  metrics.ts

/frontend
  src/(pages, components, hooks, services)

/scripts
  deploy.ts
  seed-testnet.ts
  run-fork-sim.ts
  run-once.ts
  healthcheck.ts

/config
  default.yaml
  sepolia.yaml
  mainnet.example.yaml

/docs
  RUNBOOK.md
  SECURITY.md
  ARCHITECTURE.md
  FRONTEND.md
  CONFIG.md
```

---

## 🚀 Ordine Operativo (Vincolante)

### **Step 0 — Bootstrap Progetto**
1. Inizializza monorepo (pnpm o npm workspaces).  
2. Configura lint, prettier, tsconfig, dotenv, env-example.  
3. Crea file `config/*.yaml` con valori placeholder.

**Criteri di accettazione**
- `npm i` e `npm run build` senza warning gravi.  
- Lint e typecheck passano.

---

### **Step 1 — Smart Contract + Test**
- Scrivi `FlashArbExecutor.sol` con callback AaveV3 `executeOperation`.  
- Implementa swap atomico parametrico con guardie: `deadline`, `minAmountOut`, `slippageBpsMax`, `repay check`, `onlyOwner`, `Pausable`.  
- Eventi: `Simulated`, `Executed`, `Reverted`.  
- Test con Foundry/Hardhat ed Echidna (property-based).  

**Criteri**
- 100% test essenziali OK.  
- Nessuna vulnerabilità *high* con Slither/Mythril.  
- Gas report completo del percorso felice.

---

### **Step 2 — Layer Discovery (Backend)**
- Moduli TS per lettura prezzi/liquidità (on‑chain via multicall, facoltativo subgraph).  
- Genera candidati 2‑hop/3‑hop con fee tier v3 e pool v2.  
- Calcola impatto e liquidity check.

**Criteri**
- `bot:discover` stampa opportunità con spread e liquidità.

---

### **Step 3 — Modulo Profittabilità & Rischio**
- Calcola profit netto = output − input − fee flash‑loan − gas stimato − buffer MEV.  
- Limiti da config: `minNetProfit`, `maxSlippage`, `maxGasWei`, `deadlineSeconds`.

**Criteri**
- `bot:evaluate` filtra correttamente, nessuna opportunità con profit ≤ 0 passa.

---

### **Step 4 — Simulazione Off‑Chain e Fork**
- `callStatic` sul contratto con parametri serializzati.  
- Script fork mainnet/testnet: log gas, slippage simulata, repay.

**Criteri**
- `bot:simulate` restituisce esito deterministico su ≥3 path campione.  
- Se la simulazione fallisce, l’esecuzione non parte.

---

### **Step 5 — Execution Engine + MEV Safety**
- Invio transazioni tramite bundle relay privato (fallback configurabile).  
- EIP‑1559 dinamico con cap e deadline corta.  
- Retry solo se safe e idempotente.

**Criteri**
- `bot:execute --dry-run` mostra bundle/gas senza inviare on‑chain.  
- `bot:execute` in testnet completa con evento `ArbExecuted`.

---

### **Step 6 — Osservabilità e Storage**
- Logging strutturato (pino).  
- Metrics Prometheus/OpenTelemetry.  
- DB SQLite per risultati (trades, gas, sim).

**Criteri**
- Endpoint metrics attivo e query di base documentate.

---

### **Step 7 — Sicurezza**
- RBAC minimale, chiavi via `.env`, supporto HSM/ledger.  
- Circuit breaker: `pause()`, limiti di perdita giornaliera (simulati).  
- `SECURITY.md` con minacce e mitigazioni.

**Criteri**
- Slither/Mythril: 0 vulnerabilità *high*.  
- Checklist firmata.

---

### **Step 8 — UI Frontend**
- Dashboard React con:
  - **Home**: stato rete, base fee, relay status, saldo, pulsanti Scan/Simulate/Execute.  
  - **Opportunità**: tabella con path, spread, liquidity, profit stimato.  
  - **Dettaglio simulazione**: log step‑by‑step, gas stimato, esito.  
  - **Storico**: operazioni passate con tx hash e profit netto.  
  - **Impostazioni**: minNetProfit, maxSlippage, relay endpoint, RPC, chain.  

**Criteri**
- `npm run dev` alza UI funzionante.  
- Flusso Scan→Simulate→Execute in testnet ok.

---

### **Step 9 — CI/CD**
- GitHub Actions: lint, test unit/fork, slither, mythril, build bot/frontend.  
- Artefatti: ABI, coverage, gas-report, bundle UI.

**Criteri**
- Tutti i badge verdi. Nessuno step rosso.  

---

### **Step 10 — RUNBOOK & Demo End‑to‑End**
- `RUNBOOK.md`: setup, comandi, troubleshooting.  
- Script demo:
  - `deploy.ts` su Sepolia/Holesky.  
  - `seed-testnet.ts` per fondi test.  
  - `run-once.ts` per un ciclo completo (no‑op se profit ≤ soglia).  

**Criteri**
- Esecuzione end‑to‑end in testnet con log completi e eventi `ArbExecuted`.

---

## ⚙️ Requisiti Funzionali Chiave
- Il bot **non invia** tx se guardia fallisce o profit netto ≤ soglia.  
- Parametri configurabili senza ricompilare.  
- Multi‑DEX via adapters.  
- Gas strategy dinamica + relay privati.  
- Ogni blocco critico ha test e log.

---

## 📈 Requisiti Non Funzionali
- Discovery < 1s su set pool configurato.  
- Retry bounded, backoff esponenziale, idempotenza.  
- Nessuna funzione che consenta drenaggio fondi.  
- Codebase manutenibile, commentata e documentata.

---

## 🧩 Configurazione Esempio (YAML)
```yaml
network: sepolia
rpcUrl: YOUR_RPC
relayUrl: YOUR_RELAY
minNetProfitWei: 2000000000000000
maxSlippageBps: 30
deadlineSeconds: 20
scanIntervalMs: 600
maxGasWei: 120000000000
minLiquidityUsd: 20000
dexes:
  - uniswapv3
  - uniswapv2
  - sushi
  - curve
flashLoan:
  provider: aaveV3
  feeBps: 9
```

---

## 🧪 Test Necessari
- Unit smart‑contract (slippage, deadline, repay).  
- Property‑based “no profit → no execute”.  
- Sim deterministica su 3 path.  
- Fork test con gas report.  
- UI e2e smoke (Cypress/Playwright).

---

## ✅ Criteri per il “Done”
- CI verde su `main`.  
- Demo testnet completata (`ArbExecuted` + `ArbSimulated`).  
- Nessuna *high severity* in `SECURITY.md`.  
- `RUNBOOK.md` replicabile in < 60 minuti.

---

## ⚠️ Note Etiche e di Rischio
- Solo arbitraggi legittimi. Niente sandwich o exploit.  
- Fermarsi se profit netto è incerto o negativo.  
- Audit esterno **obbligatorio** prima di deploy su mainnet.

---

## 💻 Frontend – Requisiti Sintetici
- React + TS + Tailwind + shadcn/ui.  
- Stato globale con Zustand o Redux Toolkit.  
- API via `services/`.  
- Componenti: Card, Table, Drawer, Modal, Toast, ecc.  
- Form validati con min/max.

---

## 🔍 Validazione Finale
1. `bot:run-once` scopre opportunità.  
2. Valuta profit.  
3. Simula la migliore.  
4. Se tutto ok in testnet → esegue.  
5. Stampa report finale (profit stimato vs reale, gas, hash).

---

## 📦 Output Attesi
- Codice completo.  
- ABI esportati.  
- Build frontend funzionante.  
- Artefatti CI (gas-report, coverage, slither/mythril).  
- Docs aggiornate in `/docs`.

---

## 🧱 Se Qualcosa Fallisce
- Blocca lo step.  
- Stampa log e ragione.  
- Crea issue *blocking* con titolo chiaro.  
- Risolvi, ripeti test fino a verde.

---

## 🧾 Appendice – Comandi Base
```bash
npm run dev           # frontend
npm run bot:discover
npm run bot:evaluate
npm run bot:simulate
npm run bot:execute
npm run test          # unit
npm run test:fork
npm run slither
npm run mythril
npm run gas-report
```

---

## 🔒 Avvertenza Finale
Questo progetto **non deve** inviare transazioni su mainnet senza audit e conferma esplicita.

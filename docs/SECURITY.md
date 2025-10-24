# Security

This document describes the threat model, mitigations, operational procedures, and a checklist for the flash-loan arbitrage bot.

## Threat Model

- Access control and RBAC: unauthorized pause/unpause or configuration changes on the executor contract.
- Key compromise: leakage of `PRIVATE_KEY` and/or confusion with `OWNER_ADDRESS` used for admin operations.
- On-chain execution risk: slippage, price manipulation, MEV frontrunning, deadline expiry.
- Reentrancy or unsafe external calls: interacting with AMMs or lending protocols.
- Loss accumulation: repeated small losses exceeding a daily acceptable threshold.

## Mitigations Implemented

- Owner and Pausable contract:
  - `FlashArbExecutor` inherits `Ownable`/`Pausable`.
  - `pause()`/`unpause()` restricted to owner.
  - Custom circuit-breaker: `dailyLossLimitWei` and `lossesByDay[day]` mapping, enforced in `executeOperation` and `simulateOperation` via `PausedOrLossLimit` error.
  - Owner-only `setDailyLossLimitWei(limit)` and `recordLoss(day, lossWei)`. Emission of `LossLimitTriggered(day, totalLossWei)` when limit is exceeded.
- Backend security guards (`bot/src/security.ts`):
  - Pre-flight `checkSecurityGuards()` warns if `OWNER_ADDRESS` equals `EXECUTOR_ADDRESS` (or derived from `PRIVATE_KEY`).
  - Warns on low wallet balance (config via `MIN_REQUIRED_ETH`).
  - `applyPauseIfNeeded()` pauses locally when `LOSS_LIMIT_WEI` exceeded by aggregate daily loss, or after 3 consecutive reverts in test mode.
- Observability and alerts:
  - Security logs tagged with `security=true` in Pino payload.
  - Prometheus metrics: `bot_paused_total` (counter) and `bot_paused_state` (gauge 0/1).
- CLI integration:
  - `execute.ts` calls `checkSecurityGuards()` and blocks execution when paused or loss-limit triggered.
  - `simulate.ts` and `evaluate.ts` call `checkSecurityGuards()` to surface warnings early.

## Key Rotation Procedures

- Maintain separate admin wallet for `OWNER_ADDRESS` from executor wallet used by `PRIVATE_KEY`.
- Rotate `PRIVATE_KEY` on a scheduled basis or after suspicion of compromise:
  - Generate a new key in an HSM or secure enclave.
  - Update `.env` with the new `PRIVATE_KEY` and derived `EXECUTOR_ADDRESS`.
  - Run dry-run (`bot:execute --dry-run`) to verify functionality.
  - Invalidate old key and update any relayer/MEV protection services.
- Rotate `OWNER_ADDRESS` via contract ownership transfer only after multi-party approval:
  - Pause the bot.
  - Use hardware wallet for `transferOwnership(newOwner)` on `FlashArbExecutor`.
  - Unpause after validation.

## HSM Usage

- Store `PRIVATE_KEY` and signing operations inside an HSM or secure enclave (Ledger, Trezor, SGX, or KMS with signing APIs).
- Use an abstraction layer to sign transactions without exposing raw keys to the bot process.
- Audit access to HSM and configure role-based policies restricting production signing.

## Security Checklist

- ✅ `OWNER_ADDRESS` differs from `EXECUTOR_ADDRESS`.
- ✅ Contract owner can `pause()`/`unpause()` and non-owners cannot.
- ✅ `dailyLossLimitWei` set to a conservative threshold and enforced.
- ✅ Backend `LOSS_LIMIT_WEI` configured and tested.
- ✅ Security logs show warnings for risky conditions (owner/executor same, low balance, pause triggered).
- ✅ Prometheus metrics expose `bot_paused_state` and `bot_paused_total`.
- ✅ Keys stored in HSM; rotations documented and periodically executed.
- ✅ Slither/Mythril report 0 high severity findings.
- ✅ Tests cover RBAC, pause/unpause, loss-limit blocking, and metric updates.

## Environment Variables

Add if missing in `.env`:

```
OWNER_ADDRESS=0x82bB546E77bF77d57D7Ee9bCA0B24d04fdDB608F
LOSS_LIMIT_WEI=5000000000000000
```

Optional:

- `MIN_REQUIRED_ETH` for wallet balance warnings (default `0.01`).
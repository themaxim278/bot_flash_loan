# Osservabilità: Metriche & Storage

Questo documento descrive le metriche Prometheus esposte dal bot di arbitraggio, il loro significato, esempi di output e alcune query PromQL utili.

## Metriche esposte

- arb_opportunities_total
  - Conteggio totale delle opportunità analizzate o simulate.
  - Incrementata da `evaluate` e `simulate` quando vengono registrati i risultati.

- arb_executed_total
  - Conteggio totale delle esecuzioni (incluse dry-run).
  - Incrementata da `execute` quando viene salvato un trade con stato `success` o `dry-run`.

- arb_reverted_total
  - Conteggio totale dei revert o blocchi.
  - Incrementata quando uno scenario fallisce (`reverted` o `blocked`).

- arb_profit_total_wei
  - Gauge con il totale cumulato di profitto in wei.
  - Incrementato/settato quando vengono registrati i trade.

- gas_used_total_wei
  - Gauge con il totale cumulato di gas utilizzato/stimato in wei.
  - Incrementato/settato quando vengono registrati i trade.

## Endpoint HTTP

- URL: `http://localhost:9090/metrics`
- Content-Type: `text/plain; version=0.0.4`
- Esempio di output:

```
# HELP arb_executed_total Total esecuzioni
arb_executed_total 2
arb_profit_total_wei 11999848000000000
```

## Storage SQLite

- Percorso: configurabile via `DB_PATH` (default `./bot/db.sqlite`)
- Tabelle:
  - trades(id TEXT PRIMARY KEY, timestamp INTEGER, path TEXT, sizeUsd REAL, profitWei TEXT, gasWei TEXT, status TEXT, revertReason TEXT)
  - metrics(id INTEGER PRIMARY KEY, name TEXT, value REAL, timestamp INTEGER)

## Variabili ambiente

- METRICS_PORT: porta del server metrics (default 9090)
- DB_PATH: percorso del file SQLite (default `./bot/db.sqlite`)

## Query PromQL di esempio

- Rate di esecuzioni (ultimi 5 minuti):
  - `rate(arb_executed_total[5m])`
- Profitto totale (ultimo valore):
  - `arb_profit_total_wei`
- Gas totale (ultimo valore):
  - `gas_used_total_wei`
- Revert per minuto:
  - `rate(arb_reverted_total[1m])`

## Note

- Il bot non stampa il contenuto del DB nei log; solo messaggi informativi.
- Per disabilitare storage o metriche: `--no-db` e `--no-metrics` sui comandi.
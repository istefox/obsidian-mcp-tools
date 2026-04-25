# Handoff — `istefox/obsidian-mcp-connector` (was `obsidian-mcp-tools`)

> **Aggiornato 2026-04-25 (handoff pre-switch terminale: kitty → Warp).** Documento di passaggio di consegne. Self-contained: dal clone iniziale al primo prompt da mandare a Claude Code, qui c'è tutto.
>
> **Per il quadro architetturale completo** (gotcha, stack, convenzioni di codice): leggere **`CLAUDE.md`** in radice. Questo file è la sintesi *operativa*; CLAUDE.md è la sintesi *tecnica*.

---

## 🚦 Quick Start — apertura sessione (Warp o qualsiasi terminale)

**Branch attivo:** `feat/http-embedded` (NON `main`). Versione: **0.4.0-alpha.1**. Ultimo commit pushato: `28c95d2`.

**Stato dei due track:**
- `main` = **0.3.7** stabile, BRAT-distribuito, 20 tool, intoccabile (vedi § Branch protection in CLAUDE.md).
- `feat/http-embedded` = **0.4.0-alpha.1**, infrastruttura HTTP completa + 19/19 tool portati nei file, **registrazione finale e release alpha.2 da fare**.

**Prossimi passi concreti (in ordine):**

1. **T23 — registrare i 20 tool in `packages/obsidian-plugin/src/features/mcp-tools/index.ts`** (T19 ne ha già registrato uno; gli altri 19 hanno solo `export const fooSchema` + `fooHandler`). Il piano di riferimento è `docs/plans/0.4.0-phase-2-tool-migration.md`, task T23. Approccio: una singola Edit al `registerTools()`, importazioni esplicite, registrazione `tools.register(schema, handler)` per ognuno.
2. **T24 — release `0.4.0-alpha.2`**: bump `bun run version prerelease` (o manuale su `package.json` + `manifest.json` + `versions.json`), prepend CHANGELOG entry con la lista dei tool ora esposti, commit + tag + push, verifica CI verde.
3. **Smoke test manuale 0.4.0-alpha.2 in vault TEST** — vedi § "Test 0.4.0-alpha in Obsidian" in basso.

**Cosa NON è ancora stato fatto:** Phase 3 (semantic search nativo con Transformers.js + MiniLM), Phase 4 (migration UX, Node.js detection, copy-config UI, store submission update, cut 0.4.0 stabile).

**Routine remote attive (cloud Anthropic, indipendenti dal terminale):**
- `trig_015yL8D3VNao7nhRKjBu95ZK` — Lun 07:00 UTC, monitor PR store #11919
- `trig_01Dx8sZTD78yBj7buuVYP9KE` — orario, watch issue #79

Tre routine duplicate disabilitate il 2026-04-25 (vedi `https://claude.ai/code/routines`).

**Primo prompt suggerito alla nuova sessione:**
> "Leggi `handoff.md` e `CLAUDE.md` in repo root, poi apri `docs/plans/0.4.0-phase-2-tool-migration.md` alla task T23. Stiamo proseguendo Phase 2 della migrazione HTTP-embedded: serve registrare i 20 tool nel `mcp-tools/index.ts` e poi rilasciare 0.4.0-alpha.2. Conferma di aver capito lo stato e procedi con T23."

---

## Indice

1. [Stato attuale del fork](#1-stato-attuale-del-fork)
2. [Setup del nuovo Mac dell'ufficio](#2-setup-del-nuovo-mac-dellufficio)
3. [Setup del vault TEST](#3-setup-del-vault-test-per-integration-manuale)
4. [Avvio della prima sessione Claude Code](#4-avvio-della-prima-sessione-claude-code)
5. [Cosa è stato fatto recentemente](#5-cosa-è-stato-fatto-nella-serie-di-sessioni-2026-04-09--2026-04-12)
6. [Cosa resta aperto](#6-cosa-resta-aperto)
7. [File chiave da conoscere](#7-file-chiave-da-conoscere)
8. [Cosa NON fare](#8-cosa-non-fare)
9. [Riferimenti esterni](#9-riferimenti-esterni)

---

## 1. Stato attuale del fork

### Repository
- **Repo:** `istefox/obsidian-mcp-connector` (rinominato il 2026-04-13 da `obsidian-mcp-tools`; redirect HTTP attivo).
- **Plugin id:** `mcp-tools-istefox` (deve essere unico nel community store).
- **Display name:** "MCP Connector".
- **Branch attivi (vedi § Branch protection in CLAUDE.md):**
  - `main` = **0.3.7** stabile (PROTETTO, intoccabile)
  - `feat/http-embedded` = **0.4.0-alpha.1** dev (Phase 1 done, Phase 2 22/24 done)
- **Remote setup canonico:**
  - `origin` → `https://github.com/istefox/obsidian-mcp-connector.git`
  - `upstream` → `https://github.com/jacksteamdev/obsidian-mcp-tools.git` (read-only, dichiarato unmaintained 2026-04-24)
- **Ultimo commit pushato su `feat/http-embedded` (2026-04-25):** **`28c95d2`** (`feat(mcp-tools): port execute_obsidian_command with permission + rate limit`).
- I 2 file `.bun-build` orfani (~118 MB totali) restano su disco ma sono gitignored.

### Release pubbliche
| Versione | Data | Note |
|---|---|---|
| **`0.4.0-alpha.1`** | 2026-04-25 mattina | Pre-release sul branch `feat/http-embedded`. Phase 1 completa: HTTP server in-process, Bearer auth, Origin validation, ToolRegistry, smoke tool `get_server_info`, settings UI. Solo `get_server_info` esposto: 19 tool reali pronti nei file ma non ancora registrati (T23 pending). NON sostituisce 0.3.7 in produzione. |
| **`0.3.7`** | 2026-04-24 | LATEST stable su `main`. Patch fix #71/#81 (block gap fix). Tag `0.3.7`, BRAT users sono qui. |
| `0.3.6` | 2026-04-24 | Patch fix #71 (block reference patch gap). |
| `0.3.5` | 2026-04-24 | Fix installer 404 (#3, @Metal0gic). Storia di rilascio "burn": lockfile drift causò release vuota, eliminata + tag re-emesso. |
| `0.3.4` | 2026-04-21 sera | Native MCP image/audio content blocks in `get_vault_file` (issue #59). Smoke test harness. |
| `0.3.3` | 2026-04-21 pomeriggio | Fix upstream #66 / #63 / #37. |
| `0.3.2` | 2026-04-17 | Refactor interni: `McpServer` high-level API migration. |
| `0.3.1` | 2026-04-13 notte | Manifest description corretta per community-store rules. |
| `0.3.0` | 2026-04-13 notte | First public release. Brand "MCP Connector". |

URL release: https://github.com/istefox/obsidian-mcp-connector/releases

### Health (snapshot 2026-04-25, branch `feat/http-embedded`)
| | |
|---|---|
| `bun run check` (4 package) | ✅ passa |
| Test obsidian-plugin | ✅ **351 pass / 0 fail** (124 nuovi vs 0.3.x — Phase 1+2) |
| Test mcp-server | ✅ legacy, ~152 pass — il package non viene shippato in 0.4.0 ma è vivo per `main` |
| Plugin prod build | ✅ |
| Server cross-compile | ⚠️ irrilevante per 0.4.0 (architettura HTTP-embedded elimina il binary) |
| GitHub Actions release.yml | ✅ esercitata su 0.3.x; nuovo flusso 0.4.0 da validare al primo tag stabile |

### Funzionalità complete

Il fork ha tutto Cluster A-F chiuso e Cluster G praticamente chiuso:

- **Cluster A-F** (bug fix upstream noti): tutti landed
- **#29 (command execution)**: **Fase 1 + 2 + 3 tutte landed** (Fase 3 completata 2026-04-13 sera)
- **#28** (install outside vault): completo
- **#26** (platform override per WSL): completo
- **#77** (no-arg inputSchema, openai-codex compat): coperto (regression test stasera, fix latente in `normalizeInputSchema`)
- **#62, #61, #60, #35**: tutti completi
- **#59 (binary content types)**: **completato in 0.3.4** (2026-04-21) — commit `6110b89`, merge `d037ed9`. Smoke test harness committato in `18dc5ff`.
- **Roadmap originale**: 11/12 chiusi
- **Coverage issue upstream aperte** (26 totali, snapshot 2026-04-21):
  - **23 risolte direttamente** (pinned nel CHANGELOG): #26, #28, #29, #30, #31, #33, #35, #36, **#37**, #39, #40, #41, **#59**, #60, #61, #62, **#63**, **#66**, #67, #68, #71, #77, #78
  - **2 coperte indirettamente** da #28: #27, #38 (install-path fix risolve la radice dei due bug report)
  - **1 meta** aperta da te stesso il 2026-04-21: #79 ("Heads-up: maintenance status and a friendly community fork")
  - **0 non risolte.**

### Distribuzione community
- **PR community store aperta:** https://github.com/obsidianmd/obsidian-releases/pull/11919
- Stato: **"Ready for review"** (validation passed dopo 2 iterazioni di fix). In attesa di revisione umana del team Obsidian (tipicamente 2-8 settimane).
- **BRAT** già funzionante: utenti possono installare oggi puntando a `istefox/obsidian-mcp-connector`.

### Vault locali
Plugin symlinkato in due vault per dev/test:
- `~/Obsidian/TEST/.obsidian/plugins/mcp-tools-istefox/` (era `mcp-tools/` — rinominato dopo l'id change)
- `~/Obsidian/Lab/.obsidian/plugins/mcp-tools-istefox/` (vault "vero" dell'utente, configurato 2026-04-13 con Local REST API + binario in `~/Library/Application Support/obsidian-mcp-tools/bin/`, Claude Desktop config con `OBSIDIAN_API_KEY` di Lab)

`data.json` è dentro il symlink target = nel repo. **TEST e Lab condividono lo stesso `data.json`** (effetto del symlink). Per separarli serve distribuire come zip vero e proprio invece che symlink.

---

## 2. Setup del nuovo Mac dell'ufficio

Da seguire una volta sola al primo accesso. Tempo stimato: ~10 minuti.

### 2.1 Prerequisiti

```bash
# Bun (runtime + package manager). Non installare npm/yarn/pnpm —
# il monorepo è bun-only.
curl -fsSL https://bun.sh/install | bash

# GitHub auth — scegli UNO dei due metodi:

#   (a) gh CLI con login interattivo (consigliato se nuovo Mac)
brew install gh && gh auth login

#   (b) SSH key esistente già caricata su github.com (più rapido se
#       hai già la chiave configurata)
ssh -T git@github.com  # test della chiave

# Obsidian app
brew install --cask obsidian
# oppure manualmente da https://obsidian.md
```

### 2.2 Clone del fork

```bash
# Crea la cartella di lavoro:
mkdir -p ~/Documents/Projects
cd ~/Documents/Projects

# HTTPS (richiede gh login):
gh repo clone istefox/obsidian-mcp-connector

# Oppure SSH se preferisci:
git clone git@github.com:istefox/obsidian-mcp-connector.git

cd obsidian-mcp-connector
```

### 2.3 Sistema i remote

Quando cloni dalla tua fork, `origin` punta già a `istefox/obsidian-mcp-connector`. Aggiungi `upstream` per seguire `jacksteamdev`:

```bash
git remote add upstream https://github.com/jacksteamdev/obsidian-mcp-tools.git
git fetch --all
```

Verifica con `git remote -v`. Output atteso:
```
origin    https://github.com/istefox/obsidian-mcp-connector.git (fetch)
origin    https://github.com/istefox/obsidian-mcp-connector.git (push)
upstream  https://github.com/jacksteamdev/obsidian-mcp-tools.git (fetch)
upstream  https://github.com/jacksteamdev/obsidian-mcp-tools.git (push)
```

> **NOTA STORICA:** prima della sessione del 2026-04-13 il fork si chiamava `obsidian-mcp-tools` e il remote del fork era `myfork`. La sessione di stasera ha rinominato il repo a `obsidian-mcp-connector` e ha riallineato i nomi remote alla convenzione standard (`origin` = il tuo fork, `upstream` = sorgente). Se trovi commit/script che fanno riferimento a `myfork`, sono pre-rename.

### 2.4 Install dipendenze

```bash
bun install   # installa workspace: server + plugin + shared + test-site
```

### 2.5 Verifica salute (smoke test)

```bash
# Type-check su tutti i package
bun run check

# Test del plugin
cd packages/obsidian-plugin && bun test && cd ../..

# Test del server
cd packages/mcp-server && bun test && cd ../..
```

**Aspettative**: type check verde; **219 test totali, 0 failure**
(126 plugin + 93 server).

### 2.6 Build una tantum (per esercitare il path)

```bash
# Plugin → produce main.js + styles.css IN RADICE del repo
# (Obsidian si aspetta lì, NON in dist/)
cd packages/obsidian-plugin && bun run build && cd ../..

# Server binario → produce packages/mcp-server/dist/mcp-server (60 MB)
cd packages/mcp-server && bun run build && cd ../..
```

`dist/` è gitignored, quindi i binari restano locali. La CI li
rigenera per le release tag.

---

## 3. Setup del vault TEST per integration manuale

Le sessioni precedenti hanno usato un vault Obsidian dedicato per i
test manuali end-to-end (path su Mac di casa: `~/Obsidian/TEST`).
Sul nuovo Mac devi ricrearlo:

### 3.1 Crea il vault

1. Apri Obsidian → **Create new vault** → nome `TEST`, path
   `~/Obsidian/TEST` (o dove preferisci).

### 3.2 Abilita Local REST API

Il plugin MCP Tools dipende da Local REST API per esporre le route
HTTP custom (incluso il gate `/mcp-tools/command-permission/` di
#29).

2. Settings → Community plugins → **Turn on community plugins**
3. Browse → cerca **"Local REST API"** di Adam Coddington
4. Install → Enable
5. Settings → Local REST API → verifica che ci sia una **API key**
   già generata. **Annotala** — ti serve per le curl di test
   manuali.

### 3.3 Symlinka il plugin di sviluppo nel vault

```bash
# Sostituisci il path con quello reale del checkout
REPO=~/Documents/Projects/Obsidian\ MCP/obsidian-mcp-tools
mkdir -p ~/Obsidian/TEST/.obsidian/plugins
ln -s "$REPO" ~/Obsidian/TEST/.obsidian/plugins/mcp-tools
```

### 3.4 Attiva il plugin

6. In Obsidian → Settings → Community plugins → attiva **MCP Tools**
7. Settings → MCP Tools → opzionalmente "Install server" se vuoi
   testare il server end-to-end (NON serve per Fase 3 di #29 — la
   Fase 3 è solo plugin-side)

### 3.5 Esempio di curl per testare il command-permission gate

(Sostituire `YOUR_API_KEY_HERE` con la API key del passo 3.2.5.)

```bash
# Allow path (assumendo "editor:toggle-bold" in allowlist)
curl -sk -X POST "https://127.0.0.1:27124/mcp-tools/command-permission/" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"editor:toggle-bold"}'

# Modal path (comando non in allowlist con master toggle ON →
# apre il modal in Obsidian, long-poll fino a 30s)
curl -sk -X POST "https://127.0.0.1:27124/mcp-tools/command-permission/" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"commandId":"workspace:edit-file-title"}' --max-time 35
```

---

## 4. Avvio della prima sessione Claude Code

Dentro la directory del repo, lancia `claude`. Come **primo prompt**
da mandare:

```
Stiamo continuando il lavoro sul fork istefox/obsidian-mcp-tools.
Ho appena fatto setup su questo Mac (Bun installato, repo clonato,
remote myfork sistemato, bun install fatto, vault TEST configurato
con Local REST API). Leggi prima handoff.md per orientarti, poi
CLAUDE.md per il quadro architetturale. Riassumimi in 5 righe lo
stato attuale e dimmi quale dei follow-up A/B/C/D/E/F proposti
vogliamo fare.
```

Claude Code ha memoria locale separata per macchina, quindi sul
nuovo Mac partirà senza il contesto delle sessioni precedenti. Questo
handoff + CLAUDE.md sono i suoi due input principali.

### Promemoria di stile

(Dovrebbero già essere in `~/.claude/CLAUDE.md` se hai sincronizzato
le tue user instructions globali. Se non lo sono, comunica
esplicitamente:)

- Risposte in italiano, codice/commenti in inglese
- Tono diretto, no filler
- Includere il livello di confidenza (alta / media / bassa) nelle
  risposte tecniche
- Pattern git: feature branch + merge `--no-ff` su main + push su
  `myfork`. Mai commit diretti su main per cambiamenti sostanziali
- Test manuale in vault TEST quando si tocca UI o flow runtime
- Mai tag/release senza chiedere

---

## 5. Cosa è stato fatto nella serie di sessioni (2026-04-09 → 2026-04-25)

In ordine cronologico inverso, con commit SHA. Il prefisso branch è esplicito quando non è `main`.

| Date approx | Lavoro | Commit/merge |
|---|---|---|
| 2026-04-25 mattina/pomeriggio | **Phase 2 batches B3+B4 (`feat/http-embedded`)** — port di 8 tool a colpi di subagent paralleli: `list_obsidian_commands` (`25e10c4`), `get_vault_file` con binary blocks nativi (`41cee32`), `patch_active_file` (`1afe78d`), `search_vault_simple` (`8723483`), `fetch` con `requestUrl`+Turndown (`ec22778`), `patch_vault_file` (`adc4ea4`), `search_vault` con fallback Local REST API (`de87b3b`), `search_vault_smart` via Smart Connections API (`bfcf246`), `execute_template` via Templater API (`12bf469`), `execute_obsidian_command` con permission + rate limit (`28c95d2`). 351 test totali verdi. **T23 + T24 ancora pending** (registrazione + release alpha.2). | branch `feat/http-embedded` — vedi `git log feat/http-embedded ^main --oneline` |
| 2026-04-25 mattina | **Branch protection policy** scritta in `CLAUDE.md` § "Branch protection policy" + memory `feedback_main_branch_protection.md`. Hard rule: `main` resta su 0.3.7 finché Stefano non autorizza esplicitamente il bump a 0.4.0. | (parte della sessione `feat/http-embedded` notte) |
| 2026-04-25 mattina | **Phase 2 batches B1+B2 (`feat/http-embedded`)** — port di 9 tool: `T3` (get_active_file exemplar), `T4` (update_active_file), `T5` (append_to_active_file), `T6` (patch_active_file helpers extraction), `T7` (delete_active_file), `T8` (show_file_in_obsidian), `T9` (list_vault_files), `T10`/`T11`/`T12`/`T13`/`T14`/`T15`. Helpers in `tools/services/patchHelpers.ts`. | branch `feat/http-embedded` |
| 2026-04-24 → 2026-04-25 | **Phase 1 completa (`feat/http-embedded`, 0.4.0-alpha.1)** — infrastruttura HTTP-embedded end-to-end: Bearer token (UTF-8 safe `compareTokens`), Origin validation anti-DNS-rebinding, port binding 27200-27205 con EADDRINUSE fallback, middleware chain method+path allow-list, McpServer + StreamableHTTPServerTransport, ToolRegistry portato dal package server, smoke tool `get_server_info`, settings UI con AccessControlSection, plugin lifecycle setup/teardown, mock runtime esteso (`mockApp`, `setMockFile`, `setMockMetadata`, `setMockCommands`, `setMockRequestUrl`). Decisioni architetturali in `docs/design/2026-04-24-http-embedded-design.md`. Plan operativo in `docs/plans/0.4.0-phase-1-infrastructure.md`. | branch `feat/http-embedded` |
| 2026-04-24 | **Issue #79 ufficialmente chiusa da jacksteamdev**: dichiarazione di unmaintained + offerta condizionata di link al README upstream se il fork (a) usa MCP over HTTP, (b) entra nel community store. Risposta postata da Stefano con design + plan committati a riprova dell'impegno. | (commento upstream #79) |
| 2026-04-24 | **Release `0.3.7` su `main`**: patch fix #71 (block gap) + #81. PR #5/#6/#7. | tag `0.3.7` |
| 2026-04-24 | **Release `0.3.6` su `main`**: block reference patch gap. | tag `0.3.6` |
| 2026-04-24 | **Release `0.3.5` su `main`**: fix installer 404 (#3, @Metal0gic). Lesson learned: lockfile drift causò release vuota, eliminato + tag re-emesso. | tag `0.3.5` |
| 2026-04-22 → 2026-04-23 | Indagine architettura: brainstorm HTTP-embedded vs server standalone. Decisione su Option B3 (in-process HTTP nel plugin, no Local REST API dependency, no binary). 9 decisioni tecniche D1-D9 documentate. | `docs/design/2026-04-24-http-embedded-design.md` |
| 2026-04-21 sera | **Smoke test harness per il binary path**: `scripts/smoke-test-binary.sh` (fixture generator + vault uploader via Local REST API) + `scripts/smoke-verify-binary.py` (client MCP automatico che spawna `bun src/index.ts`, fa handshake JSON-RPC via stdio, asserta la struttura per 5 casi: PNG/M4A inline, MP4/PDF unsupported_type, oversize PNG too_large). Auto-discovery della API key dal data.json del vault su macOS. **5/5 cases PASS**. | `18dc5ff` |
| 2026-04-21 pomeriggio | **#59 completato + release 0.3.4**: PR #2 `feat/issue-59-native-binary-content` — native MCP image/audio content blocks in `get_vault_file` (SDK 1.29.0). Sostituisce lo short-circuit testuale di 0.3.0 con response inline per PNG/JPEG/GIF/WebP/SVG/BMP/MP3/WAV/OGG/M4A/FLAC/AAC/WebM audio (cap 10 MiB). Fallback text-metadata per video/PDF/Office/archivi + oversize. Include `makeBinaryRequest` in `shared/makeRequest.ts`, widening dello schema `ToolRegistry` per audio, 14 nuovi unit test. | `6110b89`, merge `d037ed9`, tag `0.3.4` (`287e0fe`) |
| 2026-04-21 pomeriggio | **0.3.3**: fix upstream #66 (`OBSIDIAN_API_URL` ignored), #63 (`additionalProperties: {}` rompe Letta), #37 (trailing slash → 500). | `75fe2a3`, merge `1f3fd48`, tag `0.3.3` |
| 2026-04-17 | **0.3.2**: migrate `Server` → `McpServer` SDK 1.29.0 high-level API; extract `applySimpleSearchLimit`/`buildPatchHeaders`/`normalizeAppendBody` con regression test; pin #62/#68/#41/#39. | `7ba158f`, `939f167`, `046268b`, `95f4247`, tag `02dd2a4` |
| 2026-04-13 notte | **Pubblicazione community completa**: rebrand MCP Connector (id `mcp-tools-istefox`), repo rinominato `obsidian-mcp-connector`, README user-facing, migration guide, fix release pipeline (zip vuoto + version script argv bug + styles.css inesistente), release `0.3.0` + `0.3.1`, PR a `obsidianmd/obsidian-releases#11919` (validation passed). | merges `0028fd9`, `afc1a3c`, `b6d6f54`, `78e0854`, `8ce52aa`; tag `0.3.0` + `0.3.1` |
| 2026-04-13 notte | Setup vault Lab con MCP Connector end-to-end (Local REST API, install server, Claude Desktop config con OBSIDIAN_API_KEY di Lab). Smoke test: Claude Desktop legge il vault Lab via MCP. | (config esterna, no commit) |
| 2026-04-13 sera/notte | Regression test mirato per upstream issue #77 (`normalizeInputSchema` integrated path) | merge `c7c93be` |
| 2026-04-13 sera | **#29 Fase 3 completa (4/4 subtask)**: (1) test suite modal+handler con Modal/svelte mock in test-setup.ts, (2) export CSV audit log da settings UI, (3) soft rate-limit configurabile via Advanced disclosure, (4) quick-add presets (Editing/Navigation/Search) curati e filtrati sul registry. **+53 test**. | merge `4655e4b`, `fc00c4f`, `84e0a37`, `d60e907` |
| 2026-04-13 | Rename cartella progetto a `Obsidian MCP.nosync` (iCloud exclusion), fix `core.hooksPath` stale in git config, gitignore `*.bun-build`, rimosso doc stale `docs/features/prompt-requirements.md` | `f62c47f`, `23f5362` |
| 2026-04-12 | **#29 Fase 2 + race fix** — modal long-polling, soft rate warning, destructive heuristic, mutex per audit log | `de39e61`, `d134924`, merge `e29cf7b` |
| 2026-04-11 | Fix build mcp-server (type-only imports in `plugin-templater.ts`) | `2c482a6`, merge `1582fb4` |
| 2026-04-11 | **#29 Fase 1 MVP** — allowlist gating, audit log, rate limiter | `c2f4549`, merge `148d875` |
| 2026-04-11 | Doc prompt system end-to-end (roadmap #12) | `9f3d432`, merge `f202b51` |
| 2026-04-11 | `cline_docs/` directory (roadmap #10) | `a88fda2`, merge `2577f49` |
| 2026-04-11 | Upgrade MCP SDK 1.0.4 → 1.29.0 (roadmap #8) | `d925da3`, merge `cc7b849` |
| 2026-04-11 | Design review #29 (Option F hybrid) | merge `37e326a` |
| 2026-04-10 | Cluster G items, installer tests, platform override #26, install location #28 | (vedi `git log --oneline`) |

Per il dettaglio completo:

```bash
git log --oneline --first-parent main   # solo i merge in cronologia
git log --oneline                       # tutti i commit
```

---

## 6. Cosa resta aperto

In ordine di priorità per le prossime sessioni (focus assoluto: chiudere Phase 2 e shippare 0.4.0-alpha.2):

### A — 🔴 Phase 2 finalizzazione (blocking per ogni altra cosa)

- **T23: registrazione tool in `mcp-tools/index.ts`** — i 19 tool portati nel batch hanno solo `export const fooSchema` + `fooHandler`, non sono ancora connessi al `tools.register()`. Eccezione: `T19 execute_obsidian_command` ha già aggiunto la propria registrazione (vedi `28c95d2`). Approccio:
  1. Importare i 19 schema/handler restanti in `packages/obsidian-plugin/src/features/mcp-tools/index.ts`.
  2. Per ognuno: `tools.register(fooSchema, async (ctx) => fooHandler({ ...ctx, app: context.app, plugin: context.plugin }))`.
  3. Type-check (`bun run check`) e test (`cd packages/obsidian-plugin && bun test`).
  4. Commit conventional: `feat(mcp-tools): register all 20 tools in plugin transport`.
- **T24: release `0.4.0-alpha.2`** — bump version + tag + push. Procedura:
  1. CHANGELOG entry: lista dei 20 tool ora esposti via HTTP + nota che è ancora alpha (manca smoke test in vault reale, manca semantic embedding nativo).
  2. `bun run version prerelease` (oppure manuale: aggiornare `package.json`, `manifest.json`, `versions.json`).
  3. `git tag 0.4.0-alpha.2 && git push origin feat/http-embedded --tags`.
  4. CI ribuilda; verificare run verde.
- **Smoke test 0.4.0-alpha.2 in vault TEST** — vedi § "Test 0.4.0-alpha in Obsidian" in fondo a questo file.

### B — Phase 3: semantic search nativo

- **Plan**: da scrivere dopo che T23+T24 chiudono. Riferimento: § "Semantic search" del design `docs/design/2026-04-24-http-embedded-design.md`.
- **Stack**: Transformers.js + MiniLM-L6-v2 (embedding model 22 MB), indexer con due modalità (live: re-embedding al `vault.modify`, low-power: opt-in batched).
- **Effetto utente**: `search_vault_smart` smette di dipendere da Smart Connections plugin e diventa autosufficiente. Smart Connections rimane come opzione per chi lo usa già.

### C — Phase 4: migration UX + community store update

- Migration modal per utenti 0.3.x al primo upgrade a 0.4.0 (spiega cambio architettura, rimuove binary, aggiorna config Claude Desktop).
- Auto-detect Node.js + pre-warm `npx mcp-remote` (bridge stdio→HTTP per Claude Desktop, che non ha ancora supporto HTTP nativo).
- Tre generatori "Copy config" nel settings UI: Claude Desktop, Claude Code, Cursor/Cline/Continue.
- Cut **0.4.0 stabile** quando Phase 2-3-4 verificate in vault reale.
- Aggiornamento PR community store #11919 (bumpa il manifest a 0.4.0 quando ready) — ma solo dopo che jacksteamdev ha condiviso la sua decisione finale.

### D — Discord DM a @jacksteamdev (post-merge community store)

- Eseguire **solo quando**: (a) PR #11919 mergiata AND (b) 0.4.0 con HTTP transport è LATEST stabile.
- Carico: PR contro `jacksteamdev/obsidian-mcp-tools` che aggiorna README linkando il fork (conditions issue #79).
- Monitoraggio routine: `trig_015yL8D3VNao7nhRKjBu95ZK` (Lun 07:00 UTC) → notifica al merge.

### E — Monitoraggio passivo

- **PR community store #11919**: routine settimanale già in funzione. Niente da fare lato Stefano finché la routine non riporta novità.
- **Issue #79 upstream**: routine oraria (`trig_01Dx8sZTD78yBj7buuVYP9KE`) per qualsiasi reply post-2026-04-24.
- **Sync upstream**: `git fetch upstream` periodicamente. Improbabile che jacksteamdev riprenda, ma se succede serve saperlo.

### F — Test 0.4.0-alpha in Obsidian (procedura manuale)

Dato che l'utente vuole testare 0.4.0-alpha.1/alpha.2 in vault TEST:

1. **Build del plugin** sul branch `feat/http-embedded`:
   ```bash
   git checkout feat/http-embedded
   bun install
   cd packages/obsidian-plugin && bun run build
   ```
   Output: `main.js` + `styles.css` in `packages/obsidian-plugin/` (NON in `dist/`).
2. **Symlink in vault TEST** (se non già presente):
   ```bash
   REPO=~/Developer/Obsidian_MCP/obsidian-mcp-tools
   mkdir -p ~/Obsidian/TEST/.obsidian/plugins
   ln -s "$REPO/packages/obsidian-plugin" ~/Obsidian/TEST/.obsidian/plugins/mcp-tools-istefox
   ```
3. **Riavviare Obsidian** → Settings → Community plugins → disable+re-enable "MCP Connector" per ricaricare. Aprire i settings del plugin → sezione "Access Control" → copiare il Bearer token.
4. **Verifica HTTP up**: dal terminale, `curl -s http://127.0.0.1:27200/healthz` (o porta successiva se 27200 occupata; controllare i log della console di Obsidian per la porta effettiva). Risposta attesa: `{"status":"ok"}` o simile.
5. **Connettere Claude Desktop** (o altro client MCP):
   - Su `~/Library/Application Support/Claude/claude_desktop_config.json`:
     ```json
     {
       "mcpServers": {
         "obsidian-http": {
           "command": "npx",
           "args": ["mcp-remote", "http://127.0.0.1:27200/mcp", "--header", "Authorization: Bearer YOUR_TOKEN_HERE"]
         }
       }
     }
     ```
   - Riavviare Claude Desktop.
6. **In Claude Desktop**: chiedere "lista i tool MCP disponibili". Atteso: `get_server_info` (alpha.1) o tutti e 20 (alpha.2).
7. **Test funzionali**: chiedere "leggi la nota corrente di Obsidian" (`get_active_file`), "cerca 'foo' nel vault" (`search_vault_simple`), "esegui il template X" (`execute_template`).
8. **Logging**: aprire la Console developer di Obsidian (`Cmd+Opt+I`) per vedere richieste e risposte HTTP. In caso di errore 401, il token è sbagliato. In caso di 403 su Origin, Origin header non è loopback (`127.0.0.1` o `localhost`).

### Z — ~~Fase 4 outreach — annuncia il fork sulle issue upstream risolte~~ ✅ COMPLETATO 2026-04-21

- **Eseguito il 2026-04-21 ~19:21 UTC** via `scripts/fork-outreach-comment.py run --execute`.
- **23 commenti pubblicati** su `jacksteamdev/obsidian-mcp-tools` (una per issue risolta direttamente): #26, #28, #29, #30, #31, #33, #35, #36, #37, #39, #40, #41, #59, #60, #61, #62, #63, #66, #67, #68, #71, #77, #78. Audit trail completo con URL dei comment in `scripts/.outreach-log.jsonl`.
- **Template utilizzato**: quello pre-merge community store (mentions PR #11919 pending). Il template live nel repo è stato successivamente riscritto evergreen (solo BRAT, no PR reference) per future iterazioni — vedi commit `d25cf53`.
- **Deliberatamente NON commentate**:
  - **#27, #38** (indirect coverage): lasciate aperte per onestà intellettuale — non ho evidenza specifica che la install-path refactor di #28 risolva il loro caso, solo inferenza. Rischio content-integrity > beneficio marginale (2 issue extra su 26).
  - **#79**: meta-issue aperta da te stesso (fork announcement), self-comment non avrebbe senso.
- **Quando ri-fare outreach**: solo quando PR community store `obsidianmd/obsidian-releases#11919` viene mergiata, con template esteso per menzionare il community store. Comando: `python3 scripts/fork-outreach-comment.py run --force --execute` (il `--force` bypassa il log idempotente).
- **Monitoring**: GitHub manda notifiche su qualsiasi commento/chiusura dei 23 issue. Nelle 48-72 h dopo il batch, aspettarsi alcune chiusure spontanee da autori originali + eventualmente il maintainer upstream (se torna).

### C — Sync periodico con upstream
- **Effort**: 5 min per il check, ore se ci sono cose da cherry-pick
- **Scope**: `git fetch upstream && git log upstream/main --oneline -20` periodicamente. Storico: upstream è dormant, ma se il maintainer torna è bene saperlo.

### D — Pulizia operativa
- ✅ `*.bun-build` gitignored
- ✅ `docs/features/prompt-requirements.md` rimosso
- Rimasto opzionale: cancellare i 2 file `.bun-build` fisici (~118 MB), si rigenerano al prossimo build

### E — ~~Issue #59 full implementation (binary content types)~~ ✅ COMPLETATO 2026-04-21
- Rilasciato in **0.3.4**. Commit `6110b89`, merge `d037ed9`. Supporto nativo MCP image/audio content blocks, fallback text-metadata per tipi non supportati o oversize (10 MiB cap). 14 nuovi unit test + 5/5 smoke test PASS via `scripts/smoke-verify-binary.py`.

### F — Roadmap dopo il merge community store
- Una volta che la PR `obsidianmd/obsidian-releases#11919` è merged:
  - Aggiornare README rimuovendo "Once approved" e mettendo solo "Available in community store"
  - Aggiornare migration-from-upstream.md indicando il community store come opzione preferita
  - Considerare di aprire issues "good first issue" per attirare contributor (es. test Linux/Windows manuali, traduzioni, etc.)

---

## 7. File chiave da conoscere

| File | Cosa contiene |
|---|---|
| `handoff.md` | **Questo file** — sintesi operativa per cambio macchina |
| `CLAUDE.md` | Architettura, convenzioni, gotcha, snapshot fork — **leggere sempre dopo questo handoff** |
| `.clinerules` | Contratto autoritativo della feature architecture (più rigido di CLAUDE.md, raramente cambia) |
| `docs/design/issue-29-command-execution.md` | Design completo Fase 1+2+3 di #29, includendo il diario di Fase 2 |
| `docs/features/prompt-system.md` | Reference del sistema prompts (vault → MCP) |
| `docs/features/mcp-server-install.md` | Reference dell'installer flow |
| `docs/project-architecture.md` | Vista alto livello (allineato con `.clinerules`) |
| `docs/migration-plan.md` | Storico — può essere stantio, da verificare prima di seguire |
| `cline_docs/` | Directory per task records on-demand (workflow opzionale, non in uso attivo) |
| `packages/obsidian-plugin/src/main.ts` | Entry point del plugin Obsidian |
| `packages/mcp-server/src/index.ts` | Entry point del server MCP standalone |
| `packages/shared/src/types/plugin-local-rest-api.ts` | Schemi ArkType per le route HTTP del plugin |
| `packages/obsidian-plugin/src/features/command-permissions/` | Tutta Fase 1 + 2 di #29 |
| `scripts/smoke-test-binary.sh` | Smoke test fixture generator + vault uploader per il binary path di `get_vault_file` (macOS) |
| `scripts/smoke-verify-binary.py` | MCP client automatico che verifica i 5 casi del binary path — auto-discovery `OBSIDIAN_API_KEY` |
| `scripts/fork-outreach-comment.py` | Batch-commenta issue upstream risolte con pointer al fork. Default dry-run, `--execute` per inviare. Log idempotente in `scripts/.outreach-log.jsonl` |

---

## 8. Cosa NON fare

- **Non bumpare versione manualmente** — usare sempre `bun run version [patch|minor|major]`
- **Non committare `dist/`** — è gitignored, deve restarlo
- **Non usare npm/yarn/pnpm** — il monorepo è bun-only (vedi `bun.lock`)
- **Non modificare** `patches/svelte@5.16.0.patch` senza prima
  capire perché esiste (vedi gotcha in CLAUDE.md)
- **Non rimuovere** `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"`
  in `packages/mcp-server/src/.../makeRequest.ts` — rompe ogni
  chiamata server → Obsidian
- **Non importare valori runtime da `"obsidian"`** dentro
  `packages/shared/` — usare `import type`. Vedi gotcha
  `2c482a6` in CLAUDE.md.
- **Non assumere atomicità di `loadData`/`saveData`** —
  serializzare con un mutex (vedi
  `packages/obsidian-plugin/src/features/command-permissions/services/settingsLock.ts`)
  per ogni feature che fa load → modify → save sotto carico concorrente.
- **Non commit diretti su main** per cambiamenti non banali — usare
  feature branch + merge `--no-ff`

---

## 9. Riferimenti esterni

- **Issue tracker upstream**: https://github.com/jacksteamdev/obsidian-mcp-tools/issues
- **Discord MCP Tools**: invito nel README, canale `#maintainers`
- **Obsidian Local REST API**: https://github.com/coddingtonbear/obsidian-local-rest-api
- **MCP spec**: https://modelcontextprotocol.io
- **Jason Bates fork** (per cherry-pick storici): commit `8adb7dd`

---

*Documento mantenuto come riferimento operativo "ponte tra macchine".
Quando una sessione finisce o si chiude un blocco di lavoro
significativo, è ragionevole aggiornarlo con un changelog conciso
in cima alla sezione 5.*

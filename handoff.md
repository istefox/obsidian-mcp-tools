# Handoff — `istefox/obsidian-mcp-connector` (was `obsidian-mcp-tools`)

> **Aggiornato 2026-04-28 sera (sessione: 0.3.12 release + Dependabot policy v4 + 0.4.0 beta outreach + #58 fix + 6 stable-cut prep PRs).** Documento di passaggio di consegne
> tra macchine. Self-contained: dal clone iniziale al primo prompt
> da mandare a Claude Code sul nuovo Mac, qui c'è tutto.
>
> **Per il quadro architetturale completo** (gotcha, stack,
> convenzioni di codice): leggere **`CLAUDE.md`** in radice — è
> mantenuto aggiornato dopo ogni sessione significativa. Questo
> file è la sintesi *operativa*; CLAUDE.md è la sintesi *tecnica*.

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
- **Repo rinominato 2026-04-13 notte:** `istefox/obsidian-mcp-tools` → **`istefox/obsidian-mcp-connector`**. GitHub mantiene il redirect HTTP del vecchio URL ma il git remote locale è già aggiornato.
- **Plugin id rinominato:** `mcp-tools` → **`mcp-tools-istefox`** (perché l'id deve essere unico nel community store, e `mcp-tools` è ancora occupato dall'entry upstream).
- **Display name del plugin:** "MCP Connector".
- Branch attivo: **`main`**
- **Remote setup canonico:**
  - `origin` → `https://github.com/istefox/obsidian-mcp-connector.git` (push allowed, dove ship le release)
  - `upstream` → `https://github.com/jacksteamdev/obsidian-mcp-tools.git` (read-only, per fetch + cherry-pick)
  - `main` tracks `origin/main`
- **Ultimo commit su `main` (al momento di scrittura):** **`544afdc`** (`docs(handoff): refresh to 2026-04-28 (#57)`) sopra `ba4110e` (tag `0.3.12`). Working tree clean. Branch allineato con `origin/main`.
- **Branch attivo parallelo:** `feat/http-embedded` — HEAD **`6b461fc`** (`ci(test-site): dedup vite via package.json overrides (#65)`), tag `0.4.0-beta.1` su `2ff40a1`. **PROTECTED** — non mergiarla in main senza go-ahead esplicito (vedi `CLAUDE.md` "Branch protection policy"). **Stable-ready**: tutti i 6 work items deferred a stable cut sono completati (PR #56, #59, #60, #61, #62, #63, #64, #65). Il cut è 5 step manuali — vedi sezione 6 "A.bis — 0.4.0 stable cut" qui sotto.
- I 2 file `.bun-build` orfani (~118 MB totali) restano su disco ma sono gitignored.

### Release pubbliche
| Versione | Data | Note |
|---|---|---|
| **`0.3.12`** | 2026-04-28 | LATEST sulla 0.3.x line. Re-release di 0.3.11 (workflow failed su `bun install --frozen-lockfile` per drift introdotto dai merge Dependabot back-to-back) + i 3 fix originali: #19 (`message` field nel 503 di `/templates/execute`), #20 (`path` field nel success body), #21 (`OBSIDIAN_HOST` accetta sia hostname che URL completa, era upstream `jacksteamdev/obsidian-mcp-tools#84`). 7 asset, tutti i binari cross-platform. @folotp ha verificato #19 e #20 end-to-end. |
| `0.3.11` | 2026-04-28 | **Release rotta** — tag esiste, GitHub Release esiste, MA **0 asset**: workflow failed su `bun install --frozen-lockfile`. Lasciata pubblicata per coerenza con la branch protection policy (no re-pointing tags 0.3.x). 0.3.12 è la corretta. |
| `0.3.10` | 2026-04-26 | Diagnostic logging in `updateClaudeConfig` (motivato dal symptom #11 di @folotp); 8 nuovi regression test in `config.test.ts`. |
| `0.3.9` | 2026-04-26 | Fix EOF-append silente per `patch_vault_file` su root-orphan headings (heading half di #71). Throw `McpError(InvalidParams, ...)` con guidance sui due workaround. 12 regression test. |
| `0.3.8` | 2026-04-26 | Fix `search_vault_smart` HTTP 400 ("must be a string was an object") — `searchRequest` migrato da `string.json.parse` a parsed-object. Promosso a public export di `shared`. |
| `0.3.7` | 2026-04-24 | Fix block half di #71 (block targets default `createTargetIfMissing=false` → silent EOF-append fixed). |
| `0.3.6` | 2026-04-24 | Fix #81 (@folotp): `ApiNoteJson` schema accetta frontmatter array-valued (aliases, tags, up). |
| `0.3.5` | 2026-04-22 | Refresh `bun.lock` per `@types/bun 1.3.13`. Fix installer `GITHUB_DOWNLOAD_URL` (rispetta env var CI invece che hardcoded upstream). |
| `0.3.4` | 2026-04-21 sera | Native MCP image/audio content blocks in `get_vault_file` (issue #59 full implementation via PR #2). Smoke test harness aggiunto (`scripts/smoke-test-binary.sh` + `scripts/smoke-verify-binary.py`), 5/5 cases PASS. |
| `0.3.3` | 2026-04-21 pomeriggio | Fix upstream #66 (`OBSIDIAN_API_URL` ignorato), #63 (`additionalProperties: {}` rompe Letta), #37 (trailing slash → 500). |
| `0.3.2` | 2026-04-17 | Refactor interni: `McpServer` high-level API migration, extract `applySimpleSearchLimit`/`buildPatchHeaders`/`normalizeAppendBody`, regression pin per #62/#68/#41/#39. |
| `0.3.1` | 2026-04-13 notte | Manifest description corretta per community-store rules (drop "Obsidian", drop maintainer-attribution suffix). Rebuild dopo feedback reviewer-bot. |
| `0.3.0` | 2026-04-13 notte | First public release. Brand "MCP Connector". Tag eliminato e re-emesso dopo un mishap del version script che aveva prodotto 0.2.28. |

**Linea 0.4.0 (pre-release):**
| Versione | Data | Note |
|---|---|---|
| `0.4.0-beta.1` | 2026-04-27 | First beta. Closes Phase 4 dell'HTTP-embedded pivot (in-process MCP server su `127.0.0.1:27200`, no binary, native semantic search via MiniLM-L6-v2 ~25 MB, migration UX modal first-load, 3 "Copy config" Claude Desktop/Code/streamable-http, Node detection + Homebrew install + `mcp-remote` pre-warm). 528+ test verdi. End-to-end smoke validato in vault TEST. |
| `0.4.0-alpha.4` | 2026-04-26 | Fix Electron-WASM: `onnxruntime-node` redirected a `onnxruntime-web` per Transformers.js 2.17.2 nel renderer Electron. `search_vault_smart` con `provider="native"` ora funziona end-to-end. |
| `0.4.0-alpha.3` | 2026-04-26 | Fix critico stateless transport: `StreamableHTTPServerTransport` non riusabile, ora una nuova istanza per HTTP request (registry stays singleton). +123 test Phase 3. |
| `0.4.0-alpha.2` / `.1` | 2026-04-25 → 2026-04-26 | Phase 3 semantic search incrementale. |

URL release: https://github.com/istefox/obsidian-mcp-connector/releases

### Health
| | |
|---|---|
| `bun run check` (4 package) | ✅ passa |
| Test obsidian-plugin | ✅ **179 pass / 0 fail / 12 file** |
| Test mcp-server | ✅ **152 pass / 0 fail** (include 14 test nuovi per binary path in 0.3.4) |
| Smoke test integration (server ↔ Local REST API ↔ Obsidian) | ✅ **5/5 cases PASS** via `scripts/smoke-verify-binary.py` |
| Plugin prod build | ✅ |
| Server cross-compile (4 target: mac-arm64, mac-x64, linux, windows) | ✅ |
| GitHub Actions release.yml | ✅ esercitata (run 0.3.0 + 0.3.1 entrambe verdi) |

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

## 5. Cosa è stato fatto nella serie di sessioni (2026-04-09 → 2026-04-28)

In ordine cronologico inverso, con commit SHA su `origin/main` (eccetto dove indicato `feat/http-embedded`):

| Date approx | Lavoro | Commit/merge |
|---|---|---|
| 2026-04-28 tarda sera | **0.4.0 stable-cut prep (6 PR su `feat/http-embedded`)**: tutti i work items dichiarati come "deferred to stable cut" nel CHANGELOG di beta.1 sono ora chiusi. (1) **README rewrite** (PR #60, `fb70bd2`) — drop sezioni 0.3.x, lead con architettura HTTP-embedded, 3 Copy-config inline, MCP Inspector come verification path. (2) **CHANGELOG collapse** (PR #61, `d596318`) — 4 alpha + beta.1 entries (470 righe) collassate in unica `[0.4.0] — TBD` organizzata per phase. (3) **`release.yml` split** (PR #62, `c0261ae`) — release-line-aware: tag `0.3.*` → cross-platform mcp-server binary + SLSA attestation, altri tag → plugin-only. (4) **`toolToggle` UI nascosta** (PR #63, `9e38214`) — registry gating non wirato in 0.4.0; UI hidden, persistence intatta, follow-up post-stable. (5) **`McpServerInstallSettings.svelte` retired** (PR #64, `562c754`) — UI 654 righe deletata + `openFolder.ts`; services/constants/types kept perché `features/migration/` li usa per detection 0.3.x. (6) **Vite dedup via overrides** (PR #65, `6b461fc`) — `package.json` pinned `vite: 5.4.11`, fixa `svelte-check` type clash. **Stable cut ora richiede solo 5 step manuali** (vedi sezione 6 A.bis). | PR #60, #61, #62, #63, #64, #65 |
| 2026-04-28 sera | **#58 fix (Folotp design proposal accepted)**: `createTargetIfMissing` default flippato a `false` per `targetType: "heading"` su `patch_active_file`/`patch_vault_file`, simmetrico a v0.3.7 #6 per `block`. Argomento agent-caller-dominance: HTTP 200 EOF-append è indistinguibile da in-place patch senza post-write read, quindi silent-create è data corruption nel use case dominante. Per-target-type defaults dopo flip: heading → false (changed), block → false (unchanged), frontmatter → true (unchanged). 7 regression test in `patchVaultFile.test.ts`. `detectOrphanRootHeading` (v0.3.9 #16) sopravvive come defence-in-depth sul opt-in path. Ship: 0.4.0 stable cut, no beta.2 (decision B). | PR #59 (`b1e82e2`) su `feat/http-embedded` |
| 2026-04-28 sera | **Design note inline + port-forward 0.3.12 → 0.4.0**: comment block ancorato al sito `path: params.targetPath` in `handleTemplateExecution` che pinna la semantica @folotp's `tp.file.move()` seam (link diretto al suo commento). Stesso testo su `main` (PR #55, `0233d62`) e su `feat/http-embedded` (PR #56, `03331b0`) — quest'ultima include anche il port-forward di #19 (`message` field nel catch) e #20 (`path` field nel success) che mancavano sulla branch 0.4.0. @folotp ha verificato #19+#20 end-to-end con JSON repro post-merge. | `0233d62`, `03331b0` |
| 2026-04-28 pom | **0.4.0-beta.1 outreach**: aperta issue #54 sul fork ("0.4.0 beta — looking for testers (BRAT)") con label `0.4.0-beta`. Comment combinato su upstream `jacksteamdev/obsidian-mcp-tools#79` (status update + ping @juicyjonny). Comment su fork #19 con CTA al beta test (@folotp). Edit del release body di 0.4.0-beta.1 con sezione "🧪 Testers wanted" + link a #54. Stable cut targeted ~3-7g post-soak. | (issue #54 + 3 commenti pubblici) |
| 2026-04-28 pom | **0.3.12 release**: 3 fix shippati — #19 (PR #50: `message` field in 503), #20 (PR #50: `path` field in success), #21 (PR #51: `OBSIDIAN_HOST` accetta hostname o URL completa, originalmente upstream #84). Comment di chiusura issue su #19 e #20 a @folotp + comment su upstream #84 a @FiReCRaSHb (cross-link al fork). 0.3.11 release fallito su `bun install --frozen-lockfile`; 0.3.12 è la re-release con `bun.lock` allineato (PR #53). 7 asset cross-platform su 0.3.12. | `0bc87b2` (tag 0.3.11 broken), `ba4110e` (tag 0.3.12) |
| 2026-04-28 mat | **Dependabot setup, 4 iterazioni**: abilitato Dependency graph + Dependabot alerts/security/grouped/version updates dalla UI. Welcome-wave produsse 13 PR + 6 PR post-policy-v2; tutte chiuse con comment esplicativo + branch cancellate. **Policy v4** (`f845802` → `01dd8f4`): blanket `ignore [version-update:semver-major]` per tutti gli ecosystem + total-ignore per arktype/svelte/obsidian/`@modelcontextprotocol/sdk` (load-bearing pin reasons). 4 PR Dependabot legitime mergeate dopo policy v4: #44 (`@typescript-eslint/eslint-plugin` 5.29→5.62), #45 (`parser` 5.29→5.62), #48 (`prettier-plugin-tailwindcss` 0.6→0.8), #49 (vite 5.4→8.0 in `test-site`, security fix). Refresh `CLAUDE.md` versione (PR #22). | PR #22, #36, #43, #47, #44, #45, #48, #49, #53, #50, #51, #52, #55 |
| 2026-04-26 | **0.3.10**: diagnostic logging in `updateClaudeConfig` motivato dal symptom #11 (@folotp `mcpServers: {}` dopo Install) + 8 regression test (PR #17, #18). | `8804e56` |
| 2026-04-26 | **0.3.9**: fix root-orphan H2+ heading silent EOF-append in `patch_vault_file` (heading half di #71). 12 regression test (PR #16). | `3e6780f` |
| 2026-04-26 | **0.3.8**: fix `search_vault_smart` HTTP 400 — `searchRequest` parsed-object (PR #14). | `70a70d5` |
| 2026-04-26 → 2026-04-27 | **Linea 0.4.0 alpha → beta**: Phase 3 semantic search (provider tri-state, native MiniLM, embedder + chunker + store + indexer live/low-power, settings UI con tri-state, model download progress); fix critico transport stateless (alpha.3); fix Electron-WASM via `onnxruntime-web` redirect (alpha.4); Phase 4 migration UX modal + 3 "Copy config" + auto-write Claude Desktop config + Node detection + Homebrew install + `mcp-remote` pre-warm (beta.1). 528+ test. End-to-end smoke validato in vault TEST + Claude Desktop. | (su `feat/http-embedded`, vedi `git log feat/http-embedded`) |
| 2026-04-24 | **0.3.7**: block targets default `createTargetIfMissing=false` (block half di #71). | `6377302` |
| 2026-04-24 | **0.3.6**: `ApiNoteJson` accetta frontmatter array-valued (#81 @folotp). | `7523844` |
| 2026-04-22 | **0.3.5**: refresh `bun.lock` + fix installer rispetta `GITHUB_DOWNLOAD_URL`. | `5311075` |
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

In ordine di priorità potenziale per le prossime sessioni:

### A — Monitoraggio review PR community store
- **PR**: https://github.com/obsidianmd/obsidian-releases/pull/11919
- **Stato attuale**: "Ready for review", validation passed (~2 settimane di attesa al 2026-04-28)
- **Tempistica review umana**: 2-8 settimane tipiche
- **Cosa fare**: aspettare. Se ObsidianReviewBot o un maintainer chiede modifiche, rispondere con le iterazioni necessarie. Possibili request:
  - Modifiche al README
  - Modifiche al manifest
  - Code review issues
  - Supplementary docs
- **Notifiche**: GitHub manda email su qualsiasi commento sulla PR
- **Strategicamente**: il submission è per la 0.3.x (manifest 0.3.10 al momento dell'apertura PR). Se 0.4.0 stable atterra prima della review, valutare se aggiornare il submission a 0.4.0 (un solo cambio sostanziale) o aspettare la review su 0.3.x e bumpare dopo. Decidere caso per caso.

### A.bis — 0.4.0 stable cut (target ~2026-04-30 → 2026-05-04, soak post-beta.1)
- **Stato beta**: `0.4.0-beta.1` pubblicata 2026-04-27. Issue #54 raccoglie feedback BRAT testers. Outreach @folotp / @juicyjonny / @FiReCRaSHb fatto 2026-04-28.
- **6 work items deferred a stable cut: TUTTI COMPLETATI 2026-04-28 sera** sulla branch `feat/http-embedded`:
  - ✅ **README rewrite** — PR #60, `fb70bd2`
  - ✅ **CHANGELOG collapse** — PR #61, `d596318`
  - ✅ **`release.yml` split** release-line-aware — PR #62, `c0261ae`
  - ✅ **`toolToggle` UI nascosta** (decisione: B = hide UI, keep persistence) — PR #63, `9e38214`
  - ✅ **`McpServerInstallSettings.svelte` retired** — PR #64, `562c754`
  - ✅ **Vite type clash fix** (preesistente sul branch) — PR #65, `6b461fc`
- **Decisione aperta nessuna**: `toolToggle` chiuso come hide UI (vedi PR #63), tutti gli altri work items chiusi.
- **Test pre-stable consigliati** (non bloccanti — i 528+ test esistenti sono già verdi su `feat/http-embedded`):
  - Vault realistici (>1k note) — soak naturale via beta-tester
  - Proxy aziendali per `mcp-remote` — solo Claude Desktop path, dipende da Node setup utente
  - Cold-start migration da 0.3.x reale — in TEST + Lab
  - Windows/Linux smoke — oggi solo macOS è stato validato e2e
- **Soak strategy**: B = no beta.2, soak della beta.1 per 3-7g, ship stable quando timer scade. Soak time conta sul tag pubblicato, non sull'HEAD del branch — mergere su `feat/http-embedded` non resetta il soak.
- **Steps per il cut** (5 manuali, ~5min):
  1. `git checkout feat/http-embedded && git pull`
  2. CHANGELOG: spostare contenuto `[Unreleased]` (nota fix #58) dentro `[0.4.0]`, sostituire `TBD` con la data
  3. Manual version bump (lo script `bun run version` non supporta switch out-of-prerelease semver): `package.json`, `manifest.json`, `versions.json` (aggiungere `"0.4.0": "1.7.7"`)
  4. `git commit -am "0.4.0" && git tag 0.4.0`
  5. `git push origin feat/http-embedded 0.4.0` — il workflow `release.yml` (PR #62) builda plugin-only, upload `manifest.json` + `main.js` + `obsidian-plugin-0.4.0.zip` come asset
- **Branch protection**: per il merge `feat/http-embedded → main` serve go-ahead esplicito (rule "Never merge feat/http-embedded into main" in `CLAUDE.md`). Quando deciderai di cuttare la 0.4.0 è naturale anche fare il merge su main: dopo aver pushato il tag, fare PR `feat/http-embedded` → `main` con descrizione "0.4.0 stable cut", poi il main diventa la linea 0.4.x e una nuova branch `bugfix/0.3.x` (o equivalente) può ospitare future hotfix 0.3.13/etc.
- **Community store**: una volta che 0.4.0 è in main + tag pubblico, basta un commento su `obsidianmd/obsidian-releases#11919` con "manifest updated to 0.4.0, please re-validate" per rilanciare il giro lint. Il submission shape (`mcp-tools-istefox`, "MCP Connector") è forward-compatible.

### B — ~~Fase 4 outreach — annuncia il fork sulle issue upstream risolte~~ ✅ COMPLETATO 2026-04-21

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
- **Scope**: `git fetch upstream && git log upstream/main --oneline -20` periodicamente.
- **Stato 2026-04-28**: upstream è **ufficialmente unmaintained** dal 2026-04-24 (issue #79, commit `8bbca65` aggiunge la nota "unmaintained"; release `0.2.28-0.2.31` shipano solo quella nota + un single `import type` shared-package fix che il fork ha già). jack ha esplicitamente offerto link nel README upstream a qualsiasi successor plugin che (a) usi MCP-over-HTTP e (b) sia nel community store. Roadmap conseguente per il fork: 0.4.0 stable + community-store merge → claim del README link.
- **Sync effective**: scendi a "monitoring only" — non aspettarti commit nuovi upstream. Se appare attività rilevante (es. una sec advisory che riguarda anche il fork), gestire caso per caso.

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

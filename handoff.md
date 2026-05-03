# Handoff — `istefox/obsidian-mcp-connector` (was `obsidian-mcp-tools`)

> **Aggiornato 2026-05-03 pomeriggio (post-beta.3 cut + decisione Glama listing).** Documento di passaggio di consegne. Self-contained: dal clone iniziale al primo prompt da mandare a Claude Code, qui c'è tutto.
>
> **Per il quadro architetturale completo** (gotcha, stack, convenzioni di codice): leggere **`CLAUDE.md`** in radice. Questo file è la sintesi *operativa*; CLAUDE.md è la sintesi *tecnica*.

---

## Decisioni di sessione 2026-05-03

- **`0.4.0-beta.3` cut** (commit `bbc1289`, tag pushato, CI release verde, marcato prerelease). Bundle PR #75 = #73 (compat shim `POST /templates/execute` 404) + #74 (registry-level `isError` hoist per double-prefix). Folotp pingato su #54 con scope round 3. Stato: in attesa retest.
- **Cross-link reciproco DT-MCP ↔ fork Obsidian** nei README. Sul fork: commit `dcacaa1` su `feat/http-embedded` ("Other MCP servers by istefox" → linka `istefox-dt-mcp`, pointer-only). Sul DT-MCP: PR #41 `docs/glama-listing-and-cross-link` (badge Glama + reciproco). Cross-link è branding/discoverability puro, non propedeutico a Glama listing del fork.
- **Glama listing del fork — RINVIO A FASE B (post-store-accept).** Listing è tecnicamente possibile (registry indicizza repo GitHub, esponendo tools/schema), ma il badge `Official` no: il fork 0.4.0 è plugin in-process Electron, non server stdio standalone runnable nel sandbox `/app` di Glama. Listing senza badge resta valore (presence in 22k server registry, profilo `istefox` verificato), ma aggiungerlo durante review store #11919 introduce un'altra dipendenza esterna da monitorare. Coerente con anti-tattica "no Reddit/Twitter pre-store-accept": un evento per volta. **Riapre come Fase B**, non scartato. Correggo la mia precedente affermazione "non vale lo sforzo" che era basata su lettura troppo categorica delle policy Glama.
- **EXDEV-oss su #54 — replica terminale postata** (`comment 4366414002`, opzione B della lista opzioni). Il "rate limiter reset on client reconnect" del suo finding 14:29Z è architetturalmente impossibile (rate limiter è tumbling window module-global wall-clock-keyed, transport stateless senza nozione di "client"); confutato citando `rateLimit.ts:32-49` + invariante stateless transport, richiesto repro con commit SHA + sequenza request + timestamp. Il commento aveva frontmatter leak `:::writing{variant="chat_message" id="93147"}` + smart quotes + JSON malformato → conferma alta-confidenza pattern AI-template engagement già documentato in memoria. Aspettare drop-off; se doubled-down con altro template, valutare lock #54 dopo round 3 folotp.

---

## 🚦 Quick Start — apertura sessione (Warp o qualsiasi terminale)

**Branch attivo:** `feat/http-embedded` (NON `main`). Versione: **0.4.0-beta.2** (rilasciata 2026-04-29 mattina, commit `1013d11`). Working tree pulito, allineato con `origin`.

**Stato dei due track:**
- `main` = **0.3.12** stabile, BRAT-distribuito, 20 tool, intoccabile (vedi § Branch protection in CLAUDE.md). Tre fix shippati 2026-04-28: #19 (templates/execute error message), #20 (path field in success), #21 (`OBSIDIAN_HOST` accetta URL).
- `feat/http-embedded` = **0.4.0-beta.2**. **Phase 1+2+3 chiuse, Phase 4 chiusa eccetto T14 (stable cut)**. Beta.1 soak (folotp, 2026-04-28) ha trovato **4 regressioni reali** vs 0.3.x — tutte chiuse in PR #69 → tag beta.2.

**Prossimi passi concreti (in ordine):**

1. **🔴 Soak beta.2 → beta.3.** Folotp è tornato presto (2026-05-01 03:49 UTC, non venerdì come annunciato): tutti e 4 i fix targeted **verified** (#12, #13 directly; #19, #20 indirettamente perché bloccati da #73), MA ha aperto **#73** = nuova regressione `execute_template` HTTP 404 (root cause: residuo binary 0.3.x lato user — non è bug del plugin in-process). Più 2 side observations: #74 = double-prefix leak strutturale (bundling con #73 in beta.3), e dead-code DWIM branch (deferito 0.4.1).
2. **🟡 0.4.0-beta.3 cut** (gated sul retest folotp dei due fix): branch `fix/73-templates-execute-compat-shim` ha già **entrambi** i fix committati (`3dd9bda` compat shim + `d1958b2` registry isError) — bundle in unico PR per beta.3. **Sequenza**: push branch → apri PR su `feat/http-embedded` → merge dopo review → bump manuale `0.4.0-beta.3` (package/manifest/versions) → tag + push → CI release → comment su #54 con BRAT pin "test these against beta.3".
3. **T14 — 0.4.0 stable cut** (gated su sign-off folotp post-beta.3): finalize CHANGELOG (move `[Unreleased] #58` entry to `[0.4.0]`, sostituisci `TBD` con la data) → bump manuale `package.json`+`manifest.json`+`versions.json` a `0.4.0` (lo script bun version non supporta pre-release semver, vedi memory) → commit `0.4.0` → tag → push → release CI → comment su PR Store #11919 ("manifest updated to 0.4.0, please re-validate").
4. **Outreach jacksteamdev** (Discord DM + README PR upstream) **gated su community store acceptance**, non sulla cut.

**Cosa è stato chiuso dopo la beta.1 (sessioni 2026-04-28 → 2026-04-29):**
- **6 PR di stable-cut prep** (2026-04-28 sera): #56 port-forward 0.3.12 fixes su `feat/http-embedded`, #59 fix #58 (heading createTargetIfMissing default flip), #60 README rewrite per 0.4.0, #61 CHANGELOG collapse alpha+beta in `[0.4.0] — TBD`, #62 release.yml split tag-prefix-aware (binari solo per `0.3.*`, plugin-only per il resto), #63 hide toolToggle UI (registry gating non wired), #64 retire `McpServerInstallSettings.svelte` + `openFolder.ts`, #65 vite dedup via package overrides (fix svelte-check CI failure).
- **Soak folotp 2026-04-28**: end-to-end macOS arm64 / Obsidian 1.12.7 / LRA 3.6.1 + mcp-inspector. Migration uneventful, transport+native semantic search funzionano. Surfaceate **4 regressioni reali** dai tool handler in-process (riscritti da zero in 0.4.0, non port 1:1, mancavano hardening 0.3.8 / 0.3.12) + 2 polish.
- **PR #69** (`4c495d4`, 2026-04-29): folotp post-beta.1 batch — fix #12 (replace array→scalar silent corruption), #13 (append/prepend array structure flattening, peggio dell'originale), #19 (double-prefix error), #20 (missing `path` in execute_template response) + heading replace blank-line + `get_vault_file format:json` stat field.
- **Tag `0.4.0-beta.2`** (`1013d11`, 2026-04-29 06:24 UTC): bump manuale package/manifest, push, CI release.yml verde 45s. Asset shippati: `main.js` + `manifest.json` + `obsidian-plugin-0.4.0-beta.2.zip` (914 KB). Plugin-only confermato (split #62 funziona).
- **Outreach beta.2 su #54** (2026-04-29 06:25 UTC): pingato folotp con summary "fixed in beta.2 commit 1013d11" + 6 fix. Folotp risponde 15:21 UTC che è "away until Friday".

**Nuovo attore su #54 da monitorare:**
- **@EXDEV-oss** (2026-04-29 17:15 UTC): domanda generica su prompt injection / data leakage. Hai risposto col threat model. Lui ha proposto di spostarsi su Telegram (`@plotcrypt`) per "test logs strutturati"; declinato fermo "GitHub + GHSA per exploitable". Lui poi: "ok faccio first pass qui" (19:52 UTC) — nessun finding. Confidenza media che sia social engineering low-effort. Solo da monitorare.

**Routine remote attive (cloud Anthropic, indipendenti dal terminale):**
- `trig_01UC96J5aCxLJwD4meBCDWtm` — **2026-04-30 07:00 UTC one-shot** (oggi ~09:00 Rome), decision check GO/WAIT/FIX per 0.4.0 stable cut. Atteso WAIT visto che folotp retesta venerdì.
- `trig_015yL8D3VNao7nhRKjBu95ZK` — Lun 07:00 UTC, monitor PR store #11919.
- `trig_01Dx8sZTD78yBj7buuVYP9KE` — orario, watch issue #79.

**Primo prompt suggerito alla nuova sessione:**
> "Leggi `handoff.md` e `CLAUDE.md`. Siamo a 0.4.0-beta.2 (commit `1013d11`, 2026-04-29) con branch `fix/73-templates-execute-compat-shim` pronto per beta.3 (compat shim #73 + registry isError #74, 4/4 test verdi). Folotp ha retestato beta.2 il 2026-05-01 03:49 UTC: 4/4 fix targeted verified, ma ha aperto #73 (nuova regressione `execute_template` 404). Triage in commento `4358460658` chiede 2 check di repro (jq config + ls binary path) per confermare diagnosi (residuo binary 0.3.x lato user, non bug plugin). Controlla #73 per nuovi comment di folotp dal 2026-05-01 ~04:00 UTC. Se conferma diagnosi: push branch + PR + bump beta.3 + comment su #54. Se falsifica: digging ulteriore prima di mergiare. Nel frattempo #74 è già implementato e bundlato; resta solo coperta la #73 hypothesis."

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
  - `main` = **0.3.12** stabile (PROTETTO, intoccabile)
  - `feat/http-embedded` = **0.4.0-beta.2** (Phase 1+2+3+4 closed except T14 stable cut; soak round 2 in corso, gating su sign-off folotp 2026-05-01)
- **Remote setup canonico:**
  - `origin` → `https://github.com/istefox/obsidian-mcp-connector.git`
  - `upstream` → `https://github.com/jacksteamdev/obsidian-mcp-tools.git` (read-only, dichiarato unmaintained 2026-04-24)
- **Ultimo commit pushato su `feat/http-embedded` (2026-04-29 mattina):** **`1013d11`** (`0.4.0-beta.2`). Tag `0.4.0-beta.2` sullo stesso commit.
- **Note CLI**: `gh` di default risolve sul remote `upstream` (jacksteamdev/obsidian-mcp-tools) — usare sempre `gh ... --repo istefox/obsidian-mcp-connector` per release/run/issue del fork.
- I 2 file `.bun-build` orfani (~118 MB totali) restano su disco ma sono gitignored.

### Release pubbliche
| Versione | Data | Note |
|---|---|---|
| **`0.4.0-beta.2`** | 2026-04-29 mattina | Pre-release sul branch `feat/http-embedded` (commit `1013d11`). Folotp post-beta.1 fix batch (PR #69): #12 replace array→scalar, #13 append/prepend array structure flattening, #19 double-prefix error message, #20 missing `path` in execute_template response + heading replace blank-line + `get_vault_file format:json` stat field. Asset plugin-only (split #62): `main.js` + `manifest.json` + zip 914KB, no binari mcp-server. 528+ test verdi. **Soak round 2 in corso, gating la stable cut.** |
| `0.4.0-beta.1` | 2026-04-27 mattina | Pre-release. Phase 4 closed. In-process MCP server `127.0.0.1:27200`, no binary, native semantic search MiniLM-L6-v2, automatic 0.3.x→0.4.0 migration via first-load modal. Smoke E2E vault TEST + Claude Desktop via `npx mcp-remote` validato. **Soak folotp 2026-04-28 ha trovato 4 regressioni** → fixate in beta.2. |
| `0.4.0-alpha.4` | 2026-04-26 | Phase 3 fix: `bun.config.ts` redirect onnxruntime-node→onnxruntime-web per Electron renderer. Native semantic search end-to-end verificato in vault TEST. |
| `0.4.0-alpha.3` | 2026-04-26 | Phase 3 — semantic search nativo via Transformers.js + Xenova/all-MiniLM-L6-v2 (384-dim, ~25MB quantized, lazy download al primo uso). |
| `0.4.0-alpha.2` | 2026-04-25 pomeriggio | Phase 2 completa: tutti e 20 i tool registrati. Fix `string.url` → `string` in `tools/fetch.ts`. 351 test. |
| `0.4.0-alpha.1` | 2026-04-25 mattina | Phase 1: HTTP infrastructure, Bearer auth, Origin validation, smoke tool `get_server_info`. |
| **`0.3.12`** | 2026-04-28 | LATEST stable su `main`. Re-release di 0.3.11 con lockfile aligned (CI fail su frozen lockfile). Fix #19 (templates/execute error `message`), #20 (path in success), #21 (`OBSIDIAN_HOST` URL forms). Verificato end-to-end da @folotp. |
| `0.3.11` | 2026-04-28 | Tag con assets vuoti (CI fail). Sostituito da 0.3.12. Tag NON re-pointato per branch protection. |
| `0.3.10` | 2026-04-26 | Diagnostic logging fix #11 (install location toggle bug). |
| `0.3.9` | ~2026-04-25 | `detectOrphanRootHeading` (#16). |
| `0.3.8` | ~2026-04-25 | Frontmatter ops corruption fix #12/#13 (folotp report). |
| `0.3.7` | 2026-04-24 | Patch fix #71/#81 (block gap fix). |
| `0.3.6` | 2026-04-24 | Block reference patch gap. |
| `0.3.5` | 2026-04-24 | Fix installer 404 (#3, @Metal0gic). |
| `0.3.4` | 2026-04-21 sera | Native MCP image/audio content blocks (#59). |
| `0.3.3` | 2026-04-21 pomeriggio | Fix upstream #66 / #63 / #37. |
| `0.3.2` | 2026-04-17 | Migration `Server` → `McpServer` SDK 1.29.0. |
| `0.3.1` | 2026-04-13 notte | Manifest description per community-store rules. |
| `0.3.0` | 2026-04-13 notte | First public release. Brand "MCP Connector". |

URL release: https://github.com/istefox/obsidian-mcp-connector/releases

### Health (snapshot 2026-04-30 mattina, branch `feat/http-embedded` @ `1013d11`)
| | |
|---|---|
| `bun run check` (4 package) | ✅ passa (verificato pre-tag beta.2) |
| Test obsidian-plugin | ✅ **528+ pass / 0 fail** (Phase 1+2+3+4 completi + folotp post-beta.1 batch) |
| Test mcp-server | ✅ legacy ~152 pass — il package non viene shippato in 0.4.0 ma è vivo per `main` |
| Plugin prod build | ✅ |
| Server cross-compile | ⚠️ irrilevante per 0.4.0 (architettura HTTP-embedded elimina il binary) |
| GitHub Actions CI | ✅ run `25094090499` su `feat/http-embedded` 30s |
| GitHub Actions Release.yml | ✅ run `25094137700` su tag `0.4.0-beta.2` 45s, plugin-only assets |
| Release.yml split (#62) | ✅ tag `0.3.*` → binari mcp-server + SLSA; altri tag → plugin-only. Verificato su beta.2. |

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

## 5. Cosa è stato fatto nella serie di sessioni (2026-04-09 → 2026-04-29)

In ordine cronologico inverso, con commit SHA. Il prefisso branch è esplicito quando non è `main`.

| Date approx | Lavoro | Commit/merge |
|---|---|---|
| 2026-04-29 mattina | **0.4.0-beta.2 cut (`feat/http-embedded`)** — bump manuale `package.json` + `manifest.json` da `0.4.0-beta.1` a `0.4.0-beta.2`, `versions.json` non toccato (lo script `bun run version` non supporta pre-release semver). Tag `0.4.0-beta.2` su commit di bump. Push branch + tag. CI run `25094090499` (CI verde 30s) + release run `25094137700` (release.yml verde 45s, plugin-only assets confermati: `main.js` + `manifest.json` + `obsidian-plugin-0.4.0-beta.2.zip` 914KB). Pre-release pubblicata 2026-04-29T06:24:40Z. **Outreach beta.2 su issue #54** alle 06:25 UTC: ping a @folotp con summary 6 fix; risposta sua 15:21 UTC "Away from home until Friday. Will retest first thing when I get back." | branch `feat/http-embedded` — `1013d11` |
| 2026-04-29 mattina | **PR #69 — folotp post-beta.1 batch** — chiude le 4 regressioni reali trovate da @folotp nel soak end-to-end della beta.1 (2026-04-28). Tutti dovuti a fresh writes nei tool handler in-process di 0.4.0 che non hanno portato l'hardening 0.3.8/0.3.12: **#12** replace array→scalar (silent corruption regressed), **#13** append/prepend array structure flattening (peggio dell'originale), **#19** double-prefix error message in `/templates/execute` 503 path, **#20** missing `path` in execute_template createFile success response. Più 2 polish: heading replace ate blank line + `get_vault_file format:json` missing `stat`. Hint critico di folotp: `contentType` non più sullo schema in 0.4.0 → root cause del patcher branch. | branch `feat/http-embedded` — merge `4c495d4` (PR #69) |
| 2026-04-28 sera | **Stable-cut prep batch (6 PR su `feat/http-embedded`)** — preparazione architetturale alla 0.4.0 stable cut. (1) **PR #56** port-forward 0.3.12 fixes (#19/#20) su `feat/http-embedded`; design note `tp.file.move()` semantics anchored inline con link al comment folotp. (2) **PR #59** — fix #58: flip `createTargetIfMissing` default a `false` per `targetType: "heading"` (mirror 0.3.7 #6 per `block`). (3) **PR #60** README rewrite per 0.4.0: drops 0.3.x sections, leads con HTTP-embedded architecture, 3 Copy-config snippet verbatim, MCP Inspector per verification. (4) **PR #61** CHANGELOG collapse: 4 alpha + beta.1 entries (470 linee) consolidate in `[0.4.0] — TBD` per phase. (5) **PR #62** release.yml split tag-prefix-aware: `0.3.*` → mcp-server binari + SLSA; altri tag → plugin-only. (6) **PR #63** hide toolToggle UI (registry gating non wired in 0.4.0; persistence preservata). (7) **PR #64** retire `McpServerInstallSettings.svelte` (654 linee) + `openFolder.ts`; `services/`, `constants/`, `types.ts` mantenuti perché `features/migration/` ne ha bisogno per legacy 0.3.x detection. (8) **PR #65** vite dedup via `package.json` overrides (pin `vite: 5.4.11`) — fix svelte-check CI failure. | branch `feat/http-embedded` — `b1e82e2`, `fb70bd2`, `d596318`, `c0261ae`, `9e38214`, `562c754`, `6b461fc`, `03331b0` |
| 2026-04-28 sera | **Soak folotp 0.4.0-beta.1 (esterno)** — end-to-end macOS arm64 / Obsidian 1.12.7 / LRA 3.6.1 + mcp-inspector verification. Migration uneventful. Surfaceate 4 regressioni reali + 2 polish. Soak strategy validata: il pivot "no beta.2, soak diretto su beta.1" è stato invalidato; nuovo gate "beta.2 + fresh soak round 2 con sign-off folotp" prima della stable cut. | (esterno, vedi issue #54) |
| 2026-04-28 mattina | **0.3.12 su `main`** — re-release di 0.3.11 con lockfile aligned (CI fail su `bun install --frozen-lockfile`). Fix #19 + #20 (templates/execute) + #21 (`OBSIDIAN_HOST` URL forms; era upstream `jacksteamdev/obsidian-mcp-tools#84`). 0.3.11 ha asset vuoti, NON re-pointato per branch protection. Verificato end-to-end da @folotp post-merge. | tag `0.3.11`, `0.3.12` (`ba4110e`) |
| 2026-04-27 sera | **T12.c + T12.d UX redesign (`feat/http-embedded`)** — `808c052` Tool toggle UX (`applyDisabledToolsFilter` + checkbox grid + 20 KNOWN_MCP_TOOL_NAMES). `4cc8ae3` Command Permissions UX (chip-list "allowed-first" + search Enter fast-path + preset row inline + browse raggruppato + stale entries section + destructive nudge ⚠ + Refresh registry). 2 nuovi pure helper + 11 unit test. | branch `feat/http-embedded` — `808c052`, `4cc8ae3` |
| 2026-04-27 mattina | **0.4.0-beta.1 cut (`feat/http-embedded`, T13)** — Phase 4 closed. Smoke E2E vault TEST + Claude Desktop reale via `npx mcp-remote` validato. CI release run `24978026319` verde. Outreach test cohort: @folotp (fork #19 ping + #54 thread), @juicyjonny (upstream #79), @FiReCRaSHb (upstream #84), tutti 2026-04-28. | branch `feat/http-embedded` — tag su `2ff40a1` |
| 2026-04-26 | **0.4.0-alpha.3 + alpha.4 (`feat/http-embedded`)** — Phase 3 semantic search nativo: `@xenova/transformers` ONNX runtime WASM + `Xenova/all-MiniLM-L6-v2` (384-dim, ~25MB quantized, lazy download). Alpha.4 fix `bun.config.ts` redirect onnxruntime-node→onnxruntime-web per Electron renderer. End-to-end verificato in vault TEST. | branch `feat/http-embedded` — tag `0.4.0-alpha.3`, `0.4.0-alpha.4` |
| 2026-04-25 pomeriggio | **Phase 2 finalizzazione + 0.4.0-alpha.2 + CI Node 24 bump (`feat/http-embedded`)** — sessione di chiusura Phase 2: (1) trovato bug silente in `tools/fetch.ts` con un probe schema-by-schema — `type("string.url")` di ArkType usa `predicate: isParsableUrl`, non convertibile in JSON Schema → `registry.list()` crashava, SDK MCP rispondeva `tools: []` (commit `4cfda35`); (2) **T23** registrazione di tutti e 20 i tool in `mcp-tools/index.ts` + 2 type tweak collaterali (`deleteActiveFile.ts` `Record<string,never>` → `object` per matchare il vincolo `ToolRegistry`, `getVaultFile.ts` semplificazione `extension`) (commit `2712367`); (3) **T24** release `0.4.0-alpha.2` — bump 3 file versione + CHANGELOG entry, commit + tag + push, CI release.yml verde in 44s (commit `27311e5`); (4) **CI Actions bump a Node 24**: `actions/checkout@v4 → @v6`, `softprops/action-gh-release@v1 → @v3`, `actions/attest-build-provenance@v2 → @v4`, `actions/github-script@v7 → @v9` per chiudere il deprecation warning Node 20; validato con tag throwaway `ci-validate-2026-04-25` (CI verde 46s, tag/release cancellati a fine validazione) (commit `eba555c`). 351 test verdi end-to-end. | branch `feat/http-embedded` — `4cfda35`, `2712367`, `27311e5`, `eba555c` |
| 2026-04-25 mattina/pomeriggio | **Phase 2 batches B3+B4 (`feat/http-embedded`)** — port di 8 tool a colpi di subagent paralleli: `list_obsidian_commands` (`25e10c4`), `get_vault_file` con binary blocks nativi (`41cee32`), `patch_active_file` (`1afe78d`), `search_vault_simple` (`8723483`), `fetch` con `requestUrl`+Turndown (`ec22778`), `patch_vault_file` (`adc4ea4`), `search_vault` con fallback Local REST API (`de87b3b`), `search_vault_smart` via Smart Connections API (`bfcf246`), `execute_template` via Templater API (`12bf469`), `execute_obsidian_command` con permission + rate limit (`28c95d2`). 351 test totali verdi. **T23 + T24 chiusi nella sessione successiva** (vedi riga sopra). | branch `feat/http-embedded` — vedi `git log feat/http-embedded ^main --oneline` |
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

In ordine di priorità per le prossime sessioni (focus: chiudere la 0.4.0 stable cut):

### A — 🔴 Soak round 2 su 0.4.0-beta.2 (gating la stable cut)

- **Stato**: folotp ha ricevuto il ping il 2026-04-29 06:25 UTC con summary delle 6 fix; ha risposto 15:21 UTC dichiarando "Away from home until Friday. Will retest first thing when I get back." → retest atteso **2026-05-01**.
- **Cosa cercare** nei suoi findings: ripro green dei 4 casi #12 (replace array→scalar), #13 (append/prepend array structure flattening), #19 (double-prefix error message), #20 (missing `path` in execute_template) + i 2 polish (heading replace blank-line + `get_vault_file format:json` stat field).
- **Sblocco**: sign-off esplicito ("all four reproductions clear") = via libera per T14.
- **Se trova nuove regressioni**: branch `fix/0.4-beta.3-...` da `feat/http-embedded`, PR, merge, tag `0.4.0-beta.3`, nuovo soak round. Branch protection invariant: mai mergiare in main.

### B — T14: 0.4.0 stable cut (gated su sign-off folotp)

Sequenza precisa (lo script `bun run version` non gestisce pre-release semver, quindi è manuale fino al bump finale):

1. **Pre-cut port-forward (doc-only, safe da fare anche durante soak)** — su `feat/http-embedded` mancano 5 entry 0.3.x già presenti su `main`. Port-forward:
   - `CHANGELOG.md`: copia le sezioni `[0.3.12]` `[0.3.11]` `[0.3.10]` `[0.3.9]` `[0.3.8]` da `main` (`git show main:CHANGELOG.md`), inseriscile tra `[0.4.0] — TBD` e `[0.3.7]`.
   - `versions.json`: aggiungi le 5 entry `"0.3.8"`–`"0.3.12"` ognuna `"0.15.0"`. Si trovano in `git show main:versions.json`.
   - Branch dedicato + PR (consigliato per audit trail), o commit diretto su `feat/http-embedded`.
2. **CHANGELOG finalize**: sposta la entry `[Unreleased] #58` dentro `[0.4.0]` (sezione `### Changed` esistente), sostituisci `TBD` con la data del cut. La sezione `### Fixed (post-0.4.0-beta.1 batch — folotp soak)` è già presente.
3. **Bump manuale a 0.4.0**:
   - Root `package.json` → `"version": "0.4.0"`
   - Root `manifest.json` → `"version": "0.4.0"` (manifest è in repo root, NON in `packages/obsidian-plugin/`)
   - Root `versions.json` → aggiungi `"0.4.0": "0.15.0"` (NON `1.7.7` — `minAppVersion` è sempre stata `0.15.0`; tutti gli entry storici puntano a `0.15.0`).
4. **Commit + tag + push**: `git commit -m "0.4.0"`, `git tag 0.4.0`, `git push origin feat/http-embedded` + `git push origin 0.4.0`.
5. **Release CI** (release.yml split #62): tag non `0.3.*` → plugin-only artifacts. Verifica run su `gh run list --repo istefox/obsidian-mcp-connector`.
6. **Comment su PR #11919**: testo tipo "manifest updated to 0.4.0, please re-validate" per retriggerare il lint del community store.

### C — Outreach @jacksteamdev (gated su community store acceptance)

- Eseguire **solo quando**: (a) PR #11919 mergiata AND (b) 0.4.0 LATEST stabile sul fork.
- Carico: Discord DM (canale `#maintainers` o DM diretto) + PR contro `jacksteamdev/obsidian-mcp-tools` che aggiorna README linkando il fork. Match condizione issue #79.
- Routine `trig_015yL8D3VNao7nhRKjBu95ZK` (Lun 07:00 UTC) notifica su attività della PR Store.

### D — Monitoraggio passivo (routine già attive)

- **PR store #11919**: settimanale via `trig_015yL8D3VNao7nhRKjBu95ZK`.
- **Issue #79 upstream**: orario via `trig_01Dx8sZTD78yBj7buuVYP9KE`.
- **Decision check stable cut**: one-shot `trig_01UC96J5aCxLJwD4meBCDWtm` su 2026-04-30 07:00 UTC. Output da leggere all'apertura sessione.
- **Sync upstream**: `git fetch upstream` periodicamente; jacksteamdev è frozen dal 2026-04-24 ma if-resumed-flag.

### E — ⚠️ EXDEV-oss su issue #54 (monitorare, non agire)

Apparso 2026-04-29 17:15 UTC con domanda generica su prompt injection / data leakage. Pattern: domanda vaga → push off-platform Telegram (`@plotcrypt`) → declinato → "ok faccio first pass qui" (19:52 UTC) → nessun finding effettivo. Confidenza media che sia social engineering low-effort. Azione: solo monitor. Se posta findings reali, valuti nel merito; se torna a chiedere off-platform o private channels, non rispondere.

### F — Test 0.4.0-beta.2 in Obsidian (procedura manuale, post-build)

Per validazioni locali in vault TEST/Lab durante un'eventuale beta.3 o pre-cut sanity-check:

1. **Build del plugin** sul branch `feat/http-embedded`:
   ```bash
   git checkout feat/http-embedded
   bun install
   cd packages/obsidian-plugin && bun run build
   ```
   Output: `main.js` + `styles.css` in `packages/obsidian-plugin/` (NON in `dist/`).
2. **Symlink in vault TEST** (se non già presente):
   ```bash
   REPO=~/Developer/Obsidian_MCP/obsidian-mcp-connector
   mkdir -p ~/Obsidian/TEST/.obsidian/plugins
   ln -s "$REPO/packages/obsidian-plugin" ~/Obsidian/TEST/.obsidian/plugins/mcp-tools-istefox
   ```
3. **Riavviare Obsidian** → Settings → Community plugins → disable+re-enable "MCP Connector" per ricaricare. Settings del plugin → sezione "Access Control" → copia il Bearer token.
4. **Verifica HTTP up**: `curl -s http://127.0.0.1:27200/healthz` (o porta successiva 27201-27205; controlla console Obsidian per la porta effettiva).
5. **Connettere Claude Desktop** via `npx mcp-remote`:
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
6. **In Claude Desktop**: "lista i tool MCP disponibili" → atteso 20 tool. Verifica `get_active_file`, `search_vault_simple`, `execute_template`, `search_vault_smart` (semantic native, primo uso scarica MiniLM ~25MB).
7. **Logging**: console developer Obsidian `Cmd+Opt+I`. 401 = token sbagliato; 403 Origin = origin non loopback.

### G — 🟡 Gotcha operativo 0.4.0: port drift + Claude Desktop config staleness

Verificato dal vault TEST il 2026-04-29 sera — sintomo: Claude Desktop al startup mostra "MCP mcp-tools-istefox: Server disconnected" + "Could not attach to MCP server", log `~/Library/Logs/Claude/mcp-server-mcp-tools-istefox.log` riporta `ECONNREFUSED 127.0.0.1:27201`.

**Causa primaria (sempre)**: il server HTTP del plugin 0.4.0 vive **dentro il processo Obsidian**. Senza Obsidian aperto sul vault dove il plugin è attivo, la porta è chiusa e `mcp-remote` (lo shim stdio→HTTP usato da Claude Desktop) non ha nulla a cui attaccarsi. Fix: aprire Obsidian, attendere ~3-5s che il plugin binde la porta, riavviare la connessione MCP in Claude Desktop (Settings → Developer → Restart, oppure quit+relaunch).

**Gotcha secondario (port drift, da verificare se già gestito)**: il plugin usa `bindWithFallback` su `27200-27205` (`packages/obsidian-plugin/src/features/mcp-transport/services/port.ts`), itera in ordine. Se al primo avvio 27200 è occupata, sale a 27201 e (con auto-write toggle ON) `updateClaudeDesktopConfig` riscrive `claude_desktop_config.json` con la nuova porta. Al successivo avvio Obsidian, se 27200 è libera, il plugin **torna a 27200**. Conseguenze:

1. **Auto-write deve girare a ogni `setup()`**, non solo on-toggle: da verificare in `setup.ts` se `updateClaudeDesktopConfig(currentPort)` è invocato post-bind con auto-write ON. Se sì → drift autorisolto. Se no → config Claude Desktop stale finché user non clicca "Auto-write" manualmente.
2. **Claude Desktop non ricarica live la config**: legge `claude_desktop_config.json` solo al startup. Se è già aperto quando il plugin si sposta porta (es. plugin disable+enable a vault aperto), `mcp-remote` continua a usare il target vecchio fino al prossimo restart di Claude Desktop. Limitation client-side, non risolvibile lato plugin.

**Mitigazioni candidate per 0.4.1 (post-T14, non blocking T14)**: audit `setup.ts` per chiudere il punto 1; bind preferenziale **sticky** (persisti la porta dell'ultima sessione in `data.json`, prova quella prima del range); settings UI warning quando porta corrente differisce dalla porta scritta nella config Claude Desktop più recente; doc lato user.

Issue dedicata da aprire post-T14.

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

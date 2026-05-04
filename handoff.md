# Handoff — `istefox/obsidian-mcp-connector` (was `obsidian-mcp-tools`)

> **Aggiornato 2026-05-04 tarda notte (folotp #83 disambig round 2: source verified clean, bundle drift falsificata, runtime-layer hypothesis aperta).** `0.4.0` stable + `0.4.1` patch shipped + 21 upstream outreach comments + first responses landed + #83 disambig round 2 posted. Documento di passaggio di consegne. Self-contained: dal clone iniziale al primo prompt da mandare a Claude Code, qui c'è tutto.
>
> **Per il quadro architetturale completo** (gotcha, stack, convenzioni di codice): leggere **`CLAUDE.md`** in radice. Questo file è la sintesi *operativa*; CLAUDE.md è la sintesi *tecnica*.

---

## Decisioni di sessione 2026-05-04 tarda notte — folotp #83 multi-point offer ack + explicit thanks + 4ª rule expanded

**Trigger 1**: utente flagga che mia reply su upstream #83 ([comment 4373359535](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4373359535)) NON ha acknowledged adeguatamente l'offer multipoint di folotp. Folotp aveva enumerato 3 punti (debug build con boundary scan logs, verify 4 variants pre-cut, additional variants on request); io ho coperto **solo parzialmente** punto 1 (focus diverso = `vault.on('modify')` invece di boundary scan) e **silently dropped** punti 2 e 3.

**Trigger 2** (dopo che ho postato il multi-point ack): utente flagga che manca **explicit thanks** per l'offer di remote test bench in sé — il valore dell'engagement shape (continuous test bench, real vault, real workflow chains, multiple cut cycles) è load-bearing per la qualità del progetto e va riconosciuto separatamente dal point-by-point acceptance.

**Action presa (3 step)**:

1. **Multi-point acceptance follow-up postato** ([comment 4374006687](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4374006687)): accept esplicitamente tutti e 3 i punti point-by-point, scope per-punto, link al flow corrente. (1) debug build con boundary scan instrumentation se i 4 disambig step non unblock; (2) BRAT-pin candidate + folotp re-run A/B/C/D pre-tag (stesso cycle che ha shippato 0.4.0-beta.3 → 0.4.1 per #76); (3) extended fixture set su `## ` fenced code / HTML comment / multi-byte chars come regression sentinel post-fix.

2. **Explicit thanks follow-up postato** ([comment 4374017682](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4374017682)): articulate **what about the engagement shape is load-bearing for the project** — real vaults producono edge cases che unit test fixture non surface, mixed clients chain (Claude Desktop / Cowork / Cursor / `mcp-remote` / Inspector), Linter + auto-format plugins layered, real workflow repeats. Three soak rounds in (beta.1→beta.2→beta.3→0.4.0→0.4.1) il pattern ha shippato il ship-quality multiplier che il progetto necessitava. Acknowledgement non obsequioso, riconoscimento del valore unique del remote test bench.

3. **Rule 4 espansa in `CLAUDE.md` con preamble step**: ora la rule "Multi-point offer acknowledgement" ha **due layer espliciti**: (1) preamble = explicit thanks per offer shape stesso, articulate what is load-bearing, NOT generic gratitude; (2) point-by-point acceptance. Le 4 rule complete coprono il failure-mode spectrum visto over 24h: lazy skip, since-filter blind spot, un-audited prior comments, inherited passive-monitor framing, asymmetric reply to multi-point offers (ora con explicit-thanks layer dentro).

**Lesson learned consolidata**: 5 failure mode in 24h (lazy skip / since-filter / un-audited / inherited-passive / asymmetric multi-point) tutti capturati strutturalmente in CLAUDE.md outreach methodology via 4 rule. Future session vedono la rule prima di replicare. Il pattern "scrivi la rule dopo il failure mode concreto" continua a payoff — meta-lesson della giornata.

---

## Decisioni di sessione 2026-05-04 tarda notte — folotp #83 multi-point offer ack + 4ª rule

**Trigger**: utente flagga che mia reply su upstream #83 ([comment 4373359535](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4373359535)) NON ha acknowledged adeguatamente l'offer multipoint di folotp. Folotp aveva enumerato 3 punti concreti (debug build con boundary scan logs, verify 4 variants pre-cut, additional variants on request); io ho coperto **solo parzialmente** punto 1 (debug build con focus diverso = `vault.on('modify')` invece di boundary scan come chiesto) e **silently dropped** punti 2 e 3.

**Action presa**:

1. **Follow-up acknowledgement postato** ([comment 4374006687](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4374006687)): accept esplicitamente tutti e 3 i punti point-by-point, scope per-punto, link al flow corrente. (1) debug build con boundary scan instrumentation se i 4 disambig step non unblock; (2) BRAT-pin candidate + folotp re-run A/B/C/D pre-tag (stesso cycle che ha shippato 0.4.0-beta.3 → 0.4.1 per #76); (3) extended fixture set su `## ` fenced code / HTML comment / multi-byte chars come regression sentinel post-fix.

2. **Nuova rule aggiunta a `CLAUDE.md` outreach methodology** (4ª rule): **Multi-point offer acknowledgement rule** — quando validated contributor fa offer multi-point, accept ogni punto esplicitamente point-by-point. Implicit single-point response = engagement loss signal. Default shape: enumerate accepted points in stesso ordine, pin scope per-punto, link al flow corrente.

**Lesson learned**: ho subito 4 failure mode in 24h tutti capturati strutturalmente in CLAUDE.md outreach methodology: lazy skip (#83 morning), filtered enumeration (since-filter blind spot), un-audited prior comments (#61), inherited passive-monitor framing (#77), asymmetric reply to multi-point offers (#83 ack). Le 4 rule coprono il complete spectrum dei failure mode visti finora — future session vedono le rule prima di replicare.

---

## Decisioni di sessione 2026-05-04 tarda notte — extended sweep + stale-claim audit batch

**Trigger**: utente chiede sweep esteso su fork + upstream dopo il miss su #77. Apply le 3 rule outreach methodology in `CLAUDE.md` (sweep enumeration / stale-claim audit / validated-contributor engagement).

**Sweep result**: ZERO orphan threads.
- Fork issue OPEN: 4/4 covered (54 testers tracker, 67/68/77 folotp triage substantive).
- Upstream issue OPEN: 32/32 con ≥1 mio comment.
- Upstream PR OPEN: 22/22 (9 individual + #45 vanmarkic consolidated covers series #45-#58, #44 OAuth skip-rationalized).
- Threads dove last comment NON è mio: solo bot noise (`netlify[bot]` su vanmarkic series) + 3 third-party comment ≥7 settimane stale (PR #49 #51 #55) — coperti dal consolidated comment 2026-05-04 su lead PR #45.

**Stale-claim audit batch 2026-04-21 vs 0.4.x**: 4 candidati identificati, 3 follow-up postati con version-specific delta:

- **`jacksteamdev#66`** OBSIDIAN_API_URL ignored ([comment 4373975314](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/66#issuecomment-4373975314)): old fix `0.3.3` era env var; `0.4.x` architecture pivot rimuove il concetto (in-process HTTP plugin, port range `27200..27205` auto-fallback per multi-vault).
- **`jacksteamdev#67`** port hardcoded 27124 ([comment 4373975470](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/67#issuecomment-4373975470)): old fix `0.3.0` era platform binary; `0.4.x` no binary, in-process HTTP. **19/20 tools no LRA dependency**. `search_vault` tool **ancora hardcoded a `https://127.0.0.1:27124`** in `searchVault.ts:6` — minore residual bug per LRA non-default port. Backlog candidate per future PR fork-side.
- **`jacksteamdev#68`** LRA v3.4.x compat ([comment 4373975594](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/68#issuecomment-4373975594)): old fix `0.3.0` era compat shim; `0.4.x` mitiga drasticamente — root-endpoint validation non sul hot path per 19/20 tools, LRA opzionale.
- **`jacksteamdev#29`** Command Execution Support: SKIP. Capability esiste tanto su `0.3.x` quanto su `0.4.x`; il toolToggle UI hidden in `0.4.0` (Known limitations) è separate concern e non invalida il claim originale "fixed in 0.3.0".

**Backlog identified**: `searchVault.ts:6` hardcoded `REST_API_URL = "https://127.0.0.1:27124"`. Fix candidate post-store-accept: leggere LRA port da `plugin.localRestApi.plugin?.settings?.port` (already accessible — il plugin reads `apiKey` via stessa path su `main.ts:89`). ~10 LOC + test. Issue OPEN da filare fork-side se folotp/altri lo segnalano.

**Memo**: il processo applicato qui (sweep + stale-claim audit cross-checked against current architecture) è la stessa strategia che ha shippato 17 outreach 2026-05-04 sera + i 3 follow-up di adesso. Le 3 rule in `CLAUDE.md` outreach methodology (sweep enumeration / stale-claim audit / validated-contributor engagement) hanno coverage completa di failure mode per now.

---

## Decisioni di sessione 2026-05-04 tarda notte — fork #77 substantive triage + methodology rule

**Trigger**: utente domanda "controlla l'issues #77" durante sweep di follow-up. #77 era OPEN da 13h con label `enhancement` (applicato in sessione pomeriggio) ma **zero comment**. Inherited come "future scope, no commitment, passive monitor" dal prior session's triage note. Framing sbagliato.

**Action presa**:

1. **Substantive triage comment postato** ([fork #77 comment 4373630242](https://github.com/istefox/obsidian-mcp-connector/issues/77#issuecomment-4373630242)) — preferenza technical Option A (LLM tool routing dis-ambiguation + schema surface clean + LRA mapping 1:1), implementation footprint stimato (~80-120 LOC, thin LRA wrapper come pattern PR #75 templatesCompat), timeline expectation (post-store-accept gated #11919, candidate per 0.4.2/0.4.3 cluster), commitment a pre-write ArkType schema + handler queueable. Plus side-note: cross-referenced upstream `jacksteamdev/obsidian-mcp-tools#81` likely already addressed dal Zod→ArkType migration, ping a folotp per re-verify.

2. **Nuova rule aggiunta a `CLAUDE.md` outreach methodology** ([commit pending]): **Validated-contributor engagement rule** — fork issue OPEN da folotp/marcoaperez/grimlor con 0 comment >12h è engagement-priority indipendentemente da ping esplicito. Substantive triage comment richiesta (preferenza tra opzioni, implementation footprint estimate, timeline framed against gating). Non richiede milestone commitment — richiede engagement con la sostanza. "Future scope" gates milestone, non engagement.

**Lesson learned (post-mortem honesto)**: bias di inheritance del framing "future scope" come proxy per "passive monitor" + auto-mode trigger asymmetry (priorità a thread con evento concreto da reagire, miss su engagement-drop signals senza trigger esplicito) + miss-applied anti-tactic ("no feature creep durante store review" diventato "no engagement on feature requests"). 0 comment >12h su proposal high-quality di trusted contributor è di per sé un signal.

---

## Decisioni di sessione 2026-05-04 tarda notte — folotp #83 disambig round 2 🔍

**Folotp ha risposto su upstream #83** (2026-05-04 17:52Z): bug reproduces on `0.4.1`, fornisce **variant matrix di 4 case** (A canonical / B single-row / C plain prose / D code-span no-table). Variant C decisivo: prose `Original content. This refers to ## Links below.` SENZA tabella né code-span riproduce — orphan `## Links below.` post-replace. Diagnosi tecnica di folotp: regex sta lavorando senza line-start anchor effettivo, tre opzioni concrete (regex sans `^`, `g`-flag senza `m` flag walking forward, input non split su `\n` sul live path).

### Source verification eseguita (option C dalla mia proposta)

**Step 1 — diff source**: `git diff 30ef3c9..HEAD` su `packages/obsidian-plugin/src` **vuoto**. Source 0.4.1 = HEAD per ogni file patch-related. Doc-only commits dal tag.

**Step 2 — code path inventory**: solo **3 occorrenze** della regex `#{1,6}` nel plugin source, tutte in `patchHelpers.ts` (riga 40 `resolveHeadingPath`, riga 417 leaf-name match, riga 443 boundary scan), tutte con anchor `^` su elementi per-line dopo `rawContent.split("\n")`. Nessun compat shim per `PATCH /vault/`, nessun `apiExtension` layer, `patchVaultFileHandler` delega direttamente ad `applyPatch`. **Code path live = code path unit-test**.

**Step 3 — bundle integrity**: rebuild locale di `main.js` da HEAD vs shipped `0.4.1` artifact. Size delta 6 bytes, divergenza unicamente nei `__dirname`/`__filename` strings dentro `onnxruntime-web` (`/Users/stefanoferri/...` locale vs `/home/runner/work/...` CI). Pattern regex critico **bit-identical** in entrambi i bundle: `let C=$[E].match(/^(#{1,6})\s/);if(C&&C[1].length<=D){…`. **H1 (bundle drift) e H4 (different scanner) FALSIFICATE**.

**Step 4 — unit-level repro su HEAD**: scritto test ad-hoc che mirrora variant C decisivo + variant A canonical di folotp byte-exact con tool-call args identici. **Entrambi i test PASS**, output byte-exact pulito (no orphan, no mid-line split). Dump rendering nei log per evidence pubblica. Test temp eliminato dopo run (working tree pulito).

### Riposta su #83 ([comment 4373359535](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4373359535))

Postato findings rigorosi: source verified clean, bundle drift falsificata, regex pattern bit-identical, unit-level repro byte-exact dei suoi 2 fixtures principali → output clean. **Conclusione**: bug è runtime, non source. Tre ipotesi rimaste con probabilità:

- **🔴 H7. Linter (o altro auto-format) plugin attivo nel vault di folotp** — `app.vault.modify()` fires `vault.on('modify', …)`; un handler Linter/Format-on-save che ri-formatta il file producerebbe un re-read post-format invece di post-applyPatch. Variant matrix riproducendo su 4 fixtures = consistente con post-process layer agnostico al syntax shape.
- **🟡 H8. File-on-disk encoding mismatch** (CRLF, BOM, NBSP, trailing whitespace) tra fixture descritta e bytes effettivi che `app.vault.read()` legge.
- **🟢 H9. mcp-remote/Cowork chain mutates `content` in transit**.

### Disambig request a folotp (4 step concreti, in qualunque ordine)

1. `cat .obsidian/community-plugins.json` del test vault — Linter/Templater-on-save/Format-on-save sono prime suspects.
2. Repro variant C **con Linter disabilitato** (e altri auto-formatter), leaving connector + Local REST API only. Se clean → H7 confermata.
3. Repro variant C **via MCP Inspector** invece di Cowork + `mcp-remote` (bypass dei 3 layer client). Se clean → H9 confermata.
4. `xxd Tests/fixture-c.md | head -20` — rules out BOM/CRLF/encoding.

Plus offerta di debug build con `vault.on('modify')` listener-instrumentation per labelled trace se Linter-style culprit suspected.

**Stato**: source-side stack exhaustively verified, awaiting folotp runtime evidence per localize layer. **No code action mia required** finché folotp non torna con disambig data.

---

## Decisioni di sessione 2026-05-04 tarda sera — outreach response wave 📨

**Post-outreach response window**: ~1.5h dopo i 21 comment upstream, due risposte substantive.

### 🔴 Folotp upstream #83 — bug repro claim, awaiting disambiguation

Folotp ha testato `0.4.1` su Cowork chain (12:29Z) e dichiara che il bug si riproduce — output con spurious `## Links\` |` line dopo replacement, contraddicendo il mio code-trace di stamattina ("`^` anchor doesn't hold in practice").

**Mio counter-evidence**: scritto unit test che riproduce esattamente la sua fixture su `feat/http-embedded` HEAD `2387e0e`, output **clean** (no spurious line, 1/1 pass). Codice in `patchHelpers.ts:442-448` usa `lines[i].match(/^...)` per-line, NON può matchare mid-line.

**Mio follow-up postato** ([comment 4371082861](https://github.com/jacksteamdev/obsidian-mcp-tools/issues/83#issuecomment-4371082861)): 3 hypothesis disambigation:
- **(a)** BRAT cached old version → chiedo `get_server_info.apiExtensions[0].version`
- **(b)** Replacement `content` shape differs from paraphrase → chiedo exact string
- **(c)** Different code path I'm missing → offerta di esecuzione fixture byte-for-byte

**Stato**: aspetto folotp clarification. Se conferma post-disambiguation, 0.4.2 patch immediato.

### 🟢 Folotp fork #77 — partial-read RFC opened

Folotp ha **eseguito la mia outreach suggestion** di stamattina su upstream #82 (suggerivo "file the same body on the fork tracker"). 46 minuti dopo, ha aperto fork #77 con cross-reference. Pattern di outreach validato: redirect "open the issue on fork" → utente esegue.

**Triage**: applicato `enhancement` label. Anche allineato #67/#68 (sue altre RFC) con stesso label per consistenza. Tutti unmilestoned (future scope, no commitment).

### 🟢 Marcoaperez upstream PR #69 — CHIUSA con commit-to-fork ✅

**Massimo positive outcome della giornata, sigillato alle 16:00:05Z.** Marcoaperez (autore della PR #69 URL-encode non-ASCII headers) ha risposto al mio comment con un **inventory di 5+ tool che ha implementato sul suo downstream fork** (`marcoaperez/obsidian-mcp-tools` 0.3.4, 2026-04-14, in-house use):

- **Net-new tools**: `get_recent_files`, `list_tags`, `get_document_map`, `get_periodic_note` family (3 tool), `execute_dataview_query`, `get_vault_files`
- **Behaviour additions**: auto-truncation per large reads, search-results cap, `OBSIDIAN_PORT` env var
- **Overlap**: il suo `list_commands`/`execute_command` = nostro `list_obsidian_commands`/`execute_obsidian_command` (shape diverso, semantics simili)

**Closure comment** (2026-05-04T16:00:05Z): *"Closing as agreed — the underlying issue is resolved by 0.4.x's in-process architecture, and any follow-up work moves to the fork. Thanks @istefox for the detailed roadmap response; **will start with the lightweight tools per your suggested order**."*

**Significato confermato**:
1. PR upstream **chiusa** come concordato (no patch superficiale, fix strutturale 0.4.x in-process)
2. **Commit esplicito a fork**: "any follow-up work moves to the fork"
3. **Accetta ordering smallest-wins-first**: partirà con `get_recent_files` + `list_tags` (1-PR-each leggeri)
4. **Secondo external contributor maintainer-grade** dopo folotp confermato

**Mio reply substantive antecedente** ([comment 4371427847](https://github.com/jacksteamdev/obsidian-mcp-tools/pull/69#issuecomment-4371427847)) con per-feature triage in 4 categorie (overlap-shipped / strong-candidate / maybe-scope / architecturally-retired) + workflow guidance + suggested ordering è quello che ha guidato la sua scelta di partire dai due lightweight.

**Pipeline attesa**: 1-2 PR nelle prossime 1-2 settimane (`get_recent_files` o `list_tags` come primo). Probabilità conversione completa (5-10 PR totali): salita da ~60% a ~75% post-closure-commit.

**Acknowledgment**: lasciato 👍 reaction sulla closure comment (id `4372519873`, reaction `353335946`) — chiusura del loop senza notifica rumorosa al thread. No comment di follow-up postato (già ringraziato substantivamente nel reply 13:27Z; secondo "thanks" su PR chiusa = noise > value). **Prossimo touchpoint con marcoaperez**: review veloce e accurato sulla sua prima PR sul fork.

### Methodology validation

Pattern outreach validato due volte oggi: (1) folotp porta una RFC dal mio redirect suggestion in <1h; (2) marcoaperez offre upstream-from-his-fork dopo per-feature triage. **Outreach con per-feature triage + concrete workflow path > generic redirect**.

---

## Decisioni di sessione 2026-05-04 sera — `0.4.1` patch + comprehensive outreach round 🎯

**Carry-over dalla sessione pomeriggio (0.4.0 stable cut, vedi sezione successiva).**

**Lavoro chiuso in serata:**

1. **Quick wins fork** — closed 3 issues shipped ma open: #58 (createTargetIfMissing flip → 0.4.0), #73 (templates 404 compat shim → beta.3), #74 (registry isError hoist → beta.3 single-prefix verified via `toolRegistry.test.ts:286-292`). Plus #70 (SECURITY.md rewrite, T14-unblocked) → **commit `6f1148a`** rewrites the doc with 0.4.x threat model (loopback HTTP, Bearer + timingSafeEqual, Origin validation, command-permissions layer + out-of-scope section).

2. **🆕 0.4.1 patch cut** ([release](https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.4.1), commit `30ef3c9`) — closes **#76** (heading-replace blank-line carryover from beta.1, reported by folotp round-3). Symmetric leading-separator emission in both `applyPatch` impls (`patchHelpers.ts` canonical + `patchActiveFile.ts` duplicate). 6 new test cases pinning input-with-blank, input-without-blank-Linter-normalisation, caller-supplied-blank-no-double-emit on both files. CI release run `25315293484` green, plugin-only assets. **Cycle bug-report → patch ship: <12h end-to-end.**

3. **Comprehensive upstream outreach round** — the morning sweep had used `since=2026-04-29` filter which **hid old-but-still-open items**. Deep re-analysis surfaced 10 never-commented Group A items + 1 stale Group B claim. Total comments posted today on upstream: **17** (8 issues + 9 PRs).
   - Group A new outreach: #27 robin-collins (NFS symlink 2025-07), #38 FlatulentFowl (SuperAssistant 2025-09), #82 folotp (partial-read RFC), PRs #20 mbelinky (multi-vault), #45 vanmarkic (consolidated for 11-PR series), #64 dominikblei (port env), #65 DragonVibes (schema clarity), #74 vinhltt (port flag), #75 laplaque (POSIX path root-cause).
   - Group B stale-claim audit: #61 toolToggle — 2026-04-21 said "fixed in v0.3.0" but 0.4.0 hides UI per Known Limitations → posted version-specific follow-up with BRAT-pin guidance for 0.3.12.
   - Skipped: #44 after-ephemera (OAuth, empty PR body), #85/#86/#83 already covered earlier.

4. **CLAUDE.md `## Outreach triage methodology` expanded** ([commit `97805d2`](https://github.com/istefox/obsidian-mcp-connector/commit/97805d2)) — added two new rules from this session's failure modes: (a) **Sweep enumeration rule** — `state=open` without `since=` filter to catch long-tail; (b) **Stale-claim audit on prior outreach** — re-check old comments after major release events for accuracy under new architecture. Pre-existing "full body read + code grep" rule preserved.

**Working tree state:** clean on `feat/http-embedded` HEAD `97805d2`. Tags up to `0.4.1`.

**Local plugin install (Lab vault on Mac ufficio):** upgraded to 0.4.1 in serata (curl direct download from release).

**No active issues blocking anything**. Open items: #54 testers tracker (active), #67/#68 folotp design RFCs (post-stable, milestone 0.4.x feature batch). Open PRs: 0.

**Outreach response monitoring**: 17 comment posted today, autori potrebbero rispondere nelle prossime 24-72h. Solo passive monitor; routine settimanale store PR #11919 already covers strategic event tracking.

---

## Decisioni di sessione 2026-05-04 pomeriggio — `0.4.0` STABLE CUT 🎉

**Sequenza A → B → C → D2 → T14 eseguita end-to-end (Mac ufficio):**

1. **A. Smoke check #74** — fatto via test ground-truth (Inspector live non disponibile sul Mac ufficio: vault TEST mancava, Lab senza plugin, niente HTTP listener attivo). `toolRegistry.test.ts:286-292` asserisce esattamente la shape `content[0].text = "MCP error -<code>: <body>"` (single prefix) + assertion negativa esplicita contro double-prefix. 21/21 PASS su HEAD. **Verdetto: ramo 1 di folotp** — server clean, `mcp-remote` re-throw è la 2nd source del prefix che folotp osservava su Cowork chain. Confidenza ~90% senza Inspector live.

2. **B. Reply folotp #54 round-3** ([comment-4368463696](https://github.com/istefox/obsidian-mcp-connector/issues/54#issuecomment-4368463696)) — verdetto + ack qualità diagnosi tecnica. Tono peer-technical.

3. **C. Triage #76** — labels `bug` + `cosmetic` (creata; non esisteva), milestone `0.4.1` (creata; non esisteva).

4. **D2. EXDEV-oss closure** — #71 chiuso `not planned` con [motivazione documentata](https://github.com/istefox/obsidian-mcp-connector/issues/71#issuecomment-4368465665). [Terminal comment su #54](https://github.com/istefox/obsidian-mcp-connector/issues/54#issuecomment-4368466875) listing 3 errori architetturali in 24h (cross-browser, rate-limiter "reconnect reset", Node v24) + AI-template frontmatter leak. #54 resta OPEN come testers tracker per altri.

5. **T14. 0.4.0 STABLE CUT** — CHANGELOG finalize (#58 → `[0.4.0] # Changed`, nuovo `### Fixed (post-0.4.0-beta.2 batch)` per #73/#74, date `2026-05-04`, test count `613`, pre-release tags fino a beta.3). Bump manuale `package.json` + `manifest.json` + `versions.json` (`"0.4.0": "0.15.0"`) a `0.4.0`. **Commit `54584d9` "0.4.0"**, tag `0.4.0`, push branch + tag. CI Release run `25302713434` green, plugin-only assets confermati (`main.js` 3.0MB + `manifest.json` 389B + `obsidian-plugin-0.4.0.zip` 914KB). Marked stable (`prerelease: false`).

6. **Follow-up posted**: [ack tag a folotp su #54](https://github.com/istefox/obsidian-mcp-connector/issues/54#issuecomment-4368542603), [re-lint request su PR #11919](https://github.com/obsidianmd/obsidian-releases/pull/11919#issuecomment-4368542705).

**Note tecniche:**
- `bun run check` locale fallisce su `templatesCompat.ts:167` (express types version mismatch) → **Mac ufficio-specifico**. CI Linux verde su tutti i recent commits incluso HEAD. Plugin tests 613/613 verdi anche localmente. Zero impatto sul tag.
- Branch protection rispettata: `main` intoccato a `0.3.12`.

**Gating switch — da "folotp sign-off" → "community store #11919 acceptance":**

Il cut della 0.4.0 stable è la fine della Phase 4. Tutte le azioni residue **gated su community store accept**:
- Discord DM @jacksteamdev (condizione issue #79: HTTP transport ✅ + community store live ⏳)
- README PR upstream linking al fork
- Outreach annuncio fork (Reddit/Twitter/Mastodon — anti-tactic policy "no pre-store-accept" si scioglie post-accept)
- Glama listing Phase B

**NON fare nulla di questi finché PR #11919 non viene mergiato dal team Obsidian.**

Routine `trig_015yL8D3VNao7nhRKjBu95ZK` (Lun 07:00 UTC) monitorerà PR #11919 settimanalmente — già scattata stamattina senza notify → nessun movimento questa settimana. Tempo tipico review Obsidian: 2-8 settimane (ne sono passate ~3).

---

## Decisioni di sessione 2026-05-04 mattina (carry-over al Mac ufficio)

**Inputs ricevuti durante la notte (2026-05-03 19:10Z → 2026-05-04 01:27Z):**

1. **Folotp round 3 SOAK COMPLETATO** (2026-05-04 01:25Z, su #54). Soak su `0.4.0-beta.3` via Claude Cowork inside Claude Desktop `1.5354.0` (build `9a9e3d`) + `npx mcp-remote` bridge. Verdetti targeted: ✅ #73 PASS (compat shim), ✅ #20 PASS (path field), ✅ #19 PASS (message propagation), ❌ **#74 FAIL** sul Cowork+`mcp-remote` chain (collapse 3→2 prefix invece di 3→1). Carryover regression family vs 0.3.x: ✅ #12, #13, H2-root reject, stat field, block-in-table 400, YAML auto-quote. 🟡 H2 nested replace blank-line consumption persiste (carryover beta.1) → folotp ha filed **issue #76** (cosmetic, candidate 0.4.1).

2. **#74 — diagnosi tecnica di folotp** (qualità altissima, reverse engineering wire shape su #74 stesso 2026-05-04 01:25Z): registry hoist HA peelato un prefix (registry's own wrap), ma resta un secondo prefix con due possibili fonti — **(a)** `mcp-remote` materializza `isError: true` come `throw new McpError` (`message = content[0].text`), aggiungendo proprio `MCP error -<code>:` prefix; **(b)** il `content[0].text` del registry ANCORA porta la stringa `MCP error -<code>:` da upstream del catch (concatenazione di `McpError.message` invece del bare body). **Smoke check discriminante proposto da folotp**: `patch_vault_file` array-replace fail-loud contro **MCP Inspector** (envelope verbatim, no JS Error materialization). Tre rami:
   - Inspector single prefix in content text → bug downstream `mcp-remote`/Cowork, server clean → **beta.3 può andare a 0.4.0 stable**
   - Inspector zero prefix → entrambi i prefix client-side → **beta.3 può andare a 0.4.0 stable**
   - Inspector double prefix → `content[0].text` ancora sporco → server bug, hoist incompleto → **serve beta.4**

3. **Issue #76 nuova** (folotp, 2026-05-04 01:27Z): `patch_vault_file targetType:"heading"` replace consumes trailing blank-line. Cosmetic, Linter normalizza on UI save. Repro pulito. **Triage**: bug + cosmetic, milestone 0.4.1 (NON blocca 0.4.0 stable).

4. **EXDEV-oss pattern peggiorato — 3° colpo in 24h** (2026-05-03 19:10Z + 19:15Z, dopo replica B 14:37Z). Ha **cross-postato testo identico byte-per-byte** su **#71 (thread di grimlor!)** e **#54** — claim "plugin fails to load in Obsidian on Node.js v24, works on v20". Architetturalmente errato per la 3a volta: il plugin gira dentro Obsidian Electron renderer (Node bundle interno), NON dipende dal Node host; solo `mcp-remote` (CLI Anthropic, downstream del plugin) usa Node host installato. Pattern bot/AI engagement confermato beyond reasonable doubt: rate-limiter (#54 14:29Z) → cross-browser/mobile (#54 09:25Z) → Node v24 cross-post (#54+#71 19:10/15Z), tutti tre confutati architetturalmente.

**Azioni pianificate al Mac ufficio (in ordine):**

- **A. Smoke check Inspector** (10-15 min, deterministico). Vault TEST già setup, `mcp-tools-istefox` 0.4.0-beta.3 simlinkato. Comando: `cd packages/mcp-server && bun run inspector` → punta a `http://127.0.0.1:27200/mcp` con bearer token (auto-discovery vedi `reference_vault_and_api_key.md`) → repro `patch_vault_file` array-replace fail-loud (`targetType: frontmatter`, `target: tags`, plain string content on array-valued field, fixture pulito tipo `Tests/array-frontmatter.md` con `tags: [a, b]`) → osserva content text del JSON-RPC response in Inspector. Risultato deterministico → decide stable cut vs beta.4.
- **B. Risposta a folotp su #54** (post-A): acknowledge round 3 + verdetto sul #74 in base allo smoke A + carryover wins. Tono peer technical, riconoscere quality dell'analisi.
- **C. Triage issue #76**: aggiungere label `bug` + `cosmetic` + milestone `0.4.1` (post-stable). Niente fix urgente.
- **D. Risposta EXDEV-oss su #71 + #54** (judgment call sul tono):
  - **D1**. Risposta tecnica corta + close as not-a-bug su entrambi (architettura: plugin non dipende dal Node host; `mcp-remote` è downstream).
  - **D2** *(raccomandato)*. Comment unico su #54 + close #71 as duplicate of #54, close ENTRAMBI come not-reproducible. Tono terminale, no apertura ulteriore.
  - **D3**. Lock conversation #54 (drastico). Valutabile se EXDEV continua post-D2.

**Sequenza ottimale**: A → B → C → D2.

**Posto-A decision tree concrete:**

- Se A → stable cut path (rami 1/2 dell'Inspector smoke): cut `0.4.0` stable (T14 unblocked) + comment su PR #11919 ("manifest target updated to 0.4.0, please re-validate") + Discord DM jacksteamdev + README PR upstream (entrambi gated su store accept).
- Se A → beta.4 path (ramo 3): branch `fix/74-content-text-prefix-strip`, edit `ToolRegistry.dispatch()` catch per stripping `MCP error -<code>:` da `content[0].text` prima dell'envelope, test 5+ throwing tool, bump beta.4, push, comment su #74+#54 con BRAT pin per round-4 soak. Stable cut posticipato fino round-4 clean.

---

## Decisioni di sessione 2026-05-03

- **`0.4.0-beta.3` cut** (commit `bbc1289`, tag pushato, CI release verde, marcato prerelease). Bundle PR #75 = #73 (compat shim `POST /templates/execute` 404) + #74 (registry-level `isError` hoist per double-prefix). Folotp pingato su #54 con scope round 3. Stato: in attesa retest.
- **Cross-link reciproco DT-MCP ↔ fork Obsidian** nei README. Sul fork: commit `dcacaa1` su `feat/http-embedded` ("Other MCP servers by istefox" → linka `istefox-dt-mcp`, pointer-only). Sul DT-MCP: PR #41 `docs/glama-listing-and-cross-link` (badge Glama + reciproco). Cross-link è branding/discoverability puro, non propedeutico a Glama listing del fork.
- **Glama listing del fork — RINVIO A FASE B (post-store-accept).** Listing è tecnicamente possibile (registry indicizza repo GitHub, esponendo tools/schema), ma il badge `Official` no: il fork 0.4.0 è plugin in-process Electron, non server stdio standalone runnable nel sandbox `/app` di Glama. Listing senza badge resta valore (presence in 22k server registry, profilo `istefox` verificato), ma aggiungerlo durante review store #11919 introduce un'altra dipendenza esterna da monitorare. Coerente con anti-tattica "no Reddit/Twitter pre-store-accept": un evento per volta. **Riapre come Fase B**, non scartato. Correggo la mia precedente affermazione "non vale lo sforzo" che era basata su lettura troppo categorica delle policy Glama.
- **EXDEV-oss su #54 — replica terminale postata** (`comment 4366414002`, opzione B della lista opzioni). Il "rate limiter reset on client reconnect" del suo finding 14:29Z è architetturalmente impossibile (rate limiter è tumbling window module-global wall-clock-keyed, transport stateless senza nozione di "client"); confutato citando `rateLimit.ts:32-49` + invariante stateless transport, richiesto repro con commit SHA + sequenza request + timestamp. Il commento aveva frontmatter leak `:::writing{variant="chat_message" id="93147"}` + smart quotes + JSON malformato → conferma alta-confidenza pattern AI-template engagement già documentato in memoria. Aspettare drop-off; se doubled-down con altro template, valutare lock #54 dopo round 3 folotp.

---

## 🚦 Quick Start — apertura sessione (Warp o qualsiasi terminale)

**Branch attivo:** `feat/http-embedded`. Versione: **`0.4.1`** (rilasciata 2026-05-04 sera, commit `30ef3c9`; patch line latest `97805d2`). Working tree pulito, allineato con `origin`.

**Stato dei due track:**
- `main` = **0.3.12** stabile, BRAT-distribuito, 20 tool, intoccabile (vedi § Branch protection in CLAUDE.md). Tre fix shippati 2026-04-28: #19, #20, #21.
- `feat/http-embedded` = **`0.4.1`**. **Phase 1+2+3+4 chiuse, T14 chiuso, primo patch shipped.** Tre soak rounds folotp completati (beta.1→beta.2→beta.3→stable). 0.4.1 patch chiude #76 (heading-replace blank-line carryover, cosmetic, cycle report→ship <12h).

**Prossimi passi concreti — TUTTI gated su community store #11919 acceptance:**

1. **⏳ Community store PR #11919 review** — manifest target ora `0.4.0` (re-lint request postata 2026-05-04). Routine settimanale `trig_015yL8D3VNao7nhRKjBu95ZK` monitora. Tempo review tipico Obsidian: 2-8 settimane (~3 trascorse). Nessuna azione lato fork finché reviewer non si muove.
2. **Discord DM @jacksteamdev** (post-merge #11919) — annuncio fork stable + community store live. Soddisfa entrambe le condizioni issue #79 (HTTP transport ✅ + store ⏳).
3. **README PR upstream** (post-merge #11919) — link al fork dal README di `jacksteamdev/obsidian-mcp-tools`.
4. **Outreach pubblico** (post-merge #11919) — Reddit/Twitter/Mastodon. Anti-tactic policy "no pre-store-accept" si scioglie qui.
5. **Glama listing Phase B** (post-merge #11919) — registry indicizza, no Official badge per architettura plugin in-process; valore = presence in 22k server registry.

**Branch `main` (0.3.x) maintenance**: aperta a bug fix patch (0.3.13+ per regressioni gravi), ma BRAT users di 0.3.12 sono stabili. Niente lavoro proattivo.

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

**Primo prompt suggerito alla nuova sessione (post-stable cut):**
> "Leggi `handoff.md` (sezione Decisioni 2026-05-04 pomeriggio in cima) e `CLAUDE.md`. **`0.4.0` stable shipped 2026-05-04** (commit `54584d9`, tag `0.4.0`, CI release run `25302713434` green, plugin-only assets). Folotp soak rounds 1-2-3 completati clean. Issue tracker stato: #54 testers tracker resta open, #71 chiuso (EXDEV-oss not-reproducible), #76 cosmetic deferito a milestone 0.4.1. **Tutto il lavoro residuo è gated su merge del PR community store #11919** (re-lint requested 2026-05-04). Verifica: (1) routine `trig_015yL8D3VNao7nhRKjBu95ZK` ha trovato attività su #11919 dall'ultimo Lun? (2) c'è feedback nuovo da folotp su #54 post-stable? (3) altri tester/issues nuovi sul fork? Se PR #11919 mergiata: procedere con Discord DM @jacksteamdev + README PR upstream (entrambi condizione #79). Altrimenti: niente da fare lato fork, monitor passivo."

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
  - `feat/http-embedded` = **`0.4.1`** (Phase 1+2+3+4 chiuse + T14 chiuso 2026-05-04 pomeriggio + patch 0.4.1 chiuso 2026-05-04 sera; gating outreach pubblico ora su community store #11919 acceptance)
- **Remote setup canonico:**
  - `origin` → `https://github.com/istefox/obsidian-mcp-connector.git`
  - `upstream` → `https://github.com/jacksteamdev/obsidian-mcp-tools.git` (read-only, dichiarato unmaintained 2026-04-24)
- **Tag latest stable:** `0.4.1` su commit `30ef3c9`. HEAD branch `97805d2` (CLAUDE.md outreach methodology expansion, post-tag).
- **Note CLI**: `gh` di default risolve sul remote `upstream` (jacksteamdev/obsidian-mcp-tools) — usare sempre `gh ... --repo istefox/obsidian-mcp-connector` per release/run/issue del fork.
- I 2 file `.bun-build` orfani (~118 MB totali) restano su disco ma sono gitignored.

### Release pubbliche
| Versione | Data | Note |
|---|---|---|
| **`0.4.1`** | 2026-05-04 sera | **Patch line.** Commit `30ef3c9`. Tag `0.4.1`. CI Release run `25315293484` ✅. Asset plugin-only: `main.js` 3.0MB + `manifest.json` 389B + `obsidian-plugin-0.4.1.zip` 914KB. Closes #76 (heading-replace leading blank-line, cosmetic carryover from beta.1) — symmetric leading-separator fix in both `applyPatch` impls. 6 new test cases. Cycle report→ship <12h. |
| **`0.4.0`** | 2026-05-04 pomeriggio | **STABLE** — release pubblica primaria. Cut da `bbc1289` (= `0.4.0-beta.3`) con CHANGELOG finalize + version bump only. Commit `54584d9`. Tag `0.4.0`. CI Release run `25302713434` ✅. Asset plugin-only: `main.js` 3.0MB + `manifest.json` 389B + `obsidian-plugin-0.4.0.zip` 914KB. `prerelease: false`. 613/613 plugin tests verdi. Tre soak rounds folotp completati 2026-04-28/05-01/05-04. Closes Phase 4. |
| `0.4.0-beta.3` | 2026-05-03 | Pre-release. Bundle PR #75 = #73 (compat shim `POST /templates/execute` 404 — residuo binary 0.3.x lato user) + #74 (registry-level `isError` hoist per double-prefix collapse). 31 nuovi test. CI release verde. |
| `0.4.0-beta.2` | 2026-04-29 mattina | Pre-release. Folotp post-beta.1 fix batch (PR #69): #12 replace array→scalar, #13 append/prepend array structure flattening, #19 double-prefix error message, #20 missing `path` in execute_template response + heading replace blank-line + `get_vault_file format:json` stat field. 528+ test verdi. |
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

> ⚠️ **Sezione storica (post-stable cut 2026-05-04).** Per lo stato corrente vedi **"Decisioni di sessione 2026-05-04 pomeriggio"** in cima al documento. Le sotto-sezioni A → F qui sotto erano il piano della cut 0.4.0 stable e sono **completate**. L'unico item ancora attivo è il monitoring passivo del PR community store #11919 (routine settimanale `trig_015yL8D3VNao7nhRKjBu95ZK` Lun 07:00 UTC) e i follow-up gated su accept (Discord DM jacksteamdev, README PR upstream, outreach pubblico, Glama listing Phase B).

### A — ~~Soak round 2 su 0.4.0-beta.2~~ ✅ COMPLETATO (round 1 + 2 + 3 chiusi 2026-05-04)

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

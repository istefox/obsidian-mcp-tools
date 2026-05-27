# BRAINSTORM — Transformers.js v4 upgrade + ONNX IR v10 compatibility fix

**Data:** 2026-05-27
**Fonte requisiti:** SPEC.md at `/Users/stefanoferri/Developer/Obsidian_MCP/obsidian-mcp-tools/SPEC.md`
**Tecniche applicate:** first-principles decomposition, assumption-busting, analogie cross-dominio (DLC/videogioco), inversione/pre-mortem

---

## Problema riformulato (first-principles)

Il risultato irriducibile è **EmbeddingGemma 300M deve caricare e produrre embedding validi dentro Obsidian, senza dipendenze cloud**. L'errore IR v10 è un sintomo; la causa è che il runtime ONNX è fermo a IR ≤ v8. La soluzione è aggiornare il runtime — non il modello. Qualsiasi altra strada (esportazione alternativa del modello, shim IR, downgrade del modello) è un workaround che non risolve la causa strutturale e accumula debito tecnico.

---

## Assunzioni sfidate

- **IR v10 richiede obbligatoriamente @huggingface/transformers v4** — esito: **da verificare** — potrebbe esistere un export del modello in IR ≤ v8 su HuggingFace (Task 0 del piano: verifica prima di scrivere codice). Se esiste, il fix diventa un aggiornamento di model-ID senza cambio di dipendenza. Improbabile ma non impossibile.
- **v4 funziona nell'Obsidian Electron loader** — esito: **da verificare** — CLAUDE.md documenta che un test passato ha rotto il loader per `import.meta.url`. Il rischio è reale; il piano lo gestisce con un Task 1 spike prima di qualsiasi altra implementazione. Se fallisce, il fallback è Bug 2+3 null-guards senza upgrade.
- **FORMAT_VERSION bump deve essere silenzioso** — esito: **sfidabile** — l'utente potrebbe non aspettarsi che l'aggiornamento cancelli il suo indice Gemma. La migrazione dovrebbe mostrare un dialog esplicito (non solo un banner) prima del wipe, specialmente se l'indice ha richiesto ore di build.
- **WebGPU è stabile su tutti i desktop Obsidian** — esito: **da verificare** — alcuni driver GPU causano crash silenzioso nelle sessioni ONNX WebGPU. Il fallback automatico a WASM deve essere robusto (try/catch sulla sessione, non solo sulla detection di `navigator.gpu`).

---

## Alternative di approccio

### Alternativa A — Model-ID hunt first

- **Idea:** Prima di toccare dipendenze, verificare se esiste un export di EmbeddingGemma 300M con ONNX IR ≤ v8 su HuggingFace (namespace diverso, versione più vecchia del modello). Se esiste, il fix è solo un aggiornamento di model-ID in una riga. Se non esiste, si passa ad Alt C.
- **Asse di differenza:** deployment (zero cambio di dipendenza vs. aggiornamento pesante del runtime)
- **Pro:** zero rischio di rompere il loader; nessun FORMAT_VERSION bump necessario; ore di lavoro risparmiate se l'export esiste
- **Contro:** l'export probabilmente non esiste (Gemma 300M è stato esportato direttamente in IR v10); se non esiste, il tempo speso nella ricerca è overhead; posticipa la soluzione strutturale
- **Costo/tempo indicativo:** basso (ma solo come primo check; non come alternativa finale)

### Alternativa B — Two-PR: runtime fix first, WebGPU second

- **Idea:** PR 1 si occupa solo dell'upgrade di runtime (`@xenova` → `@huggingface/transformers` v4, `onnxruntime-web` ≥ 1.20, model-ID verify, FORMAT_VERSION 2→3, migration guard) con device forzato a WASM. PR 2 aggiunge WebGPU auto-detect come feature separata, dopo validazione.
- **Asse di differenza:** temporalità (disaccoppia fix critico da feature nuova)
- **Pro:** blast radius minimo per PR 1 (solo runtime, nessuna nuova logica dispositivo); WebGPU va in produzione solo dopo testing dedicato su hardware reale; separazione netta di responsabilità
- **Contro:** due cicli di review e due merge; WebGPU rimane assente finché PR 2 non è pronta; utente dovrà re-fare il PR review process
- **Costo/tempo indicativo:** medio (due PR medie invece di una grande)

### Alternativa C — Single-PR con spike obbligatorio come Task 1

- **Idea:** Un'unica PR che include tutto (runtime upgrade, WebGPU auto-detect, FORMAT_VERSION bump, migration). Ma Task 1 è uno spike esplicito: verifica la compatibilità con il loader Obsidian PRIMA di implementare qualsiasi altra cosa. Se lo spike fallisce, la PR si ferma e produce solo i null-guards di Bug 2+3. Se passa, l'implementazione completa prosegue.
- **Asse di differenza:** temporalità + confini (decision gate embedded nel piano, non nella struttura PR)
- **Pro:** un solo ciclo di review; WebGPU incluso fin dall'inizio; il gate di compatibilità è esplicito nel piano e bloccante; meno contesto da riaprire in una seconda PR
- **Contro:** se lo spike rivela problemi parziali (es. WebGPU OK ma threading problematico), la PR diventa più complessa da ritagliare; rischio che il reviewer veda una PR grande
- **Costo/tempo indicativo:** medio-alto (una PR, ma potenzialmente ampia)

---

## Rischi emersi (inversione / pre-mortem)

- **FORMAT_VERSION wipe silenzioso** → l'utente ha appena finito di re-indicizzare 5000 note con Gemma (2 ore di lavoro) e l'aggiornamento cancella l'indice senza avvisarlo chiaramente. Mitigazione: dialog esplicito prima del wipe (non solo banner in background), con stima del tempo di re-index basata sulla dimensione del vault.
- **WebGPU crash su driver instabili** → `navigator.gpu` è disponibile ma la sessione ONNX crasha silenziosamente a metà inference, producendo embedding corrotti o parziali. Mitigazione: il fallback WASM deve scattare su errore di sessione, non solo su assenza di `navigator.gpu`; test con un modello piccolo prima di caricare Gemma 300M.
- **Bundle size growth inatteso** → `@huggingface/transformers` v4 porta WASM workers, threading, e backend aggiuntivi che gonfiano il bundle. Mitigazione: audit del bundle post-build; `external` declarations in `bun.config.ts` aggiornate se necessario; smoke test su Obsidian reale, non solo su `bun build`.
- **import.meta.url non risolto in v4** → Task 1 spike fallisce: il loader Obsidian non riesce a caricare il plugin. Mitigazione: piano di fallback documentato nella SPEC (Bug 2+3 null-guards); lo spike deve fallire esplicitamente con un errore chiaro, non silenziosamente.

---

## Idee adiacenti emerse

- **Lazy DLC per Gemma** — invece di scaricare il modello al primo avvio, mostrare un banner "Gemma disponibile" e scaricare solo su click esplicito dell'utente. Risolverebbe il problema setup-friction (190 MB a freddo). [future — non nel scope di questo upgrade]
- **Matryoshka dim configurabile per Gemma** — il modello supporta 256/384/512/768d nativamente; esporre come slider nelle settings riduce storage e latenza con piccola perdita di qualità. [future — annotare nell'ADR come opzione]

---

## Raccomandazione preliminare

**Ibrido B+C**: struttura single-PR (un solo ciclo di review) ma con Task 1 spike bloccante come da Alt C, e WebGPU incluso ma validato post-session da folotp prima del merge come da Alt B. In pratica: piano in 6-8 task, Task 1 è il compatibilità-spike (se fallisce → fallback; se passa → tutto il resto), Task finale è la validazione su vault reale.

Task 0 (model-ID hunt, ~30 minuti) va eseguito prima del dispatch del coder, come check rapido: se un export IR ≤ v8 esiste, l'intera catena viene bypassata.

**Dichiarata come raccomandazione preliminare**: da validare dall'architect.

---

## Note per l'architect

- **Task 0 pre-spike**: verificare l'esistenza di un export IR ≤ v8 di EmbeddingGemma 300M su HuggingFace prima di scrivere codice. Se trovato, l'upgrade di runtime diventa opzionale — l'ADR deve documentare questa verifica e il suo esito.
- **FORMAT_VERSION bump**: l'ADR deve specificare esattamente quando scatta il dialog di conferma wipe — al plugin load, al primo utilizzo di search, o su provider-switch. Il comportamento attuale (banner in background) è insufficiente per un wipe distruttivo.
- **WebGPU fallback granularity**: il fallback non deve scattare solo su `!navigator.gpu` ma su qualsiasi errore di inizializzazione sessione. L'ADR deve specificare quale errore è recuperabile (retry WASM) e quale è terminale (log + disable provider).
- **Requisiti nuovi da riportare in SPEC**: il dialog esplicito pre-wipe non è esplicitamente nella SPEC attuale; se si adotta, aggiungere un edge case con il comportamento atteso.

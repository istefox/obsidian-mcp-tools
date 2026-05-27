# BRAINSTORM — Multilingual embedding providers for search_vault_smart

**Data:** 2026-05-27
**Fonte requisiti:** SPEC.md at `/Users/stefanoferri/Developer/Obsidian_MCP/obsidian-mcp-tools/SPEC.md`
**Tecniche applicate:** first-principles decomposition, assumption-busting, analogie cross-dominio (DLC/videogioco), inversione/pre-mortem

---

## Problema riformulato (first-principles)

Il risultato irriducibile è **trovare note pertinenti in qualsiasi lingua, senza dipendenze cloud, con continuità operativa durante l'aggiornamento del modello**. Il vettore denso è uno strumento, non il fine; il modello locale è un vincolo fisso (dato non lascia il dispositivo). La dimensionalità e il provider specifico sono dettagli tecnici subordinati a questo obiettivo.

---

## Assunzioni sfidate

- **768 dimensioni fisse** — esito: **aperta** — Matryoshka permette di servire 256/384/512/768d dallo stesso modello; il trade-off qualità/storage/latenza va esplorato nell'ADR. Non è un requisito fisico, è una scelta conservativa.
- **Re-index totale al cambio provider** — esito: **confermata** — spazi vettoriali di provider diversi sono incompatibili; non ha senso mixarli. Il DLC pattern non evita il rebuild, ma può renderlo non-bloccante (native rimane attivo durante la build).
- **Selezione provider sempre esplicita** — esito: **sfidabile** — l'utente vuole un `auto`-mode esteso che rilevi la lingua dominante della vault e scelga il provider ottimale senza richiedere selezione manuale.

---

## Alternative di approccio

### Alternativa A — SPEC fedele + DLC UX

- **Idea:** Implementa la SPEC esattamente (EmbeddingProvider interface, native refactored, EmbeddingGemma + e5-base, chunker upgrade, migration path) ma adotta il pattern DLC per l'UX: la ricerca native rimane attiva durante il download del modello e la build dell'indice. Il nuovo provider si attiva solo quando il suo indice è pronto. Nessun blackout.
- **Asse di differenza:** dati + UX (store per-providerKey, nessun momento in cui la ricerca è completamente disabilitata)
- **Pro:** scope preciso, nessuna deviazione dalla SPEC concordata; DLC UX riduce la friction senza aumentare la complessità architetturale
- **Contro:** bundle largo (EmbeddingGemma 190 MB + e5-base ~100 MB); tre provider da mantenere; PR potenzialmente grande
- **Costo/tempo indicativo:** alto

### Alternativa B — e5-base MVP multilingue

- **Idea:** Implementa l'EmbeddingProvider interface e aggiunge solo `multilingual-e5-base` come provider multilingue (MIT, ~100 MB, 512 context). EmbeddingGemma deferred. Chunker upgrade incluso.
- **Asse di differenza:** deployment (meno download, meno complessità ONNX, feature parziale ma funzionante prima)
- **Pro:** download dimezzato (~100 MB vs 190 MB); meno surface ONNX da gestire; rilascio più rapido; e5-base è già ben supportato da transformers.js
- **Contro:** nessuna vault a 2K context; qualità inferiore su query lunghe; EmbeddingGemma richiede un secondo ciclo
- **Costo/tempo indicativo:** medio

### Alternativa C — Interface-first, models deferred

- **Idea:** PR 1: EmbeddingProvider interface + migration path (flat → per-providerKey) + chunker upgrade. PR 2 (follow-up): aggiunta dei due provider multilingue. La suite test coprì l'esistente prima di toccare la logica di embedding.
- **Asse di differenza:** temporalità (disaccoppia refactor strutturale dall'aggiunta di nuove dipendenze pesanti)
- **Pro:** massimizza la copertura test sul path native prima del rischio di regressione; ogni PR è più piccola e reviewable; il refactor strutturale è prezioso anche senza i nuovi modelli
- **Contro:** due cicli separati; la feature "multilingue" non è utilizzabile fino alla PR 2; richiede disciplina per non riaprire la PR 1
- **Costo/tempo indicativo:** medio (ma distribuito)

### Alternativa D — Auto-detect esteso + DLC (ibrido A + auto)

- **Idea:** Come A, ma il provider `"auto"` viene esteso con language detection sulla vault (campionamento di note, rilevamento lingua dominante). Se il vault è prevalentemente non-inglese e EmbeddingGemma è disponibile, auto seleziona il provider ottimale con un banner di suggerimento. La selezione esplicita resta sempre possibile.
- **Asse di differenza:** confini di responsabilità (il sistema assume decisione di selezione, non l'utente)
- **Pro:** UX zero-config per la maggior parte degli utenti multilingue; coerente con la logica già presente in `"auto"` per SC vs native
- **Contro:** language detection aggiunge complessità e un possibile punto di errore; "auto che scarica 190 MB silenziosamente" è un rischio UX se non comunicato chiaramente
- **Costo/tempo indicativo:** alto

---

## Rischi emersi (inversione / pre-mortem)

- **Setup friction** (modello troppo pesante) → l'utente avvia il download di 190 MB, aspetta 30 minuti, e abbandona il setup. Mitigazione: DLC pattern (native resta attivo), stima visibile di dimensione e tempo prima del click, possibilità di usare e5-base come alternativa più leggera.
- **Regressioni sul path native** → il refactor del chunker o della store introduce un bug silenzioso nella ricerca inglese per chi non cambia mai provider. Mitigazione: test suite completa sul path native prima di toccare qualsiasi shared code; chunker upgrade come step separato e verificato indipendentemente.
- **Complessità di manutenzione esplosa** → tre provider, due index path, migration code, chunker nuovo: ogni PR tocca tutto e i test non coprono l'integrazione. Mitigazione: `TransformersProvider` base class condivisa; indici per-providerKey isolati (un bug in Gemma non corrompe native); integration test per il migration path.

---

## Idee adiacenti emerse

- **Ricerca ibrida vettori + BM25** — batterebbe il puro vettoriale su query corte; architetturalmente richiederebbe un layer di fusion score non previsto. [future]
- **Matryoshka dim configurabile** (slider 256/512/768d in settings per EmbeddingGemma) — il modello lo supporta nativamente; dimensioni ridotte = indice ~2x più piccolo + ricerca più veloce, con leggera perdita di qualità. [future — da annotare come opzione nell'ADR senza implementare]
- **Bundle e5-base nel plugin** (nessun download, +~100 MB sul plugin scaricato) — non praticabile: l'Obsidian store ha limiti di dimensione del plugin e i 100 MB a freddo penalizzano tutti gli utenti anche quelli che non usano la feature. [esplicitamente esclusa]

---

## Raccomandazione preliminare

**Alternativa A** (SPEC fedele) è la scelta più solida, con due integrazioni dal brainstorm che non aumentano il costo ma riducono i rischi:

1. **DLC UX**: la ricerca native rimane attiva durante il download e il rebuild — nessun blackout. Questo elimina il rischio setup friction senza aggiungere complessità architetturale.
2. **Auto-mode esteso** (Alternativa D semplificata): `"auto"` suggerisce EmbeddingGemma via banner se rileva contenuto non-inglese, ma non scarica nulla senza consenso esplicito. Language detection superficiale (campione di note, heuristica su caratteri non-ASCII).

Se il team vuole ridurre il rischio di regressione e il tempo al primo rilascio, **Alternativa C** (interface-first) è la seconda scelta: il refactor strutturale è prezioso da solo e permette di verificare l'esistente prima di aggiungere i nuovi modelli pesanti.

**Dichiarata come raccomandazione preliminare**: da validare dall'architect.

---

## Note per l'architect

- **Matryoshka dim**: valutare se esporre dim come parametro dell'`EmbeddingProvider` interface (es. `readonly dimensions: number`) in modo che un futuro provider possa dichiarare dimensioni variabili, senza implementare il configuratore ora. Annotare come `future` nell'ADR.
- **DLC UX e stato store**: il provider attivo nelle settings può divergere dall'indice disponibile. L'architect deve chiarire quale è la source of truth durante il rebuild e come gestire query concorrenti al vecchio indice mentre il nuovo si costruisce.
- **Language detection per auto-mode**: la detection può essere lazy (sul primo accesso alle note) o eager (al caricamento del plugin). L'eager detection può rallentare il plugin load su vault grandi. Valutare soglia o campionamento.
- **Migration path testing**: il migration test (flat `embeddings/` → `embeddings/native-minilm-l6-v2/`) va coperto con un integration test che usa un filesystem reale (non mock) — la logica coinvolge path-join e rename, difficile da testare in isolamento.
- **Requisiti nuovi da riportare in SPEC**: l'auto-mode esteso con language detection non è esplicitamente in SPEC; se si adotta, aggiungere un paragrafo al comportamento di `"auto"`.

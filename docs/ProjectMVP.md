# Project MVP

## 1. Kernziel

Eine Next.js Webapp, die PDFs oder Markdown-Dateien (z.B. Vorlesungsfolien/Skripte) einliest, den Inhalt in Sections aufteilt und daraus mit klaren, kostensparenden Worksteps eine Zusammenfassung sowie Lernmaterial (Flashcards/Quiz) erzeugt.

## 2. MVP Scope (explizit, klein)

### 2.1 User Flow (clean Worksteps)

1. Upload (PDF/MD) -> Text extrahieren/normalisieren
2. Output-Modus im Header waehlen: Summary / Flashcards / Quiz
3. Modell waehlen
4. Generieren + Preview

### 2.2 Outputs (MVP)

- Summary (MVP: whole document; keine Page/Section-Auswahl im UI):
  - 5-10 Bullet Points + Key Definitions
- Flashcards (systemseitig bestimmt; User waehlt nur grob "Menge" 1-3):
  - Q/A Cards + Cloze Cards
  - Fullscreen Study-View (Flip + Keyboard)
  - Export:
    - Markdown (lesbar)
    - TSV (Anki/Spreadsheet Import)
  - Jede Card speichert Provenance:
    - `sectionId`
    - `sourceSnippet` (kurzes Zitat, 1-3 Saetze aus dem Section-Text)
    - optional `page` (falls beim PDF-Parsing verfuegbar)
- Quiz (MCQ v0):
  - Generierung in Batches (system `N`)
  - UI zeigt jeweils 1 Frage; Antworten sind klickbar + Feedback; "Next" zeigt die naechste und laedt neue Fragen nach Bedarf nach
  - Quelle ist im UI einklappbar (Details)
  - Export:
    - Markdown (gesamtes Quiz)
    - JSON (raw, fuer spaetere Formate)

### 2.3 Kosten-/Token-Strategie (MVP)

- Keine Page/Section-Selection im UI (keep it simple).
- Quiz/Flashcards nur batch-weise generieren (kein "alles upfront").
- Caching: `(docHash, mode, model, params)` -> wiederverwenden.

## 3. Tech-Stack

- Framework: Next.js (App Router), TypeScript
- KI-Integration: Vercel AI SDK
- KI-Provider: OpenRouter (Flexibilitaet bei der Modellauswahl)
- Modelle/Preise: `config/openrouter-models.example.json` (optional: `config/openrouter-models.json`)
- PDF-Parsing: `pdf-parse` oder `pdfjs-dist`
- Kosten-Analyse: Token-/Kosten-Logik in `lib/token-cost.ts` und `lib/usage.ts`
- Optional (wenn schon vorhanden/gewuenscht): Notion Export via `@notionhq/client`

## 4. KI-Konfiguration (Leitplanken)

- System/Regelwerk bleibt "oberstes Gesetz".
- Base Guidelines:
  - General: `guidelines/general.en.md` 
  - Summary add-on: `guidelines/summary.en.md` 
- Mode-spezifische Add-ons:
  - Flashcards: `guidelines/flashcards.en.md` 
  - Quiz: `guidelines/quiz.en.md` 
- Prompts sind kurz, section-basiert, und erzwingen:
  - kein Halluzinieren
  - Output-Format stabil (Markdown/JSON)
  - Provenance-Felder (`sourceSnippet`, `sectionId`, optional `page`)

## 5. Out of scope (nicht MVP)

- User Login / Accounts
- Subscription-Tiers nach Modellen
- Bring-your-own AI keys (OpenRouter/Claude/OpenAI/Gemini/...)
- User-Dashboards / "grosse Overviews" ueber viele Dokumente
- Concept Maps / Prerequisite Graphs
- Full lecture / exam-like quizzes

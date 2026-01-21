## 1. Kernziel

Eine Next.js Webapp, die Vorlesungsfolien (PDF) einliest, basierend auf einem strikten Anforderungskatalog zusammenfasst und das Ergebnis formatiert direkt in eine Notion-Datenbank/Seite exportiert.

## 2. Tech-Stack

- Framework: Next.js (App Router), TypeScript
- KI-Integration: Vercel AI SDK
- KI-Provider: OpenRouter (Flexibilität bei der Modellauswahl)
- Modelle/Preise: `config/openrouter-models.example.json` (optional: `config/openrouter-models.json`)
- Notion: `@notionhq/client` (Notion SDK für JavaScript)
- PDF-Parsing: `pdf-parse` oder `pdfjs-dist`
- Kosten-Analyse: Token-/Kosten-Logik in `lib/token-cost.ts` und `lib/usage.ts`

## 3. UI-Komponenten (Single-Page)

- Header: Titel & Status-Anzeige
- Config-Bar:
  - Dropdown: Fach-Auswahl (lädt Seiten aus Notion)
  - Dropdown: KI-Modell (OpenRouter IDs, z.B. `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`)
- Input-Zone:
  - File-Dropzone für PDF-Upload
  - Kosten-Vorschau: Tokens & geschätzte Kosten direkt nach Upload
  - Input für optionale Strukturvorgaben (Überschriften)
- Output- & Edit-Zone:
  - Preview-Fenster für die generierte Zusammenfassung (Markdown)
  - Chat-Leiste zur Verfeinerung (z.B. „Erkläre Thema X genauer“, „Fasse kürzer“)
- Action-Button: „Final nach Notion exportieren“

## 4. KI-Konfiguration (System-Prompt)

Identität:

Du bist ein spezialisierter KI-Assistent für akademische Aufbereitung. Deine Aufgabe ist es, komplexe Vorlesungsskripte in hocheffiziente, prüfungsorientierte Zusammenfassungen zu transformieren.

Arbeitsumgebung & Materialien:

1. Regelwerk: `KI-Vorgaben.md` (oberstes Gesetz)
2. Quelle: Text-Extrakt aus Uni-Folien (60–100 Seiten)
3. Kontext: Export nach Notion für langfristige Klausurvorbereitung

## 5. Workflow & Notion-Logik

1. Upload: PDF → Text extrahieren → Kosten-Check anzeigen
2. Generierung: Text + Regeln → OpenRouter über Vercel AI SDK
3. Refinement: Änderungen über Chat-Leiste (State via SDK)
4. Export:
   - Ziel: Unterseite (Child-Page) innerhalb der gewählten Fach-Seite in Notion
   - Markdown-Struktur wird in Notion-Blocks übersetzt

## 6. Referenzierte Dateien

- Regeln: `KI-Vorgaben.md` / `KI-Vorgaben-kurz.md` (müssen bei jeder Zusammenfassung vorliegen)
- Modelle/Preise: `config/openrouter-models.example.json`

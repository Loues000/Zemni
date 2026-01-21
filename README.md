# Summary Maker

Eine Next.js Webapp, die Vorlesungsfolien (PDF) einliest, anhand eines Regelwerks zusammenfasst und das Ergebnis direkt nach Notion exportiert.

## Features

- PDF-Upload mit Textextraktion
- Prüfungsorientierte Zusammenfassungen über OpenRouter (mehrere Modelle)
- Token-/Kosten-Schätzung vor der Generierung
- Iterative Verfeinerung per Chat
- Export nach Notion (Unterseite innerhalb eines Fachs)
- Markdown-Preview inkl. LaTeX (KaTeX)

## Tech-Stack

- Next.js 14 (App Router), TypeScript
- Vercel AI SDK (`ai`)
- OpenRouter als Provider
- Notion SDK (`@notionhq/client`)
- PDF: client-side `pdfjs-dist` + Server-Fallback
- Token Counting: `@dqbd/tiktoken`

## Voraussetzungen

- Node.js 18+ und npm
- OpenRouter API Key: https://openrouter.ai
- Notion API Token + Datenbank-ID: https://notion.so/my-integrations

## Setup

```bash
npm install
```

Erstelle `.env.local` im Repo-Root:

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=http://localhost:3420
OPENROUTER_APP_NAME=Summary Maker

NOTION_TOKEN=secret_...
NOTION_SUBJECTS_DATABASE_ID=...
```

```bash
npm run dev
```

App läuft auf http://localhost:3420

## Projektstruktur (Kurz)

```
app/                      # Next.js Routes (App Router)
  api/                    # Route Handlers (models, summarize, refine, notion, ...)
  components/app-client.tsx
  layout.tsx
  page.tsx

components/               # UI/Feature-Komponenten (shared)
  features/
  ui/
hooks/                    # Custom React Hooks
types/                    # Shared TypeScript Types
lib/                      # Shared Libraries (OpenRouter, Notion, Prompts, ...)
  parse-pdf-client.ts     # Client-side PDF Parsing (pdfjs)
config/                   # Konfiguration (Modelle/Preise)
docs/                     # Projekt-Doku (MVP, TODOs, ...)
KI-Vorgaben.md
KI-Vorgaben-kurz.md
```

## Modell-Konfiguration

Die Modell-Liste/Preise liegen in `config/`. Standardmäßig wird `config/openrouter-models.example.json` verwendet.

Für eigene Modelle/Preise kannst du `config/openrouter-models.json` (und optional `config/openrouter-models.prices.json`) anlegen.

## Development

```bash
npm run dev
npm run build
npm run start
```

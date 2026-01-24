# Zemni

A Next.js web app that ingests lecture slides (PDF), summarizes them based on a rule set, and exports the result directly to Notion.

## Features

- PDF upload with text extraction
- Exam-focused summaries via OpenRouter (multiple models)
- Flashcards (fullscreen study view) + export (MD/TSV)
- Quiz (MCQ) + feedback + export (MD/JSON)
- Token/cost estimation before generation
- Iterative refinement via chat
- Export to Notion (subpage within a subject)
- Markdown preview incl. LaTeX (KaTeX)

## Tech stack

- Next.js 14 (App Router), TypeScript
- Vercel AI SDK (`ai`)
- OpenRouter as provider
- Notion SDK (`@notionhq/client`)
- PDF: client-side `pdfjs-dist` + server fallback
- Token counting: `@dqbd/tiktoken`

## Prerequisites

- Node.js 18+ and npm
- OpenRouter API Key: https://openrouter.ai
- Notion API token + database ID: https://notion.so/my-integrations

## Setup

```bash
npm install
```

Create `.env.local` in the repo root:

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

App runs on http://localhost:3420

## Project structure (short)

```
app/                      # Next.js Routes (App Router)
  api/                    # Route Handlers (models, summarize, refine, notion, ...)
  components/app-client.tsx
  layout.tsx
  page.tsx

components/               # UI/feature components (shared)
  features/
  ui/
hooks/                    # Custom React Hooks
types/                    # Shared TypeScript Types
lib/                      # Shared Libraries (OpenRouter, Notion, Prompts, ...)
  parse-pdf-client.ts     # Client-side PDF Parsing (pdfjs)
config/                   # Configuration (models/prices)
docs/                     # Project docs (MVP, TODOs, ...)
guidelines/               # AI rule sets (general + mode add-ons)
  general.en.md
  summary.en.md
  flashcards.en.md
  quiz.en.md
  base.de.md              # legacy DE (kept for reference)
  base.full.de.md         # legacy DE (kept for reference)
```

## Model configuration

Model lists/prices live in `config/`. By default, `config/openrouter-models.example.json` is used.

For your own models/prices, create `config/openrouter-models.json` (and optionally `config/openrouter-models.prices.json`).

## Development

```bash
npm run dev
npm run build
npm run start
```

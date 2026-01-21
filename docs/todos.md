- eingeruckte codeblocke ueberarbeiten

app/
├── api/                    # Keep as is (already well-organized)
├── components/
│   ├── app-client.tsx      # Main orchestrator (~200 lines)
│   ├── ui/                 # Presentational components
│   │   ├── Button.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Icon.tsx
│   │   └── ...
│   ├── features/           # Feature-specific components
│   │   ├── HistorySidebar.tsx
│   │   ├── OutputTabs.tsx
│   │   ├── CostPreview.tsx
│   │   ├── SummaryPreview.tsx
│   │   ├── RefineBar.tsx
│   │   └── InputPanel.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
├── globals.css
├── layout.tsx
└── page.tsx

lib/
├── api/                   # API route logic handlers
│   ├── handlers/
│   │   ├── models-handler.ts
│   │   ├── pdf-handler.ts
│   │   ├── token-estimate-handler.ts
│   │   ├── summarize-handler.ts
│   │   ├── refine-handler.ts


│   │   └── notion-handler.ts
│   ├── models.ts
│   ├── notion.ts
│   ├── openrouter.ts
│   ├── prompts.ts
│   ├── token-cost.ts
│   ├── usage.ts
│   ├── markdown.ts
│   ├── normalize-pdf-text.ts
│   ├── parse-pdf-client.ts
│   └── format-output.ts

hooks/
├── useHistory.ts
├── useTokenEstimate.ts
├── usePDFParser.ts
└── useSummaryState.ts

types/
├── index.ts
├── models.ts
├── summary.ts
└── history.ts
# Summary Maker

Eine Next.js Webapp, die Vorlesungsfolien (PDF) einliest, basierend auf einem strikten Anforderungskatalog zusammenfasst und das Ergebnis formatiert direkt in eine Notion-Datenbank/Seite exportiert.

## 🎯 Features

- **PDF-Upload**: Hochladen von Vorlesungsfolien (PDF) mit automatischer Textextraktion
- **KI-gestützte Zusammenfassung**: Automatische Generierung prüfungsorientierter Zusammenfassungen mit verschiedenen KI-Modellen über OpenRouter
- **Kostenanalyse**: Echtzeit-Token-Zählung und Kostenberechnung vor der Generierung
- **Iterative Verfeinerung**: Chat-Interface zur interaktiven Verbesserung der Zusammenfassungen
- **Notion-Export**: Direkter Export der Zusammenfassungen als Unterseiten in Notion
- **Markdown-Preview**: Live-Vorschau der generierten Zusammenfassung mit LaTeX-Unterstützung
- **Modellauswahl**: Flexibler Wechsel zwischen verschiedenen KI-Modellen (GPT, Claude, Gemini, etc.)

## 🛠️ Tech-Stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **KI-Integration**: Vercel AI SDK
- **KI-Provider**: OpenRouter (Flexibilität bei der Modellauswahl)
- **Notion**: @notionhq/client (Notion SDK für JavaScript)
- **PDF-Parsing**: pdf-parse
- **Token-Counting**: @dqbd/tiktoken
- **Markdown**: react-markdown mit LaTeX-Unterstützung (KaTeX)

## 📋 Voraussetzungen

- **Node.js** 18+ und npm
- **Python** 3.8+ (für Token Analyser CLI-Tool, optional)
- **OpenRouter API Key** ([openrouter.ai](https://openrouter.ai))
- **Notion API Token** und Notion-Datenbank-ID ([notion.so/my-integrations](https://notion.so/my-integrations))

## 🚀 Setup

### 1. Repository klonen und Dependencies installieren

```bash
npm install
```

### 2. Environment-Variablen konfigurieren

Erstelle eine `.env.local` Datei im Hauptverzeichnis:

```env
# OpenRouter (erforderlich)
OPENROUTER_API_KEY=sk-or-v1-...

# OpenRouter (optional)
OPENROUTER_SITE_URL=http://localhost:3420
OPENROUTER_APP_NAME=Summary Maker

# Notion (erforderlich)
NOTION_TOKEN=secret_...
NOTION_SUBJECTS_DATABASE_ID=...
```

**OpenRouter API Key:**
1. Registriere dich auf [openrouter.ai](https://openrouter.ai)
2. Erstelle einen API Key in den Einstellungen
3. Füge Credits zu deinem Account hinzu

**Notion Integration:**
1. Gehe zu [notion.so/my-integrations](https://notion.so/my-integrations)
2. Erstelle eine neue Integration
3. Kopiere den "Internal Integration Token"
4. Teile deine Notion-Datenbank mit der Integration (Share → Invite → Integration)

### 3. Development-Server starten

```bash
npm run dev
```

Die App läuft dann auf [http://localhost:3420](http://localhost:3420)

## 📁 Projektstruktur

```
Summary_Maker/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── models/        # Modell-Liste
│   │   ├── parse-pdf/     # PDF-Text-Extraktion
│   │   ├── token-estimate/# Token- und Kosten-Schätzung
│   │   ├── summarize/     # Zusammenfassung generieren
│   │   ├── refine/        # Zusammenfassung verfeinern
│   │   └── notion/        # Notion-Export
│   ├── components/        # React-Komponenten
│   └── page.tsx           # Hauptseite
├── lib/                   # Shared Libraries
│   ├── models.ts          # Modell-Konfiguration
│   ├── openrouter.ts     # OpenRouter-Client
│   ├── notion.ts          # Notion-Client
│   ├── prompts.ts         # KI-Prompts
│   ├── token-cost.ts      # Token-Kosten-Berechnung
│   └── ...
├── Token Analyser/        # Python CLI-Tool (optional)
│   ├── main.py           # Token-Analyse-Script
│   ├── models.example.json # Modell-Preise
│   └── README.md         # Detaillierte Dokumentation
├── KI-Vorgaben.md        # Zusammenfassungs-Regeln (wird von KI verwendet)
├── KI-Vorgaben-kurz.md   # Kurzversion der Regeln
└── docs/                 # Projekt-Dokumentation
```

## 🔧 Token Analyser (Python CLI)

Das Projekt enthält ein optionales Python CLI-Tool zur Token-Analyse und Kostenberechnung. Siehe [Token Analyser/README.md](./Token%20Analyser/README.md) für Details.

**Schnellstart:**
```powershell
cd "Token Analyser"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python .\main.py .\Examples\07-SW-Testing.pdf --output-tokens 500
```

## 📝 Verwendung

1. **Fach auswählen**: Wähle ein Fach aus dem Notion-Dropdown (lädt Seiten aus deiner Notion-Datenbank)
2. **Modell wählen**: Wähle ein KI-Modell aus der Liste
3. **PDF hochladen**: Lade eine PDF-Datei hoch
4. **Kosten prüfen**: Die App zeigt automatisch Token-Anzahl und geschätzte Kosten
5. **Zusammenfassung generieren**: Klicke auf "Zusammenfassung generieren"
6. **Verfeinern** (optional): Nutze das Chat-Interface, um die Zusammenfassung zu verbessern
7. **Exportieren**: Exportiere die finale Zusammenfassung nach Notion

## 🎨 KI-Konfiguration

Die Zusammenfassungen werden basierend auf den Regeln in `KI-Vorgaben.md` und `KI-Vorgaben-kurz.md` generiert. Diese Dateien definieren:
- Stil und Format der Zusammenfassungen
- Struktur-Anforderungen
- No-Gos und Best Practices

Die Regeln werden automatisch bei jeder Zusammenfassung an die KI übergeben.

## 🔐 Modell-Konfiguration

Modell-Preise und Konfigurationen werden in `Token Analyser/models.example.json` verwaltet. Die Datei unterstützt zwei Formate:

**Format 1 (empfohlen, OpenRouter-kompatibel):**
```json
[
  {
    "id": "openai/gpt-4o",
    "display_name": "GPT-4o",
    "tokenizer": { "tiktoken_encoding": "o200k_base" },
    "pricing": { "currency": "USD", "input_per_1m": 3.0, "output_per_1m": 15.0 }
  }
]
```

**Format 2 (legacy):**
```json
[
  {
    "name": "gpt-4o",
    "provider": "openai",
    "tokenizer": { "tiktoken_encoding": "o200k_base" },
    "pricing": { "currency": "USD", "input_per_1m": 3.0, "output_per_1m": 15.0 }
  }
]
```

## 📚 Weitere Dokumentation

- [Token Analyser README](./Token%20Analyser/README.md) - Detaillierte Dokumentation des Python CLI-Tools
- [Project MVP](./docs/ProjectMVP.md) - Projekt-Spezifikation und Anforderungen

## 🛠️ Development

```bash
# Development-Server
npm run dev

# Production Build
npm run build
npm start

# Linting
npm run lint
```

## 📄 License

Private Projekt - Keine öffentliche Lizenz

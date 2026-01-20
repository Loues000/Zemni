# Token Analyser

Kleines CLI-Tool, das aus einer PDF (oder Textdatei) Text extrahiert, Tokens zählt und daraus Kosten anhand deiner Modell-Preise berechnet.

## Setup (Windows / PowerShell)

Im Projektordner `Token Analyser`:

```powershell
cd "Token Analyser"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Beispiel ausführen

```powershell
python .\main.py .\Examples\07-SW-Testing.pdf --models-file .\models.example.json --output-tokens 500
```

Wenn du `--models-file` weglässt, nimmt das Script automatisch `models.json` (falls vorhanden), sonst `models.example.json` aus dem Ordner.

## Preise eintragen

In `models.example.json` sind die Preise als **USD pro 1M Tokens** hinterlegt:

- `pricing.input_per_1m`: Input-Kosten pro 1.000.000 Tokens
- `pricing.output_per_1m`: Output-Kosten pro 1.000.000 Tokens

Das JSON-Format unterstützt zwei Varianten:

**Variante 1: Mit `id` (empfohlen, kompatibel mit OpenRouter):**
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

**Variante 2: Mit separaten `name` und `provider` Feldern:**
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

## One-liner

Optional: `run.ps1` richtet `.venv` ein, installiert Dependencies und startet direkt ein PDF:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1 -Pdf ".\Examples\07-SW-Testing.pdf" -OutputTokens 500
```

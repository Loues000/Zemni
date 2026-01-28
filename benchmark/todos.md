# Benchmark System - TODOs

## Public Results für Vercel Deployment

### Problem
- `benchmark/results/` ist in `.gitignore` → Dateien werden nicht zu Vercel hochgeladen
- Benchmarks-Seite auf Vercel zeigt keine Daten, weil JSON-Dateien fehlen

### Lösung
Erstelle `benchmark/public-results/` Verzeichnis für Results, die zu Vercel hochgeladen werden sollen.

### Implementierungsschritte

1. **Verzeichnisstruktur erstellen**
   - Erstelle `benchmark/public-results/` Verzeichnis
   - Stelle sicher, dass es NICHT in `.gitignore` ist

2. **Copy-Script erstellen**
   - Erstelle `benchmark/copy_results_for_deploy.py` oder `.sh`
   - Script kopiert nur die wichtigsten Dateien:
     - `benchmark_results.json`
     - `benchmark_metrics.json`
   - Optional: Komprimiere oder minimiere JSON (wenn zu groß)

3. **API-Route anpassen**
   - Ändere `app/api/benchmarks/route.ts`
   - Lese von `benchmark/public-results/` statt `benchmark/results/`
   - Fallback zu `benchmark/results/` für lokale Entwicklung

4. **Workflow dokumentieren**
   - Nach jedem Benchmark-Lauf: Script ausführen
   - Oder automatisch in `run_benchmark.py` integrieren (optional)

### Dateien die angepasst werden müssen

- [ ] `benchmark/public-results/` Verzeichnis erstellen
- [ ] `benchmark/copy_results_for_deploy.py` Script erstellen
- [ ] `app/api/benchmarks/route.ts` anpassen (mit Fallback)
- [ ] `.gitignore` prüfen (sollte `public-results/` NICHT ignorieren)
- [ ] `benchmark/README.md` aktualisieren mit Workflow-Anleitung

### Code-Änderungen

#### 1. Copy-Script (`benchmark/copy_results_for_deploy.py`)
```python
"""Copy benchmark results to public-results directory for deployment."""
import shutil
from pathlib import Path

RESULTS_DIR = Path(__file__).parent / "results"
PUBLIC_RESULTS_DIR = Path(__file__).parent / "public-results"

def copy_results_for_deploy():
    """Copy benchmark results to public directory."""
    PUBLIC_RESULTS_DIR.mkdir(exist_ok=True)
    
    files_to_copy = [
        "benchmark_results.json",
        "benchmark_metrics.json"
    ]
    
    for file in files_to_copy:
        src = RESULTS_DIR / file
        dst = PUBLIC_RESULTS_DIR / file
        
        if src.exists():
            shutil.copy2(src, dst)
            print(f"✓ Copied {file}")
        else:
            print(f"⚠ {file} not found, skipping")

if __name__ == "__main__":
    copy_results_for_deploy()
```

#### 2. API-Route anpassen (`app/api/benchmarks/route.ts`)
```typescript
// Ändere Pfade zu:
const resultsPath = path.join(process.cwd(), "benchmark", "public-results", "benchmark_results.json");
const metricsPath = path.join(process.cwd(), "benchmark", "public-results", "benchmark_metrics.json");

// Mit Fallback zu results/ für lokale Entwicklung:
// Erst public-results prüfen, dann results/ als Fallback
```

#### 3. Optional: Automatisch in run_benchmark.py integrieren
```python
# Am Ende von run_benchmark.py, nach dem Speichern der Results:
from copy_results_for_deploy import copy_results_for_deploy
copy_results_for_deploy()
```

### Workflow nach Implementierung

1. Benchmark lokal ausführen: `python benchmark/run_benchmark.py --models "..." --tasks summary`
2. Results werden in `benchmark/results/` gespeichert
3. Script ausführen: `python benchmark/copy_results_for_deploy.py`
4. Results werden nach `benchmark/public-results/` kopiert
5. Commit & Push → Dateien werden zu Vercel hochgeladen
6. Benchmarks-Seite auf Vercel zeigt Daten

### Notizen
- `public-results/` sollte NICHT in `.gitignore` sein
- Nur die wichtigsten Dateien kopieren (nicht Cache, Logs, etc.)
- Optional: JSON minifizieren wenn zu groß (>1MB)

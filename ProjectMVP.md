1. Kernziel


Eine Next.js Webapp, die Vorlesungsfolien (PDF) einliest, basierend auf einem strikten Anforderungskatalog zusammenfasst und das Ergebnis formatiert direkt in eine Notion-Datenbank/Seite exportiert.

2. Tech-Stack

- Framework: Next.js (App Router), TypeScript.

- KI-Integration: Vercel AI SDK.

- KI-Provider: OpenRouter (Flexibilität bei der Modellauswahl). 

- Modelle: Modelle sind bereits in .\Token Analyser\models.example.json vorgegben und koennen so referenziert/uebernommen werden.

- Notion: @notionhq/client (Notion SDK für JavaScript).

- PDF-Parsing: pdf-parse oder pdfjs-dist.

- Kosten-Analyse: Integration einer Logik basierend auf der bestehenden ./Token Analyser/main.py.

3. UI-Komponenten (Single-Page)

- Header: Titel & Status-Anzeige.

- Config-Bar:
	- Dropdown: Fach-Auswahl (lädt Seiten aus Notion).

	- Dropdown: KI-Modell (OpenRouter IDs: e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o).


- Input-Zone:
	- File-Dropzone für PDF-Upload.

	- Kosten-Vorschau: Zeigt Tokens & geschätzte Kosten (basierend auf der Python-Logik) sofort nach PDF-Upload an.

	- Input-Feld für optionale Strukturvorgaben (Überschriften).


- Output- & Edit-Zone:
	- Preview-Fenster für die generierte Zusammenfassung (Markdown).

	- Iterative Chat-Leiste: Eingabefeld, um Änderungen an der Zusammenfassung per KI vorzunehmen (z.B. „Erkläre Thema X genauer“, „Fasse kürzer“).


- Action-Button: „Final nach Notion exportieren“.

4. KI-Konfiguration (System-Prompt)


Identität:

Du bist ein spezialisierter KI-Assistent für akademische Aufbereitung. Deine einzige Aufgabe ist es, komplexe Vorlesungsskripte in hocheffiziente, prüfungsorientierte Zusammenfassungen zu transformieren.

Arbeitsumgebung & Materialien:

Dir liegen drei Komponenten vor:


    1. Das Regelwerk (KI-Vorgaben): Ein Markdown-Dokument, das deinen Stil, deine Struktur und deine No-Gos strikt definiert. Dies ist dein oberstes Gesetz.

    2. Die Quelle: Ein Text-Extrakt aus Uni-Folien (60-100 Seiten).

    3. Der Kontext: Der Nutzer möchte dieses Material für die langfristige Klausurvorbereitung in Notion speichern.


5. Workflow & Notion-Logik

    1. Upload: Nutzer lädt PDF hoch -> Text wird extrahiert -> Kosten-Check wird angezeigt.

    2. Generierung: Vercel AI SDK sendet PDF-Text + Master-Vorgaben an OpenRouter.

    3. Refinement: Nutzer kann über die Chat-Leiste die Zusammenfassung im Preview-Fenster verfeinern (State Management über das SDK).

    4. Export:
        - Ziel: Eine neue Unterseite (Child-Page) innerhalb der gewählten Fach-Seite in Notion erstellen.

        - Die Markdown-Struktur der KI wird in Notion-Blocks übersetzt.


6. Referenzierte Dateien

- Zusammenfassungs-Regeln: sind immer in KI-Vorgaben.md und muessen bei jeder Zusammenfassung der KI vorliegen.

- Token-Logik: ./Token Analyser/main.py (muss nach TypeScript portiert oder als Microservice eingebunden werden) und auch die mitgegebenKI-Vorgaben bei not mit einrechnen.
import fs from "fs/promises";
import path from "path";

const BASE_IDENTITY = [
  "Du bist ein spezialisierter KI-Assistent fuer akademische Aufbereitung.",
  "Deine einzige Aufgabe ist es, komplexe Vorlesungsskripte in hocheffiziente, pruefungsorientierte Zusammenfassungen zu transformieren.",
  "",
  "Arbeitsumgebung und Materialien:",
  "1) Das Regelwerk (KI-Vorgaben) definiert Stil, Struktur und No-Gos und hat hoechste Prioritaet.",
  "2) Die Quelle ist ein Text-Extrakt aus Uni-Folien (60-100 Seiten).",
  "3) Der Kontext: Der Nutzer will das Material fuer die langfristige Klausurvorbereitung in Notion speichern."
].join("\n");

const loadGuidelines = async (): Promise<string> => {
  const files = ["guidelines/general.en.md", "guidelines/summary.en.md"];
  const parts = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(process.cwd(), file);
      try {
        return await fs.readFile(filePath, "utf8");
      } catch {
        return "";
      }
    })
  );
  return parts.filter((p) => p.trim().length > 0).join("\n\n---\n\n");
};

const FORMAT_CONTRACT = [
  "",
  "WICHTIG - Formatvertrag:",
  "- Ausgabe beginnt DIREKT mit einer H1-Ueberschrift (# Titel).",
  "- KEINE Metadaten, KEIN Frontmatter, KEINE einleitenden Kommentare.",
  "- Nur reines Markdown.",
  "- Ueberschriften niemals nummerieren (kein '## 1.' / '## I.' etc).",
  "- Wenn Mathe/Formeln vorkommen: nutze LaTeX (inline $...$, Display $$ ... $$) und erklaere Variablen direkt danach.",
  "- VERBOTEN: Abschluss-Saetze wie 'Damit kann man sich gut vorbereiten' oder 'Alles kommt aus den Vorlesungsfolien'."
].join("\n");

export const buildSummaryPrompts = async (text: string, structure?: string) => {
  const guidelines = await loadGuidelines();
  const systemPrompt = `${BASE_IDENTITY}\n\nRegelwerk (KI-Vorgaben):\n${guidelines}\n\nHalte dich strikt an das Regelwerk.${FORMAT_CONTRACT}`;
  const userPrompt = [
    "Quelle (PDF-Extrakt):",
    text,
    "",
    "Optionale Strukturvorgaben (Ueberschriften):",
    structure?.trim() ? structure.trim() : "Keine",
    "",
    "Gib ausschliesslich die fertige Zusammenfassung in Markdown aus. Beginne direkt mit # Titel."
  ].join("\n");

  return { systemPrompt, userPrompt };
};

export const buildRefineSystemPrompt = async (summary: string) => {
  const guidelines = await loadGuidelines();
  return [
    BASE_IDENTITY,
    "",
    "Regelwerk (KI-Vorgaben):",
    guidelines,
    FORMAT_CONTRACT,
    "",
    "Du ueberarbeitest die bestehende Zusammenfassung anhand der Nutzeranweisung.",
    "Gib ausschliesslich die vollstaendig aktualisierte Zusammenfassung in Markdown aus.",
    "Beginne direkt mit # Titel (H1-Ueberschrift).",
    "",
    "Aktuelle Zusammenfassung:",
    summary
  ].join("\n");
};

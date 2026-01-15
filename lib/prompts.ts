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
  const filePath = path.join(process.cwd(), "KI-Vorgaben.md");
  return fs.readFile(filePath, "utf8");
};

export const buildSummaryPrompts = async (text: string, structure?: string) => {
  const guidelines = await loadGuidelines();
  const systemPrompt = `${BASE_IDENTITY}\n\nRegelwerk (KI-Vorgaben):\n${guidelines}\n\nHalte dich strikt an das Regelwerk.`;
  const userPrompt = [
    "Quelle (PDF-Extrakt):",
    text,
    "",
    "Optionale Strukturvorgaben (Ueberschriften):",
    structure?.trim() ? structure.trim() : "Keine",
    "",
    "Gib ausschliesslich die fertige Zusammenfassung in Markdown aus."
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
    "",
    "Du ueberarbeitest die bestehende Zusammenfassung anhand der Nutzeranweisung.",
    "Gib ausschliesslich die vollstaendig aktualisierte Zusammenfassung in Markdown aus.",
    "",
    "Aktuelle Zusammenfassung:",
    summary
  ].join("\n");
};

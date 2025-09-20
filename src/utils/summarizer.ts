// summarizer.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.SUMMARY_MODEL || "gpt-4o-mini";

interface UpdateSummaryParams {
  oldSummary: string;
  recent: Array<{ action: string; scene: string }>;
  state?: any;
  language?: "en" | "nl";
}

export async function updateSummary({
  oldSummary,
  recent,
  state,
  language = "en",
}: UpdateSummaryParams): Promise<string> {
  // Language-specific prompts
  const prompts = {
    en: {
      intro:
        "You compress an ongoing interactive story into a tight memory for continuity.",
      rules: `Rules:
- Retain only durable facts: setting, important NPCs, goals, discovered clues, promises, unresolved threads, inventory/conditions.
- Do not retell prose. Prefer bullet-like, compact sentences.
- Merge with previous summary, extend the existing bullet lists and do not remove earlier items.`,
      sections: {
        previous: "PREVIOUS SUMMARY (may be empty)",
        exchanges: "NEW EXCHANGES TO FOLD IN",
        state: "CURRENT STATE (hints; optional)",
        return: "Return only the updated summary.",
      },
    },
    nl: {
      intro:
        "Je comprimeert een lopend interactief verhaal tot een compact geheugen voor continuïteit.",
      rules: `Regels:
- Behoud alleen duurzame feiten: setting, belangrijke NPCs, doelen, ontdekte aanwijzingen, beloftes, onopgeloste threads, inventaris/condities.
- Vertel het verhaal niet opnieuw. Gebruik korte, compacte zinnen in bullets.
- Voeg samen met vorige samenvatting, breid bestaande bullet lijsten uit en verwijder geen eerdere items.`,
      sections: {
        previous: "VORIGE SAMENVATTING (kan leeg zijn)",
        exchanges: "NIEUWE UITWISSELINGEN OM IN TE VOUWEN",
        state: "HUIDIGE STATUS (hints; optioneel)",
        return: "Geef alleen de bijgewerkte samenvatting terug.",
      },
    },
  };

  const p = prompts[language];

  // Keep summary short & structured. Bound by ~200–300 tokens.
  const prompt = `
${p.intro}

${p.rules}

=== ${p.sections.previous.toUpperCase()} ===
${oldSummary || "(none)"}

=== ${p.sections.exchanges.toUpperCase()} ===
${recent
  .map((t, i) => `Turn ${i + 1} - Player: ${t.action}\nScene: ${t.scene}`)
  .join("\n\n")}

=== ${p.sections.state.toUpperCase()} ===
${JSON.stringify(state || {}, null, 2)}

${p.sections.return}
  `.trim();

  const resp = await client.responses.create({
    model: MODEL,
    input: prompt,
  });
  return resp.output_text?.trim() || oldSummary || "";
}

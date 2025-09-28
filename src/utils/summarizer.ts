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
}: UpdateSummaryParams): Promise<string> {
  // Language-specific prompts
  const p = {
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
  };

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

import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getOrCreateSession } from "../../utils/sessions";
import { updateSummary } from "../../utils/summarizer";

// Configuration
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.MODEL || "gpt-4o-mini";

// Types
interface Character {
  name: string;
  class: string;
  traits: string[];
  backstory: string;
  language: "en" | "nl";
}

interface BuildPromptParams {
  character: Character;
  action: string;
  summary: string;
  lastScene: string;
  recent: any[];
}

// Utility functions
const sseWrite = (res: NextApiResponse, data: any) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const isChoiceAction = (action: string): boolean => {
  return typeof action === "string" && /^[ab]$/i.test(action);
};

// Language-specific prompt templates
const PROMPT_TEMPLATES = {
  en: {
    intro: "You are an immersive fantasy storyteller.",
    rules: `Global rules:
- 2nd person ("you...").
- Tight narration (max 40 words).
- Maintain continuity using the summary. Do not contradict facts.
- End with exactly:
  1) <option 1>
  2) <option 2>`,
    sections: {
      summary: "CANON SUMMARY (compact memory of prior story)",
      recent: "RECENT EXCHANGES (most recent first)",
      character: "CHARACTER",
      lastScene: "LAST SCENE (with options 1 or 2)",
      playerChoice: "PLAYER CHOICE",
      customAction: "PLAYER CUSTOM ACTION",
      outputFormat: "OUTPUT FORMAT (render exactly like this)",
    },
    playerChoiceText: (choice: string) =>
      `The player chose option "${choice}". Continue accordingly.`,
    customActionText:
      "Continue the story treating this as the player's intent.",
    outputExample: `<Narration text...>
1) <New option 1>
2) <New option 2>`,
  },
  nl: {
    intro: "Je bent een meeslepende fantasy verhalenverteller.",
    rules: `Algemene regels:
- 2de persoon ("je...").
- Compacte verhaalvertelling (max 40 woorden).
- Behoud continuïteit met de samenvatting. Spreek feiten niet tegen.
- Eindig precies met:
  1) <optie 1>
  2) <optie 2>`,
    sections: {
      summary: "VERHAAL SAMENVATTING (compact geheugen van eerder verhaal)",
      recent: "RECENTE UITWISSELINGEN (meest recent eerst)",
      character: "KARAKTER",
      lastScene: "LAATSTE SCÈNE (met opties 1 of 2)",
      playerChoice: "SPELER KEUZE",
      customAction: "SPELER AANGEPASTE ACTIE",
      outputFormat: "OUTPUT FORMAAT (render precies zo)",
    },
    playerChoiceText: (choice: string) =>
      `De speler koos optie "${choice}". Ga hier mee verder.`,
    customActionText:
      "Zet het verhaal voort en behandel dit als de bedoeling van de speler.",
    outputExample: `<Verhaal tekst...>
1) <Nieuwe optie 1>
2) <Nieuwe optie 2>`,
  },
} as const;

function buildPrompt({
  character,
  action,
  summary,
  lastScene,
  recent,
}: BuildPromptParams) {
  const isChoice = isChoiceAction(action);
  const normalizedAction = isChoice ? action.toUpperCase() : action;
  const language = character.language || "en";
  const template = PROMPT_TEMPLATES[language];

  const recentExchanges =
    [...recent]
      .reverse()
      .map((r, i) => `#${i + 1} Player: ${r.action}\nScene: ${r.scene}`)
      .join("\n\n") || "(none)";

  const actionSection = isChoice
    ? `=== ${template.sections.lastScene.toUpperCase()} ===
${lastScene}

=== ${template.sections.playerChoice.toUpperCase()} ===
${template.playerChoiceText(normalizedAction)}`
    : `=== ${template.sections.customAction.toUpperCase()} ===
${normalizedAction}
${template.customActionText}`;

  return `
${template.intro}

${template.rules}

=== ${template.sections.summary.toUpperCase()} ===
${summary || "(none)"}

=== ${template.sections.recent.toUpperCase()} ===
${recentExchanges}

=== ${template.sections.character.toUpperCase()} ===
${JSON.stringify(character, null, 2)}

${actionSection}

=== ${template.sections.outputFormat.toUpperCase()} ===
${template.outputExample}
`.trim();
}

// Main API handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, character, action } = req.body || {};

  if (!sessionId || !character || !action) {
    return res
      .status(400)
      .json({ error: "Missing sessionId, character or action" });
  }

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    sseWrite(res, { type: "status", message: "Generating story..." });

    const session = getOrCreateSession(sessionId);
    const prompt = buildPrompt({
      character,
      action,
      summary: session.summary,
      lastScene: session.lastScene,
      recent: session.recent,
    });

    let fullScene = "";

    // Stream response from OpenAI
    const stream = await client.responses.create({
      model: MODEL,
      input: prompt,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const textDelta = event.delta || "";
        fullScene += textDelta;
        sseWrite(res, { type: "delta", text: textDelta });
      }
    }

    // Update session with new content
    await updateSession(
      session,
      { action, scene: fullScene },
      character.language as "en" | "nl"
    );

    sseWrite(res, { type: "done" });
    res.end();
  } catch (error) {
    console.error("Text Stream Error:", error);
    sseWrite(res, { type: "error", message: "Error generating story" });
    res.end();
  }
}

// Helper function to update session state
async function updateSession(
  session: any,
  exchange: any,
  language: "en" | "nl"
) {
  session.lastScene = exchange.scene;
  session.recent.push(exchange);

  if (session.recent.length > 3) {
    session.recent.shift();
  }

  // Update summary periodically
  if (session.recent.length >= 3) {
    session.summary = await updateSummary({
      oldSummary: session.summary,
      recent: session.recent,
      state: session.state,
      language,
    });
    session.recent = [];
  }

  console.log("Session summary:", session.summary);
  console.log("Session state:", session.state);
}

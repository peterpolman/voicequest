import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getOrCreateSession } from "../../utils/sessions";
import { updateSummary } from "../../utils/summarizer";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.MODEL || "gpt-4o-mini";

function sseWrite(res: NextApiResponse, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function buildPrompt({
  character,
  action,
  summary,
  lastScene,
  recent,
}: {
  character: any;
  action: string;
  summary: string;
  lastScene: string;
  recent: any[];
}) {
  const isAB = typeof action === "string" && /^[ab]$/i.test(action);
  const normalized = isAB ? action.toUpperCase() : action;
  const language = character.language || "en";

  // Language-specific prompts
  const prompts = {
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
      playerChoiceText: `The player chose option "${normalized}". Continue accordingly.`,
      customActionText: `Continue the story treating this as the player's intent.`,
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
      playerChoiceText: `De speler koos optie "${normalized}". Ga hier mee verder.`,
      customActionText: `Zet het verhaal voort en behandel dit als de bedoeling van de speler.`,
      outputExample: `<Verhaal tekst...>
1) <Nieuwe optie 1>
2) <Nieuwe optie 2>`,
    },
  };

  const p = prompts[language as keyof typeof prompts];

  return `
${p.intro}

${p.rules}

=== ${p.sections.summary.toUpperCase()} ===
${summary || "(none)"}

=== ${p.sections.recent.toUpperCase()} ===
${
  [...recent]
    .reverse()
    .map((r, i) => `#${i + 1} Player: ${r.action}\nScene: ${r.scene}`)
    .join("\n\n") || "(none)"
}

=== ${p.sections.character.toUpperCase()} ===
${JSON.stringify(character, null, 2)}

${
  isAB
    ? `=== ${p.sections.lastScene.toUpperCase()} ===
${lastScene}

=== ${p.sections.playerChoice.toUpperCase()} ===
${p.playerChoiceText}`
    : `=== ${p.sections.customAction.toUpperCase()} ===
${normalized}
${p.customActionText}`
}

=== ${p.sections.outputFormat.toUpperCase()} ===
${p.outputExample}
`.trim();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessionId, character, action } = req.body || {};

    if (!sessionId || !character || !action) {
      return res
        .status(400)
        .json({ error: "Missing sessionId, character or action" });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

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

    const stream = await client.responses.create({
      model: MODEL,
      input: prompt,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const textDelta = event.delta || "";
        fullScene += textDelta;

        // Send only text delta (no audio processing)
        sseWrite(res, { type: "delta", text: textDelta });
      }
    }

    // Update session with the new scene
    session.lastScene = fullScene;
    session.recent.push({ action, scene: fullScene });
    if (session.recent.length > 3) session.recent.shift();

    // Update summary periodically
    if (session.recent.length >= 3) {
      session.summary = await updateSummary({
        oldSummary: session.summary,
        recent: session.recent,
        state: session.state,
        language: character.language || "en",
      });
      session.recent = [];
    }

    console.log(session.summary);
    console.log(session.state);

    sseWrite(res, { type: "done" });
    res.end();
  } catch (e) {
    console.error("Text Stream Error:", e);
    sseWrite(res, { type: "error", message: "Error generating story" });
    res.end();
  }
}

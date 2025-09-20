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

  return `
You are an immersive fantasy storyteller.

Global rules:
- 2nd person ("you...").
- Tight narration (max 60 words).
- Maintain continuity using the summary. Do not contradict facts.
- End with exactly:
  A) <option A>
  B) <option B>
  (Or describe your own custom action.)

=== CANON SUMMARY (compact memory of prior story) ===
${summary || "(none)"}

=== RECENT EXCHANGES (most recent first) ===
${
  [...recent]
    .reverse()
    .map((r, i) => `#${i + 1} Player: ${r.action}\nScene: ${r.scene}`)
    .join("\n\n") || "(none)"
}

=== CHARACTER ===
${JSON.stringify(character, null, 2)}

${
  isAB
    ? `=== LAST SCENE (with options A/B) ===
${lastScene}

=== PLAYER CHOICE ===
The player chose option "${normalized}". Continue accordingly.`
    : `=== PLAYER CUSTOM ACTION ===
${normalized}
Continue the story treating this as the player's intent.`
}

=== OUTPUT FORMAT (render exactly like this) ===
<Narration text...>
A) <New option A>
B) <New option B>
(Or describe your own custom action.)
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
      });
      session.recent = [];
    }

    sseWrite(res, { type: "done" });
    res.end();
  } catch (e) {
    console.error("Text Stream Error:", e);
    sseWrite(res, { type: "error", message: "Error generating story" });
    res.end();
  }
}

import { buildPrompt } from "@/utils/prompt";
import fastJsonPatch from "fast-json-patch";
import type { NextApiRequest, NextApiResponse } from "next";
import { default as OpenAI } from "openai";
import { getOrCreateSession } from "../../utils/sessions";
import { updateSummary } from "../../utils/summarizer";

// Configuration
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utility functions
const sseWrite = (res: NextApiResponse, data: any) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

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

    let fullScene = "";

    // Stream response from OpenAI
    const { systemPrompt, userPrompt } = buildPrompt({
      state: session.state,
      action,
      summary: session.summary,
      lastScene: session.lastScene,
      recent: session.recent,
    });
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt, // your long “You are a narrative co-pilot…” text
        },
        {
          role: "user",
          content: userPrompt, // your [GAME_STATE] … [INSTRUCTIONS] block
        },
      ],
      temperature: 0.9,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullScene += delta;
        sseWrite(res, { type: "delta", text: delta });
      }
    }

    // Extract and parse JSON patch bundle from the response
    const jsonMatch = fullScene.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const patchBundle = JSON.parse(jsonMatch[1]);
        console.log(patchBundle);

        // Apply patch to session state
        fastJsonPatch.applyPatch(session.state, patchBundle.patch, true, false);

        console.log(JSON.stringify(session.state));

        // Send updated game state to client
        sseWrite(res, {
          type: "gameState",
          state: session.state,
          inventory: session.state.player.inventory || [],
        });
      } catch (error) {
        console.error("Failed to parse JSON patch bundle:", error);
        sseWrite(res, {
          type: "status",
          message: "Failed to parse game state updates",
        });
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

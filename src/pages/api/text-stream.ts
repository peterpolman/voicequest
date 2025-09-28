import { buildPrompt } from "@/utils/prompt";
import FastJsonPatch from "fast-json-patch";
import type { NextApiRequest, NextApiResponse } from "next";
import { default as OpenAI } from "openai";
import { getOrCreateSession, updateSessionState } from "../../utils/sessions";
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

    // Apply character-provided name and skills to the session before prompting
    try {
      if (character?.name && typeof character.name === "string") {
        session.state.player.name = String(character.name).slice(0, 40);
      }
      if (character?.skills && typeof character.skills === "object") {
        const keys = [
          "sword",
          "alchemy",
          "stealth",
          "athletics",
          "lockpicking",
        ] as const;
        for (const k of keys) {
          const raw = Number(character.skills[k]);
          if (!Number.isNaN(raw)) {
            const clamped = Math.max(0, Math.min(100, Math.round(raw)));
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            session.state.player.skills[k] = clamped;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to apply character fields to session:", e);
    }

    let scene = "";

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

    let isEnded = false;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        scene += delta;
        if (!isEnded) {
          isEnded = !!delta.match(/```/);
          if (!isEnded) sseWrite(res, { type: "delta", text: delta });
        }
      }
    }

    // Extract and parse JSON patch bundle from the response
    const jsonMatch = scene.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const { patch, mechanics, next_actions: nextActions } = data;

        // Apply patch to session state
        if (patch.length) {
          const patchedState = FastJsonPatch.applyPatch(
            session.state,
            patch,
            true,
            false
          );
          updateSessionState(sessionId, patchedState.newDocument);
        }

        // Send updated game state to client
        sseWrite(res, {
          type: "state",
          state: session.state,
          mechanics,
          nextActions,
        });
      } catch (error) {
        console.error("Failed to parse JSON patch bundle:", error);
        sseWrite(res, {
          type: "status",
          message: "Failed to parse game state updates",
        });
      }
    }
    console.log(scene);
    console.log(session.state);

    // Update session with new content
    await updateSession(session, { action, scene });
    res.end();
  } catch (error) {
    console.error("Text Stream Error:", error);
    sseWrite(res, { type: "error", message: "Error generating story" });
    res.end();
  }
}

// Helper function to update session state
async function updateSession(session: any, exchange: any) {
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
    });
    session.recent = [];
  }
}

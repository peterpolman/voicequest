import { buildPrompt } from "@/utils/prompt";
import FastJsonPatch from "fast-json-patch";
import type { NextApiRequest, NextApiResponse } from "next";
import { default as OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";
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
    console.log(session);

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

    const RFC6902OperationFormat = z.object({
      op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
      path: z.string(),
      value: z
        .union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
          z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()])
          ),
          z.null(),
        ])
        .optional(),
    });

    const GameStatePatchBundleFormat = z.object({
      type: z.literal("patch_bundle"),
      schema_version: z.string(),
      operation_id: z.string(),
      base_version: z.number(),
      patch: z.array(RFC6902OperationFormat),
      next_actions: z.array(z.string()),
      scene: z.string(),
      mechanics: z.object({
        skill_used: z.string(),
        skill_value: z.number(),
        difficulty: z.number(),
        rand: z.number(),
        p: z.number(),
        outcome: z.enum(["success", "fail", "blocked"]),
        notes: z.string(),
      }),
    });

    // Stream response from OpenAI
    const { systemPrompt, userPrompt } = buildPrompt({
      state: session.state,
      action,
      summary: session.summary,
      lastScene: session.lastScene,
      recent: session.recent,
    });
    console.log("System Prompt:", systemPrompt);
    console.log("User Prompt:", userPrompt);

    const stream = openai.responses.stream({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt, // your long “You are a narrative co-pilot…” text
        },
        {
          role: "user",
          content: userPrompt, // your [GAME_STATE] … [INSTRUCTIONS] block
        },
      ],
      text: {
        format: zodTextFormat(GameStatePatchBundleFormat, "patch_bundle"),
      },
      // temperature: 0.9,
      // stream: true,
    });

    let fullText = "";
    let parsedBundle: any = null;

    // Stream text deltas and extract narrative as it builds
    stream.on("response.output_text.delta", async (event) => {
      const delta = (event as any).delta as string;
      if (delta) {
        fullText += delta;

        // Try to extract and stream the scene field as it's being built
        try {
          // Look for partial JSON to extract scene field early
          const sceneMatch = fullText.match(
            /"scene"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/
          );
          if (sceneMatch && sceneMatch[1]) {
            const sceneText = sceneMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\n/g, "\n");
            // Only send new parts of the scene
            if (sceneText.length > scene.length) {
              const newText = sceneText.slice(scene.length);
              scene = sceneText;
              await updateSession(session, { action, scene });
              sseWrite(res, { type: "delta", text: newText });
            }
          }
        } catch {
          // Ignore parsing errors during streaming
        }
      }
    });

    stream.on("response.output_text.done", () => {
      // Parse the complete structured response
      try {
        parsedBundle = JSON.parse(fullText);
        console.log("Parsed bundle:", parsedBundle);
      } catch (error) {
        console.error("Failed to parse final response:", error, fullText);
      }
    });

    const result = await stream.finalResponse();
    console.log("Final response:", result);

    // Use the parsed bundle data
    if (parsedBundle) {
      try {
        const {
          patch,
          mechanics,
          next_actions: nextActions,
          scene: narrativeScene,
        } = parsedBundle;

        // Apply patch to session state
        if (patch && patch.length) {
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

        // Update session with new content (use scene from parsed bundle)
        await updateSession(session, {
          action,
          scene: narrativeScene || scene,
        });
      } catch (error) {
        console.error("Failed to process patch bundle:", error);
        sseWrite(res, {
          type: "status",
          message: "Failed to apply game state updates",
        });
      }
    } else {
      console.log("No parsed bundle available");
      // Fallback: update session with streamed scene
      await updateSession(session, { action, scene });
    }

    console.log("Final scene:", scene);
    console.log("Session state:", session.state);
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

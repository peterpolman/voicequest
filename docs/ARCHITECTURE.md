# Architecture

This project is a Next.js Pages Router app that streams LLM-generated story text to the browser (SSE) and speaks it via the Web Speech API. The server maintains a simple in-memory session with structured game state, which is updated using RFC6902 JSON Patches returned by the model.

## High-Level Flow
1. UI collects player input (speech or text).
2. Client calls `POST /api/text-stream` with `{ sessionId, character, action }`.
3. API builds prompts from the current session state and requests a streamed completion from OpenAI (`gpt-4o-mini`).
4. As tokens arrive, the API forwards chunks over Server-Sent Events (`type: "delta"`).
5. After the model finishes, the server extracts a fenced ```json block containing a `PatchBundle` and applies it to the in-memory `GameState`.
6. Server emits `type: "gameState"` with updated state/inventory, then `type: "done"`.
7. Client displays the narrative and optionally speaks it in near-real-time.

## Key Modules
- UI Page: `src/pages/index.tsx`
  - Wires the components and hooks (record button, settings, character setup, inventory popup)
- Hooks:
  - `src/hooks/useSpeechRecognition.ts`: mic + Web Speech Recognition (browser support dependent)
  - `src/hooks/useSpeechSynthesis.ts`: real-time speech queueing and iOS stability tweaks
  - `src/hooks/useStoryStream.ts`: fetches `/api/text-stream`, parses SSE events, cleans text for display/speech
- API Route: `src/pages/api/text-stream.ts`
  - Builds prompts via `src/utils/prompt.ts`
  - Calls OpenAI with stream=true and relays `delta` chunks
  - Extracts ```json PatchBundle, applies with `fast-json-patch` to `sessions.state`
  - Periodically summarizes via `src/utils/summarizer.ts`
- Sessions: `src/utils/sessions.ts`
  - In-memory `Map<string, Session>` storing `summary`, `lastScene`, `recent[]`, and `state: GameState`
- Types: `src/types.ts`
  - `GameState`, `GameStatePatchBundle`, and RFC6902 ops

## Data Contracts
- Request body (client → server):
  - `sessionId: string` – client-provided (e.g., timestamp-based)
  - `character`: `{ name, class, traits, backstory, language: "en"|"nl" }`
  - `action: string` – the player input
- SSE events (server → client):
  - `{ type: "status", message: string }`
  - `{ type: "delta", text: string }`
  - `{ type: "gameState", state: GameState, inventory?: Array<{id, qty}> }`
  - `{ type: "done" } | { type: "error", message }`
- PatchBundle (model → server): see docs/PROMPTS.md for the full contract and example.

## Prompting and Patching
- `src/utils/prompt.ts` supplies a strict instruction: narrative in ≤ 40 words followed by exactly one fenced ```json PatchBundle.
- The first patch op MUST test `/version`, and the final op must increment `version` to maintain consistency.
- Patches should be minimal and consistent with computed `mechanics`.

## Summarization
- `src/utils/summarizer.ts` updates `session.summary` every few exchanges to keep the prompt compact while maintaining continuity (supports English and Dutch).

## Notes and Caveats
- Sessions are in-memory only; restarting the server clears state.
- Browser speech APIs vary by platform; iOS Safari needs user gestures and benefits from HTTPS.
- Types: `Player.location` in `src/types.ts` is currently `string`, while the default session uses an object `{ area, x, y }`. Align types before expanding features around location.

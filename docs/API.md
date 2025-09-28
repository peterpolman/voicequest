# API: /api/text-stream

Streaming endpoint that accepts a player action and returns a narrative and game-state updates via Server-Sent Events (SSE).

## Request
- Method: POST
- Path: `/api/text-stream`
- Body (JSON):
  ```json
  {
    "sessionId": "1699999999999",
    "character": {
      "name": "Alice",
      "class": "Rogue",
      "traits": ["curious", "careful"],
      "backstory": "From the old city",
      "language": "en"
    },
    "action": "Look around the village square"
  }
  ```

## Events (SSE)
- `data: { "type": "status", "message": string }` – high-level status updates
- `data: { "type": "delta", "text": string }` – incremental story tokens
- `data: { "type": "gameState", "state": GameState, "inventory": Array<{id, qty}> }` – updated state and normalized inventory
- `data: { "type": "done" }` – completion marker
- `data: { "type": "error", "message": string }` – failure case

Client consumption pattern is implemented in `src/hooks/useStoryStream.ts`.

## Model Interaction
- Model: `gpt-4o-mini` (see `src/pages/api/text-stream.ts`)
- The prompt instructs the model to return:
  1) ≤ 40 words of narrative prose (2nd person)
  2) Exactly one fenced ```json code block with a PatchBundle (see docs/PROMPTS.md)

## Patch Application
- Server extracts the fenced json block using a regex, parses to `GameStatePatchBundle`, then applies `patch` to the in-memory `GameState` via `fast-json-patch`.
- The first op must be `{"op":"test","path":"/version","value": <base_version>}` and the patch must end with `replace /version` to increment by 1.

## Errors
- Missing fields: returns 400 with `{ error: "Missing sessionId, character or action" }`
- Method not allowed: 405
- Upstream failures: emits SSE `{ type: "error", message }` and ends the stream

# Prompt and PatchBundle Contract

The model must produce narrative plus a JSON Patch bundle that updates the server game state. The server enforces this by extracting the final fenced ```json block and applying it to the in-memory `GameState`.

Important: any `next_actions` suggestions are advisory and must only appear inside the JSON block. Do not include suggestions in the prose; the client renders them via a separate SSE event.

## System Rules (summary)
- Compute success probability from skills, difficulty, rand (see code for exact formula)
- Decide outcome: `success | fail | blocked`
- Narrate in 2nd person, ≤ 40 words
- Output EXACTLY ONE final fenced json code block containing a `PatchBundle`

## PatchBundle Shape
```jsonc
{
  "schema_version": "1.2",
  "operation_id": "<unique id>",
  "base_version": 12,
  "patch": [ { /* RFC6902 ops */ } ],
  "events": [ /* optional textual or structured events */ ],
  "next_actions": [ "Search the chapel", "Talk to the guard" ],
  "mechanics": {
    "skill_used": "stealth",
    "skill_value": 14,
    "difficulty": 0.6,
    "rand": 0.42,
    "p": 0.19,
    "outcome": "fail",
    "notes": "Low skill vs moderate difficulty"
  }
}
```

Constraints:
- First op must test the current version:
  ```json
  {"op": "test", "path": "/version", "value": 12}
  ```
- Use `replace` for existing fields; inventory has special rules below
- Final op must increment the version:
  ```json
  {"op": "replace", "path": "/version", "value": 13}
  ```

## Inventory Patching Rules
- New item: add to end with `{"op":"add","path":"/player/inventory/-","value":{"id":"<id>","qty":<n>}}`
- Existing item qty change: replace `qty` at `/player/inventory/<index>/qty`. The server provides `[INVENTORY_INDEX_BY_ID]` in the prompt. Optionally `test` the item id before replace.
- If qty <= 0: remove the item with `{"op":"remove","path":"/player/inventory/<index>"}`.
- Do not reorder inventory; keep indices stable.

## Example Patch (inventory gain)
```jsonc
{
  "schema_version": "1.2",
  "operation_id": "find-coin-7f3",
  "base_version": 12,
  "patch": [
    {"op":"test","path":"/version","value":12},
    {"op":"replace","path":"/player/xp","value":1},
    {"op":"add","path":"/player/inventory/-","value":{"id":"copper_coin","qty":1}},
    {"op":"replace","path":"/version","value":13}
  ],
  "events": ["Found a coin"],
  "next_actions": ["Ask the merchant"],
  "mechanics": {
    "skill_used": "perception",
    "skill_value": 30,
    "difficulty": 0.2,
    "rand": 0.1,
    "p": 0.9,
    "outcome": "success",
    "notes": "Easy spot"
  }
}
```

### Example: increase qty of existing item
```json
[
  {"op":"test","path":"/version","value":12},
  {"op":"test","path":"/player/inventory/0/id","value":"rusty_dagger"},
  {"op":"replace","path":"/player/inventory/0/qty","value":2},
  {"op":"replace","path":"/version","value":13}
]
```

### Example: remove item when qty hits 0
```json
[
  {"op":"test","path":"/version","value":13},
  {"op":"test","path":"/player/inventory/1/id","value":"copper_coin"},
  {"op":"remove","path":"/player/inventory/1"},
  {"op":"replace","path":"/version","value":14}
]
```

## Cleaning Display Text
The client strips any trailing `GAME_STATE`, `STATE_OPS`, or `PATCH_BUNDLE` content from streamed text before showing/speaking. Keep prose separate from JSON.

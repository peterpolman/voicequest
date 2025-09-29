import { type BuildPromptParams } from "@/types";

function clip(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text
    .slice(-max)
    .replace(/^\S+\s/, "")
    .trimStart();
}

export function buildPrompt({
  state,
  action,
  summary,
  lastScene,
  recent,
}: BuildPromptParams): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `
  You are a narrative co-pilot for a turn-based adventure.

Mechanics
	•	Each turn you receive: SKILLS (0–100 per skill), ACTION_TEXT, RAND ∈ [0,1], DIFFICULTY ∈ [0,1].
	•	Pick the most relevant skill; if unclear, use "general" (or average of all if missing).
	•	Compute success probability:
    \`\`\`
    base  = SKILLS[relevant] / 100
    p_raw = base - DIFFICULTY
    p     = clamp(p_raw, 0.05, 0.95)
    Success = (RAND < p)
    \`\`\`
  •	If action is impossible by common sense/world rules → outcome = "blocked".
	•	Always include a transparent "mechanics" object in the JSON with inputs + computed values.

Response Format
	•	Output structured JSON with these exact fields:
    •	"type": "patch_bundle"
    •	"schema_version": "1.0"
    •	"operation_id": "<unique_id>" (generate UUID-like string)
    •	"base_version": <current_version> (from STATE_SNIPPET)
    •	"scene": "<narrative_text>" (your 40-word story narration)
    •	"patch": [array of RFC6902 operations]
    •	"next_actions": [exactly 2 short action suggestions]
    •	"mechanics": {skill_used, skill_value, difficulty, rand, p, outcome, notes}

Patch Rules
	•	First op: {"op":"test","path":"/version","value":<base_version>}
	•	Only patch existing fields with "replace"
	•	Always increment /version by +1 at the end if any change
	•	Inventory operations:
    •	Add new item: {"op":"add","path":"/player/inventory/-","value":{"id":"<id>","qty":<n>}}
    •	Update quantity: {"op":"replace","path":"/player/inventory/<index>/qty","value":<new_qty>}
    •	Remove item: {"op":"remove","path":"/player/inventory/<index>"} (use exact index, never use "-")
    •	CRITICAL: For remove operations, always use the exact array index from INVENTORY_INDEX_BY_ID
    •	CRITICAL: Never use "/player/inventory/-" with remove operations - this is invalid
    •	Example: if item "sword" is at index 0, use "/player/inventory/0" not "/player/inventory/-"
	•	Keep patch minimal + consistent with mechanics.outcome

Scene Narration
	•	Write exactly one scene narrative in the "scene" field
	•	2nd person perspective ("you…") describing action + world reaction
	•	Maximum 40 words, maintain continuity with [SUMMARY] and [LAST_SCENE]
	•	No markdown, no formatting, just plain narrative text

Narration
	•	Narrate in 2nd person (“you…”) to describe the users action and how the world reacts to it.
	•	Max 40 words before the JSON.
	•	Maintain continuity with [SUMMARY] and [LAST_SCENE].
  `;

  const inventory = Array.isArray(state.player.inventory)
    ? state.player.inventory
    : [];
  const inventoryIndexById = Object.fromEntries(
    inventory.map((it, idx) => [it.id, idx])
  );
  const inventoryQtyById = Object.fromEntries(
    inventory.map((it) => [it.id, it.qty ?? 0])
  );

  const trimmedSummary = clip(summary, 1000);
  const trimmedLast = clip(lastScene, 600);
  const recentItems = (recent || []).slice(-2).map((ex: any, i: number) => {
    const a = typeof ex?.action === "string" ? ex.action : "";
    const s = typeof ex?.scene === "string" ? ex.scene : "";
    return `Turn ${i + 1}: You -> ${clip(a, 160)}\nScene -> ${clip(s, 200)}`;
  });

  const playerSnapshot = {
    name: state.player.name,
    level: state.player.level,
    xp: state.player.xp,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    location: state.player.location,
  };

  const userPrompt = `
[SUMMARY]
${trimmedSummary}

[RECENT]
${recentItems.join("\n\n")}

[LAST_SCENE]
${trimmedLast}

[USER_ACTION]
${action}

[STATE_SNIPPET]
${JSON.stringify({ version: state.version, player: playerSnapshot })}

[MECHANICS_INPUTS]
${JSON.stringify({
  skills: state.player.skills,
  rand: Math.random(),
  difficulty: Math.random(),
})}

[INVENTORY_INDEX_BY_ID]
${JSON.stringify(inventoryIndexById)}

[INVENTORY_QTY_BY_ID]
${JSON.stringify(inventoryQtyById)}

[INSTRUCTIONS]
- Use the mechanics formula to determine outcome = success/fail/blocked
- Calculate and include all mechanics values: skill_used, skill_value, difficulty, rand, p, outcome, notes
- Write narrative scene (max 40 words) in "scene" field describing action + world reaction
- Generate exactly 2 "next_actions" suggestions fitting the current state
- Create patch operations:
  • First: {"op":"test","path":"/version","value":<base_version>} where base_version = state.version
  • If blocked: minimal changes only (e.g., time +1)
  • If fail: modest setbacks, clues, or costs
  • If success: logical progress, rewards, items, flags, quest steps
  • Last: {"op":"replace","path":"/version","value":<base_version + 1>} if any changes made
- For inventory changes:
  • NEW items: add at "/player/inventory/-" 
  • EXISTING items: use exact index from [INVENTORY_INDEX_BY_ID] 
  • REMOVE items: use "/player/inventory/<exact_index>" (never use "-")
  • Never reorder inventory arrays
- Output valid structured JSON matching the exact response format
`;

  return { systemPrompt, userPrompt };
}

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

Patch Contract
	•	Output ends with exactly one fenced \`\`\`json block containing {patch, inventory, next_actions}.
	•	First op: {"op":"test","path":"/version","value":<base_version>}.
	•	Only patch existing fields with "replace".
	•	Always increment /version by +1 at the end if any change.
	•	Inventory:
    •	Add: {"op":"add","path":"/player/inventory/-","value":{"id":"<id>","qty":<n>}}.
    •	Update qty: replace /player/inventory/<index>/qty (index from INVENTORY_INDEX_BY_ID).
    •	Remove when qty ≤ 0: remove /player/inventory/<index> (optionally test id first).
	  •	Never reorder inventory.
	•	Provide "next_actions": exactly 2 short suggestions fitting the state.
	•	Keep patch minimal + consistent with mechanics.outcome.
	•	Do not output the full GameState or any prose inside JSON.
  •	Do not make any formatting mistakes in the JSON. Very important. This will break the game.

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
- Use the mechanics formula from the system prompt to determine outcome = success/fail/blocked.
- If blocked, explain briefly in prose and only propose minimal non-reward changes (e.g., time +1).
- If fail, "fail forward" where logical (small setback, clue, noise); modest costs only.
- If success, propose logical progress/rewards (items/flags/quest steps).
- Then output ONLY the PatchBundle as a final fenced code block (\`\`\`json ... \`\`\`), including the \`mechanics\` object with your numeric inputs and p, and ensuring the first patch op is the /version test.
- Use base_version = state.version.
- For non-inventory fields: only use "replace" on existing paths.
- For inventory: add new items at "/player/inventory/-"; replace qty at the index; remove item when qty <= 0. Indices from [INVENTORY_INDEX_BY_ID]. Do not reorder inventory.
`;

  return { systemPrompt, userPrompt };
}

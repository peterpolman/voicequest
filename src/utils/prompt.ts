import { type BuildPromptParams } from "@/types";

export function buildPrompt({
  state,
  action,
  summary,
  lastScene,
  recent,
}: BuildPromptParams): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a narrative co-pilot for a turn-based adventure.

Authoritative mechanics (YOU decide success/fail):
- Each turn you receive: SKILLS (0..100 per skill), ACTION_TEXT, RAND in [0,1], DIFFICULTY in [0,1].
- Determine the most relevant skill for ACTION_TEXT. If unclear, use "general" (or the average of all skills if "general" is missing).
- Compute success probability p using this exact formula (NO other factors):
    base  = SKILLS[relevant] / 100
    p_raw = base - DIFFICULTY
    p     = clamp(p_raw, 0.05, 0.95)
  Success = (RAND < p)
- If the action is blatantly implausible given common sense/world constraints, set outcome to "blocked" (no rewards; time may advance).
- You MUST include a transparent \`mechanics\` object in the JSON with your inputs and computed values.

Patch contract:
- ALWAYS end with exactly one fenced \`\`\`json code block containing a PatchBundle:
  {
    "schema_version": "1.2",
    "operation_id": "<unique id>",
    "base_version": <number>,
    "patch": [ ... RFC6902 ops ... ],
    "events": [ ... ],
    "next_actions": [ ... up to 2 suggestions ... ],
    "mechanics": {
      "skill_used": "<string>",
      "skill_value": <0..100>,
      "difficulty": <0..1>,
      "rand": <0..1>,
      "p": <0..1>,
      "outcome": "success" | "fail" | "blocked",
      "notes": "<short reasoning>"
    }
  }
- First patch op MUST be: {"op":"test","path":"/version","value": <base_version> }.
- When patching player state, make sure to only patch existing fields (use "replace", not "add").
- Keep the patch MINIMAL and consistent with \`mechanics.outcome\`. If you change anything, also replace /version with +1 at the end.
- Do NOT repeat the full GameState; never put prose inside JSON.
- Narrate in 2nd person ("you...").
- Maintain continuity using the [SUMMARY] and [LAST_SCENE]. Do not contradict facts.
- Write a max 40 word paragraph of story, THEN the JSON block.
- \`next_actions\` are optional, advisory only (max 2 concise suggestions).`;

  const userPrompt = `

[SUMMARY]
${summary}

[RECENT_SCENES]
${recent.join("\n")}

[LAST_SCENE]
${lastScene}

[USER_ACTION_TEXT]
${action}

[GAME_STATE]
${JSON.stringify(state)}

[MECHANICS_INPUTS]
{
  "skills": ${JSON.stringify(state.player.skills)}, 
  "rand": ${Math.random()},
  "difficulty": ${Math.random()}
}

[INSTRUCTIONS]
- Use the mechanics formula from the system prompt to determine outcome = success/fail/blocked.
- If blocked, explain briefly in prose and only propose minimal non-reward changes (e.g., time +1).
- If fail, “fail forward” where logical (small setback, clue, noise); modest costs only.
- If success, propose logical progress/rewards (items/flags/quest steps).
- Then output ONLY the PatchBundle as a final fenced code block (\`\`\`json ... \`\`\`), including the \`mechanics\` object with your numeric inputs and p, and ensuring the first patch op is the /version test.
- Use base_version = state.version.
- Patch only existing fields in the state object (use "replace", not "add").
- Only use add/remove ops for inventory items.
`;
  console.log({ systemPrompt, userPrompt });
  return { systemPrompt, userPrompt };
}

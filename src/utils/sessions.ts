import { GameState } from "@/types";

export interface Session {
  summary: string; // compressed memory of everything so far
  lastScene: string; // full text of last streamed scene (with A/B)
  recent: Array<{ action: string; scene: string }>; // last N exchanges
  state: GameState; // structured game state
}

export const sessions = new Map<string, Session>(); // sessionId -> Session

export function getOrCreateSession(sessionId: string): Session {
  let s = sessions.get(sessionId);
  if (!s) {
    s = {
      summary: "", // compressed memory of everything so far
      lastScene: "", // full text of last streamed scene (with A/B)
      recent: [], // last N exchanges: { action, scene }
      state: {
        version: 1,
        player: {
          name: "Furial",
          level: 1,
          xp: 0,
          skills: {
            sword: 1,
            alchemy: 0,
            stealth: 0,
            athletics: 0,
            lockpicking: 0,
          },
          hp: 10,
          maxHp: 10,
          inventory: [{ id: "rusty_dagger", qty: 1 }],
          quests: [],
          flags: [],
          location: { area: "Village", x: 0, y: 0 },
        },
      },
    };
    sessions.set(sessionId, s);
  }
  return s;
}

export function updateSessionState(
  sessionId: string,
  newState: GameState
): void {
  const session = getOrCreateSession(sessionId);
  session.state = newState;
}

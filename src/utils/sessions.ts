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
      summary: "",
      lastScene: "",
      recent: [],
      state: {
        version: 1,
        player: {
          name: "Unknown",
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
          inventory: [],
          location: "",
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

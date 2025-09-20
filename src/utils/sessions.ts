// sessions.ts
export interface Session {
  summary: string; // compressed memory of everything so far
  lastScene: string; // full text of last streamed scene (with A/B)
  recent: Array<{ action: string; scene: string }>; // last N exchanges
  state: {
    // optional structured state you can grow over time
    location: string | null;
    flags: Record<string, any>;
    inventory: string[];
  };
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
        // optional structured state you can grow over time
        location: null,
        flags: {},
        inventory: [],
      },
    };
    sessions.set(sessionId, s);
  }
  return s;
}

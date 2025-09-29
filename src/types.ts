export interface RFC6902Operation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: any;
}

export interface Player {
  name: string;
  level: number;
  xp: number;
  skills: {
    sword: number;
    alchemy: number;
    stealth: number;
    athletics: number;
    lockpicking: number;
  };
  hp: number;
  maxHp: number;
  inventory: { id: string; qty: number }[];
  location: string;
}

export interface GameStatePatchBundle {
  schema_version: string;
  operation_id: string;
  base_version: number;
  patch: RFC6902Operation[];
  next_actions: [];
  mechanics: {
    skill_used: string;
    skill_value: number;
    difficulty: number;
    rand: number;
    p: number;
    outcome: "success" | "fail" | "blocked";
    notes: string;
  };
}

export interface GameState {
  version: number;
  player: Player;
}

export interface BuildPromptParams {
  state: GameState;
  action: string;
  summary: string;
  lastScene: string;
  recent: any[];
}

export interface InventoryItem {
  id: string;
  qty: number;
}

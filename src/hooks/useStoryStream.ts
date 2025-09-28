import { useRef, useState } from "react";
import type { Character } from "@/components";
import type { Player } from "@/types";

export function useStoryStream() {
  const [status, setStatus] = useState("Ready");
  const [textStream, setTextStream] = useState("");
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [player, setPlayer] = useState<Player | null>(null);
  const [location, setLocation] = useState<Player["location"] | null>(null);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const lastFullScene = useRef("");

  const streamText = async (
    payload: any,
    onTextUpdate: (text: string) => void
  ) => {
    const resp = await fetch("/api/text-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok || !resp.body) {
      setStatus("Connection error");
      throw new Error("Text stream connection failed");
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!rawEvent.startsWith("data:")) continue;

        const payload = JSON.parse(rawEvent.slice(5).trim());
        if (payload.type === "status") {
          setStatus(payload.message);
        }
        if (payload.type === "delta") {
          lastFullScene.current += payload.text;
          setTextStream(lastFullScene.current);
          // Call the callback for real-time speech with cleaned content
          onTextUpdate(lastFullScene.current);
        }
        if (payload.type === "state") {
          // Update inventory when game state is received (array -> record mapping)
          const { inventory } = payload.state.player;
          const mapped: Record<string, number> = {};
          for (const item of inventory) {
            const qty = Number(item.qty ?? 0);
            if (qty <= 0) continue;
            mapped[item.id] = (mapped[item.id] ?? 0) + qty;
          }
          setNextActions(payload.nextActions || []);
          setPlayer(payload.state.player);
          setLocation(payload.state.player?.location ?? null);
          setInventory(mapped);
        }
        console.log(payload);
      }
    }

    setStatus("Ready");
    console.log("Story stream completed");
  };

  const sendAction = async (
    sessionId: string,
    character: Character,
    action: string,
    onTextUpdate: (text: string) => void
  ) => {
    setStatus("Generating story...");
    setTextStream("");
    lastFullScene.current = "";
    setNextActions([]); // clear any previous suggestions

    const payload = {
      sessionId,
      character,
      action: action || "Begin the adventure.",
    };

    try {
      await streamText(payload, onTextUpdate);
    } catch (e) {
      setStatus("Error. Try again.");
      throw e;
    }
  };

  const clearNextActions = () => setNextActions([]);

  return {
    status,
    textStream,
    inventory,
    player,
    location,
    nextActions,
    setStatus,
    sendAction,
    lastFullScene,
    clearNextActions,
  };
}

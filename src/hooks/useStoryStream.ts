import { useRef, useState } from "react";
import { Character } from "../components/CharacterSetupPopup";

// Helper function to remove game state content from text for display and speech
function removeGameStateContent(text: string): string {
  // Remove game state lines at the end
  const gameStatePatterns = [
    /\n?GAME_STATE:\s*\{[^}]*\}\s*$/gi,
    /\n?\{[^}]*"inventory"[^}]*\}\s*$/g,
    /\n?STATE_OPS:\s*\[[\s\S]*?\]\s*$/gi,
    /\n?PATCH_BUNDLE:\s*\{[\s\S]*\}\s*$/gi,
  ];

  let cleanText = text;
  for (const pattern of gameStatePatterns) {
    const beforeClean = cleanText;
    cleanText = cleanText.replace(pattern, "");
    if (beforeClean !== cleanText) {
      console.log(
        "Removed game state content:",
        beforeClean.length - cleanText.length,
        "characters"
      );
    }
  }

  return cleanText.trim();
}

export function useStoryStream() {
  const [status, setStatus] = useState("Ready");
  const [textStream, setTextStream] = useState("");
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const lastFullScene = useRef("");

  const streamText = async (
    payload: any,
    onTextUpdate?: (text: string) => void
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

        try {
          const payload = JSON.parse(rawEvent.slice(5).trim());
          if (payload.type === "status") {
            setStatus(payload.message);
          }
          if (payload.type === "delta") {
            lastFullScene.current += payload.text;

            // Clean the accumulated text for display and speech (remove game state)
            const cleanText = removeGameStateContent(lastFullScene.current);
            setTextStream(cleanText);

            // Call the callback for real-time speech with cleaned content
            if (onTextUpdate) {
              onTextUpdate(cleanText);
            }
          }
          if (payload.type === "gameState") {
            // Update inventory when game state is received (array -> record mapping)
            const inv = payload.state?.inventory as
              | Array<{ id: string; qty: number }>
              | undefined;
            if (Array.isArray(inv)) {
              const mapped: Record<string, number> = {};
              for (const it of inv) {
                if (it && typeof it.id === "string")
                  mapped[it.id] = Number(it.qty ?? 0);
              }
              setInventory(mapped);
            }
          }
        } catch (parseError) {
          console.error("Failed to parse SSE event:", parseError);
        }
      }
    }

    setStatus("Ready");
    console.log("Story stream completed");
  };

  const sendAction = async (
    sessionId: string,
    character: Character,
    action: string,
    onTextUpdate?: (text: string) => void
  ) => {
    setStatus("Generating story...");
    setTextStream("");
    lastFullScene.current = "";

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

  return {
    status,
    textStream,
    inventory,
    setStatus,
    sendAction,
    lastFullScene,
  };
}

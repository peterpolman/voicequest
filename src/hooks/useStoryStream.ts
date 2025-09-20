import { useRef, useState } from "react";
import { Character } from "../components/CharacterSetupPopup";

export function useStoryStream() {
  const [status, setStatus] = useState("Ready");
  const [textStream, setTextStream] = useState("");
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
    let speechBuffer = "";

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
            speechBuffer += payload.text;
            setTextStream(lastFullScene.current);

            // Call the callback for real-time speech
            if (onTextUpdate) {
              onTextUpdate(speechBuffer);
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
    setStatus,
    sendAction,
    lastFullScene,
  };
}

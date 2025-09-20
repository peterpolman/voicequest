import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import styles from "../styles/AudioRPG.module.css";

interface Character {
  name: string;
  class: string;
  traits: string[];
  backstory: string;
}

interface FormCharacter {
  name: string;
  class: string;
  traits: string | string[];
  backstory: string;
}

interface StreamPayload {
  sessionId: string;
  character: Character;
  action: string;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function AudioRPG() {
  // Character state
  const [character, setCharacter] = useState<Character>({
    name: "Kera",
    class: "Rogue",
    traits: ["careful", "curious"],
    backstory: "Street urchin from Lowspire, keeps a silver coin for luck.",
  });

  // UI state
  const [showCharacterPopup, setShowCharacterPopup] = useState(true);
  const [showTextPopup, setShowTextPopup] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [textStream, setTextStream] = useState("");
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Refs for managing state
  const sessionId = useRef(crypto.randomUUID());
  const mediaStream = useRef<MediaStream | null>(null);
  const spokenTextLength = useRef(0);
  const lastSpeechText = useRef("");
  const lastFullScene = useRef("");

  // Load character from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("rpgCharacter");
    if (stored) {
      try {
        const parsedCharacter = JSON.parse(stored);
        setCharacter(parsedCharacter);
        setShowCharacterPopup(false);
      } catch (e) {
        console.log("Invalid stored character data, using defaults");
      }
    }
  }, []);

  // Initialize speech recognition
  const initSpeechRecognition = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.warn("Speech Recognition API not supported in this browser");
      return null;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    return recognition;
  };

  // Speech synthesis functions
  const speakFlush = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    spokenTextLength.current = 0;
    lastSpeechText.current = "";
  };

  const speakText = (text: string) => {
    if (!text || text.trim() === "") return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) =>
        voice.name.includes("Google UK English Male") &&
        voice.lang.startsWith("en")
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
  };

  const speakRealtimeText = (accumulatedText: string) => {
    const newText = accumulatedText.slice(spokenTextLength.current);
    if (!newText.trim()) return;

    const sentenceRegex = /[.!?]+\s*/g;
    let match;
    let lastCompleteIndex = 0;

    while ((match = sentenceRegex.exec(newText)) !== null) {
      lastCompleteIndex = match.index + match[0].length;
    }

    if (lastCompleteIndex > 0) {
      const completeSentences = newText.slice(0, lastCompleteIndex).trim();
      if (completeSentences && completeSentences !== lastSpeechText.current) {
        speakText(completeSentences);
        lastSpeechText.current = completeSentences;
        spokenTextLength.current = spokenTextLength.current + lastCompleteIndex;
      }
    }
  };

  // Microphone and recording functions
  const ensureMic = async () => {
    if (mediaStream.current) {
      return mediaStream.current;
    }

    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      return mediaStream.current;
    } catch (e) {
      console.error("Microphone access failed:", e);
      throw e;
    }
  };

  const startSpeechRecognition = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const recognition = initSpeechRecognition();

      if (!recognition) {
        reject(new Error("Speech Recognition not supported"));
        return;
      }

      recognition.onresult = (event: any) => {
        if (event.results.length > 0) {
          const transcript = event.results[0][0].transcript.trim();
          console.log("Speech recognition result:", transcript);
          resolve(transcript);
        } else {
          resolve("");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        reject(new Error(`Speech recognition failed: ${event.error}`));
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
      };

      recognition.start();
    });
  };

  const postProcessTranscription = (text: string) => {
    if (!text) return text;

    text = text.trim();
    text = text.replace(/\b(\w+)\s+\1\b/gi, "$1");

    const replacements: Record<string, string> = {
      "i want to": "I want to",
      "i go to": "I go to",
      "i walk to": "I walk to",
      "i look at": "I look at",
      "i search": "I search",
      "i attack": "I attack",
      "i cast": "I cast",
      "i use": "I use",
      "i pick up": "I pick up",
      "i take": "I take",
      " um ": " ",
      " uh ": " ",
      " er ": " ",
      "and and": "and",
      "the the": "the",
      "to to": "to",
    };

    for (const [wrong, correct] of Object.entries(replacements)) {
      text = text.replace(new RegExp(wrong, "gi"), correct);
    }

    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    if (text.length > 3 && !text.match(/[.!?]$/)) {
      text += ".";
    }

    return text;
  };

  // Story streaming functions
  const streamText = async (payload: any) => {
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
    let fullText = "";
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
            fullText += payload.text;
            speechBuffer += payload.text;

            setTextStream(lastFullScene.current);
            speakRealtimeText(speechBuffer);
          }
          if (payload.type === "error") {
            const errorMsg = `\n[error] ${payload.message}\n`;
            lastFullScene.current += errorMsg;
            fullText += errorMsg;
            setTextStream(lastFullScene.current);
            setStatus("Error occurred");
          }
          if (payload.type === "done") {
            setStatus("Ready");
          }
        } catch {}
      }
    }

    return fullText;
  };

  const sendTextToStory = async (text: string) => {
    if (!text || !text.trim()) {
      setStatus("No speech detected. Try again.");
      return;
    }

    setStatus("Generating story...");
    setTextStream("");
    lastFullScene.current = "";
    speakFlush();

    const payload = {
      sessionId: sessionId.current,
      character: character,
      action: text.trim(),
    };

    try {
      spokenTextLength.current = 0;
      lastSpeechText.current = "";
      await streamText(payload);
    } catch (e) {
      console.error("Story generation error:", e);
      setStatus("Error. Try again.");
    }
  };

  const sendAction = async (action: string) => {
    setStatus("Generating story...");
    setTextStream("");
    lastFullScene.current = "";
    speakFlush();

    const payload = {
      sessionId: sessionId.current,
      character: character,
      action: action || "Begin the adventure.",
    };

    try {
      spokenTextLength.current = 0;
      lastSpeechText.current = "";
      await streamText(payload);
    } catch (e) {
      setStatus("Error. Try again.");
    }
  };

  // Recording control functions
  const startRecording = async () => {
    if (isRecording) return;

    try {
      await ensureMic();
      speakFlush();

      setIsRecording(true);
      setStatus("Listening...");

      try {
        const transcribedText = await startSpeechRecognition();

        if (transcribedText && transcribedText.trim()) {
          console.log("Speech recognition successful:", transcribedText);
          await sendTextToStory(postProcessTranscription(transcribedText));
        } else {
          setStatus("No speech detected. Try again.");
        }
      } catch (error) {
        console.error("Speech recognition failed:", error);
        setStatus("Speech recognition failed. Try again.");
      }
    } catch (e) {
      console.error("Recording start failed:", e);
      setStatus("Microphone access required");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    console.log("Stopping speech recognition...");
    setIsRecording(false);
    setStatus("Processing...");
  };

  // Character form functions
  const saveCharacterFromForm = (formCharacter: Character) => {
    setCharacter(formCharacter);
    localStorage.setItem("rpgCharacter", JSON.stringify(formCharacter));
    setShowCharacterPopup(false);
    setStatus("Ready");
  };

  // Event handlers
  const handleSendText = async () => {
    const action = textInput.trim();
    if (action) {
      await sendAction(action);
      setTextInput("");
      setShowTextPopup(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
    if (
      e.code === "Space" &&
      !isRecording &&
      document.activeElement === document.body
    ) {
      e.preventDefault();
      startRecording();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === "Space" && isRecording) {
      e.preventDefault();
      stopRecording();
    }
  };

  // Initialize speech synthesis voices on component mount
  useEffect(() => {
    const initializeVoices = () => {
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener("voiceschanged", initializeVoices);
      }
    };
    initializeVoices();

    // Initialize on page load
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setStatus("Speech Recognition not supported");
      console.warn("Speech Recognition API not supported in this browser");
    } else {
      console.log("Speech Recognition API available");
    }

    // Global event listeners
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !isRecording &&
        document.activeElement === document.body
      ) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isRecording && !(e.target as Element).closest(".record-button")) {
        stopRecording();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("keyup", handleGlobalKeyUp);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener("keyup", handleGlobalKeyUp);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isRecording]);

  return (
    <>
      <Head>
        <title>Voice Controlled Audio RPG</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>

      {/* Full Window Text Stream */}
      <div className={styles.textStream}>{textStream}</div>

      {/* Record Button (bottom right) */}
      <div className={styles.recordContainer}>
        <button
          className={`${styles.recordButton} ${
            isRecording ? styles.recording : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            startRecording();
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            stopRecording();
          }}
          onMouseLeave={() => stopRecording()}
          onTouchStart={(e) => {
            e.preventDefault();
            startRecording();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopRecording();
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            stopRecording();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className={styles.recordIcon}></div>
        </button>
      </div>

      {/* Status (center bottom) */}
      <div className={styles.statusContainer}>
        <span className={styles.pill}>{status}</span>
      </div>

      {/* Scene Text Toggle (bottom left) */}
      <button
        className={styles.textToggle}
        onClick={() => {
          setShowTextPopup(!showTextPopup);
          if (!showTextPopup) {
            // Focus will be handled by useEffect when popup opens
          }
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="35"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z" />
        </svg>
      </button>

      {/* Scene Text Popup */}
      {showTextPopup && (
        <div
          className={styles.textPopup}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTextPopup(false);
            }
          }}
        >
          <div className={styles.popupHeader}>
            <span>Scene Text</span>
            <button
              className={styles.closeBtn}
              onClick={() => setShowTextPopup(false)}
            >
              ×
            </button>
          </div>
          <div>
            <textarea
              className={styles.textInput}
              placeholder="Type your action here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button className={styles.sendButton} onClick={handleSendText}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* Character Setup Popup */}
      {showCharacterPopup && (
        <CharacterSetupPopup
          character={character}
          onSave={saveCharacterFromForm}
        />
      )}
    </>
  );
}

// Character Setup Component
interface CharacterSetupPopupProps {
  character: Character;
  onSave: (character: Character) => void;
}

function CharacterSetupPopup({ character, onSave }: CharacterSetupPopupProps) {
  const [formData, setFormData] = useState(character);

  const handleSubmit = () => {
    const processedCharacter = {
      ...formData,
      name: formData.name.trim() || "Unknown",
      class: formData.class.trim() || "Adventurer",
      traits:
        typeof formData.traits === "string"
          ? formData.traits
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : formData.traits,
      backstory: formData.backstory.trim() || "A mysterious adventurer.",
    };
    onSave(processedCharacter);
  };

  return (
    <div className={styles.characterPopup}>
      <div className={styles.popupHeader}>
        <span>Create Your Character</span>
      </div>
      <div className={styles.characterForm}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="charName">
            Character Name
          </label>
          <input
            type="text"
            id="charName"
            className={styles.formInput}
            placeholder="Enter your character's name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="charClass">
            Class
          </label>
          <input
            type="text"
            id="charClass"
            className={styles.formInput}
            placeholder="e.g., Rogue, Warrior, Mage"
            value={formData.class}
            onChange={(e) =>
              setFormData({ ...formData, class: e.target.value })
            }
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="charTraits">
            Traits (comma-separated)
          </label>
          <input
            type="text"
            id="charTraits"
            className={styles.formInput}
            placeholder="e.g., careful, curious, brave"
            value={
              Array.isArray(formData.traits)
                ? formData.traits.join(", ")
                : formData.traits
            }
            onChange={(e) =>
              setFormData({ ...formData, traits: e.target.value })
            }
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="charBackstory">
            Backstory
          </label>
          <textarea
            id="charBackstory"
            className={styles.formTextarea}
            placeholder="Tell us about your character's background..."
            value={formData.backstory}
            onChange={(e) =>
              setFormData({ ...formData, backstory: e.target.value })
            }
          />
        </div>
        <button className={styles.startButton} onClick={handleSubmit}>
          Start Adventure
        </button>
      </div>
    </div>
  );
}

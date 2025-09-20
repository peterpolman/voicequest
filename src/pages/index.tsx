import { CharacterSetupPopup, RecordButton, TextPopup } from "@/components";
import { Character } from "@/components/CharacterSetupPopup";
import {
  useSpeechRecognition,
  useSpeechSynthesis,
  useStoryStream,
} from "@/hooks";
import styles from "@/styles/AudioRPG.module.css";
import { useCallback, useEffect, useRef, useState } from "react";

export default function AudioRPG() {
  // Character state
  const [character, setCharacter] = useState<Character>({
    name: "Furial",
    class: "Rogue",
    traits: ["curious", "whitty", "sneaky"],
    backstory:
      "Street urchin from Lowspire, keeps a silver coin for luck and holds a smart dagger for when in trouble.",
  });

  // UI state
  const [showCharacterPopup, setShowCharacterPopup] = useState(true);
  const [showTextPopup, setShowTextPopup] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Refs for managing state
  const sessionId = useRef(crypto.randomUUID());

  // Custom hooks
  const { ensureMic, startSpeechRecognition } = useSpeechRecognition();
  const { speakFlush, speakRealtimeText, spokenTextLength, lastSpeechText } =
    useSpeechSynthesis();
  const { status, textStream, setStatus, sendAction } = useStoryStream();

  // Helper function to send text to story
  const sendTextToStory = async (text: string) => {
    spokenTextLength.current = 0;
    lastSpeechText.current = "";
    await sendAction(sessionId.current, character, text, speakRealtimeText);
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
          await sendTextToStory(transcribedText);
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

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    console.log("Stopping speech recognition...");
    setIsRecording(false);
    setStatus("Processing...");
  }, [isRecording, setStatus]);

  // Character form functions
  const saveCharacterFromForm = (formCharacter: Character) => {
    setCharacter(formCharacter);
    setShowCharacterPopup(false);
    setStatus("Ready");
  };

  // Event handlers
  const handleSendText = async (text: string) => {
    await sendTextToStory(text);
    setShowTextPopup(false);
  };

  // Initialize speech synthesis voices on component mount
  useEffect(() => {
    const initializeVoices = () => {
      const voices = speechSynthesis.getVoices();
      console.log("Available voices:", voices.length);
    };

    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.onvoiceschanged = initializeVoices;
    } else {
      initializeVoices();
    }
  }, []);

  // Global event listeners for mouse interactions
  useEffect(() => {
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
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isRecording && !(e.target as Element).closest(".record-button")) {
        stopRecording();
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isRecording, stopRecording, setStatus]);

  return (
    <>
      {/* Full Window Text Stream */}
      <div className={styles.textStream}>{textStream}</div>

      {/* Record Button (bottom right) */}
      <RecordButton
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      {/* Status Display */}
      <div className={styles.statusContainer}>
        <span className={styles.pill}>{status}</span>
      </div>

      {/* Scene Text Toggle (bottom left) */}
      <button
        className={styles.textToggle}
        onClick={() => {
          setShowTextPopup(!showTextPopup);
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Scene Text Popup */}
      <TextPopup
        isVisible={showTextPopup}
        onClose={() => setShowTextPopup(false)}
        onSendText={handleSendText}
      />

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

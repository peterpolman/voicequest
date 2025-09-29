import {
  CharacterSetupPopup,
  InventoryPopup,
  MechanicsDisplay,
  RecordButton,
  SettingsPopup,
  TextInputPopup,
  type Character,
} from "@/components";
import {
  useSpeechRecognition,
  useSpeechSynthesis,
  useStoryStream,
} from "@/hooks";
import styles from "@/styles/AudioRPG.module.css";
import { useCallback, useEffect, useRef, useState } from "react";

// Gear settings icon component
const GearIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="gray"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Bag inventory icon component
const BagIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="gray"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

// Text input icon component
const TextIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="gray"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 7V5h16v2" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
  </svg>
);

// Default character configuration
const DEFAULT_CHARACTER: Character = {
  name: "Unknown",
  class: "Adventurer",
  traits: ["mysterious", "brave", "curious"],
  backstory: "A mysterious adventurer.",
  language: "en",
  skills: {
    sword: 50,
    alchemy: 50,
    stealth: 50,
    athletics: 50,
    lockpicking: 50,
  },
};

export default function AudioRPG() {
  // Core state
  const [character, setCharacter] = useState<Character>(DEFAULT_CHARACTER);
  const [showCharacterPopup, setShowCharacterPopup] = useState(true);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [showInventoryPopup, setShowInventoryPopup] = useState(false);
  const [showTextInputPopup, setShowTextInputPopup] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const sessionId = useRef(new Date().getTime().toString());

  // Custom hooks
  const { ensureMic, startSpeechRecognition } = useSpeechRecognition(
    character.language
  );
  const {
    speakFlush,
    speakRealtimeText,
    initializeSpeechSynthesis,
    testSpeechSynthesis,
    getAvailableVoices,
    setPreferredVoice,
    getSelectedVoice,
    spokenTextLength,
    lastSpeechText,
  } = useSpeechSynthesis("en");
  const {
    status,
    textStream,
    inventory,
    player,
    location,
    mechanics,
    nextActions,
    clearNextActions,
    setStatus,
    sendAction,
  } = useStoryStream();

  // Core action handler
  const sendTextToStory = useCallback(
    async (text: string) => {
      spokenTextLength.current = 0;
      lastSpeechText.current = "";
      await sendAction(sessionId.current, character, text, speakRealtimeText);
    },
    [character, sendAction, speakRealtimeText, spokenTextLength, lastSpeechText]
  );

  // Speech test functions
  const testSpeechRecognition = useCallback(async () => {
    await ensureMic();
    const result = await startSpeechRecognition();
    console.log("Speech recognition test successful:", result);
  }, [ensureMic, startSpeechRecognition]);

  const testSpeechSynthesisFunction = useCallback(async () => {
    await initializeSpeechSynthesis();
    const testSuccess = await testSpeechSynthesis();

    if (testSuccess) {
      speakRealtimeText(
        "Speech synthesis is working correctly on your device."
      );
    }

    return testSuccess;
  }, [initializeSpeechSynthesis, testSpeechSynthesis, speakRealtimeText]);

  // Recording handlers
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      await ensureMic();
      speakFlush();
      setIsRecording(true);
      setStatus("Listening...");

      const transcribedText = await startSpeechRecognition();

      if (transcribedText?.trim()) {
        console.log("Speech recognition successful:", transcribedText);
        await sendTextToStory(transcribedText);
      } else {
        setStatus("No speech detected. Try again.");
      }
    } catch (error) {
      console.error("Speech recognition failed:", error);
      setStatus("Speech recognition failed. Try again.");
      setIsRecording(false);
    }
  }, [
    isRecording,
    ensureMic,
    speakFlush,
    setStatus,
    startSpeechRecognition,
    sendTextToStory,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    console.log("Stopping speech recognition...");
    setIsRecording(false);
    setStatus("Processing...");
  }, [isRecording, setStatus]);

  // UI event handlers
  const saveCharacterFromForm = useCallback(
    (formCharacter: Character) => {
      setCharacter(formCharacter);
      setShowCharacterPopup(false);
      setStatus("Ready");
    },
    [setStatus]
  );

  const toggleSettingsPopup = useCallback(() => {
    setShowSettingsPopup((prev) => !prev);
  }, []);

  const toggleInventoryPopup = useCallback(() => {
    setShowInventoryPopup((prev) => !prev);
  }, []);

  const toggleTextInputPopup = useCallback(() => {
    setShowTextInputPopup((prev) => !prev);
  }, []);

  // Initialize voices and check browser support
  useEffect(() => {
    const initializeVoices = () => {
      const voices = speechSynthesis.getVoices();
      console.log("Available voices:", voices.length);
    };

    // Check browser support
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setStatus("Speech Recognition not supported");
      console.warn("Speech Recognition API not supported in this browser");
    }

    // Initialize voices
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.onvoiceschanged = initializeVoices;
    } else {
      initializeVoices();
    }
  }, [setStatus]);

  // Global mouse event handler for recording
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isRecording && !(e.target as Element).closest(".record-button")) {
        stopRecording();
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isRecording, stopRecording]);

  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      clearNextActions();
      await sendTextToStory(suggestion);
    },
    [clearNextActions, sendTextToStory]
  );

  return (
    <>
      {/* Full Window Text Stream */}
      <div className={styles.textStream}>{textStream}</div>

      {/* Mechanics Display */}
      <MechanicsDisplay mechanics={mechanics} />

      {/* Next Actions (suggestions) */}
      {nextActions.length > 0 && (
        <div className={styles.nextActionsBar}>
          {nextActions.map((actionText, idx) => (
            <button
              key={`${idx}-${actionText}`}
              className={styles.nextActionBtn}
              onClick={() => handleSuggestion(actionText)}
              title={actionText}
            >
              {actionText}
            </button>
          ))}
        </div>
      )}

      {/* Record Button (bottom center) */}
      <RecordButton
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      {/* Status Display */}
      <div className={styles.statusContainer}>
        <span className={styles.pill}>{status}</span>
      </div>

      {/* Settings Toggle (bottom left) */}
      <button className={styles.textToggle} onClick={toggleSettingsPopup}>
        <GearIcon />
      </button>

      {/* Text Input Toggle (next to inventory) */}
      <button
        className={styles.actionInputButton}
        onClick={toggleTextInputPopup}
        aria-label="Open text input"
        title="Type an action"
      >
        <TextIcon />
      </button>

      <div className={styles.hpDisplay}>
        <span>
          {player?.hp ?? 0} / {player?.maxHp ?? 0} HP
        </span>
        <br />
        <span>{location}</span>
      </div>

      <span className={styles.locationDisplay}></span>

      {/* Inventory Toggle (above settings) */}
      <button
        className={styles.inventoryButton}
        onClick={toggleInventoryPopup}
        aria-label={`Open inventory (${Object.values(inventory).reduce(
          (a, b) => a + b,
          0
        )})`}
        title={`Inventory: ${Object.values(inventory).reduce(
          (a, b) => a + b,
          0
        )} item(s)`}
      >
        <BagIcon />
        {Object.values(inventory).reduce((a, b) => a + b, 0) > 0 && (
          <span className={styles.inventoryBadge}>
            {Object.values(inventory).reduce((a, b) => a + b, 0)}
          </span>
        )}
      </button>

      {/* Inventory Popup */}
      <InventoryPopup
        isVisible={showInventoryPopup}
        onClose={() => setShowInventoryPopup(false)}
        inventory={inventory}
        language={character.language}
      />

      {/* Settings Popup */}
      <SettingsPopup
        isVisible={showSettingsPopup}
        onClose={() => setShowSettingsPopup(false)}
        onEnsureMic={ensureMic}
        onTestSpeechRecognition={testSpeechRecognition}
        onTestSpeechSynthesis={testSpeechSynthesisFunction}
        getAvailableVoices={getAvailableVoices}
        setPreferredVoice={setPreferredVoice}
        getSelectedVoice={getSelectedVoice}
      />

      {/* Text Input Popup */}
      <TextInputPopup
        isVisible={showTextInputPopup}
        onClose={() => setShowTextInputPopup(false)}
        onSendText={sendTextToStory}
      />

      {/* Character Setup Popup */}
      {showCharacterPopup && (
        <CharacterSetupPopup
          character={character}
          onSave={saveCharacterFromForm}
          onEnsureMicrophone={ensureMic}
        />
      )}
    </>
  );
}

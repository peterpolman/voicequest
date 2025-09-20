import { useState } from "react";
import styles from "../styles/AudioRPG.module.css";

export interface Character {
  name: string;
  class: string;
  traits: string[] | string;
  backstory: string;
}

// Character Setup Component
interface CharacterSetupPopupProps {
  character: Character;
  onSave: (character: Character) => void;
  onTestSpeechRecognition?: () => Promise<void>;
  onTestSpeechSynthesis?: () => Promise<boolean>;
  onEnsureMicrophone?: () => Promise<void>;
}

export default function CharacterSetupPopup({
  character,
  onSave,
  onTestSpeechRecognition,
  onTestSpeechSynthesis,
  onEnsureMicrophone,
}: CharacterSetupPopupProps) {
  const [formData, setFormData] = useState(character);
  const [speechStatus, setSpeechStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [speechSynthStatus, setSpeechSynthStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [micStatus, setMicStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");

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

  const handleTestSpeechRecognition = async () => {
    if (!onTestSpeechRecognition) return;

    setSpeechStatus("testing");
    try {
      await onTestSpeechRecognition();
      setSpeechStatus("success");
    } catch (error) {
      console.error("Speech recognition test failed:", error);
      setSpeechStatus("failed");
    }
  };

  const handleTestSpeechSynthesis = async () => {
    if (!onTestSpeechSynthesis) return;

    setSpeechSynthStatus("testing");
    try {
      const success = await onTestSpeechSynthesis();
      setSpeechSynthStatus(success ? "success" : "failed");
    } catch (error) {
      console.error("Speech synthesis test failed:", error);
      setSpeechSynthStatus("failed");
    }
  };

  const handleMicrophoneRequest = async () => {
    if (!onEnsureMicrophone) return;

    setMicStatus("requesting");
    try {
      await onEnsureMicrophone();
      setMicStatus("granted");
    } catch (error) {
      console.error("Microphone access failed:", error);
      setMicStatus("denied");
    }
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

        {/* iOS Speech Recognition Setup */}
        {(onTestSpeechRecognition ||
          onTestSpeechSynthesis ||
          onEnsureMicrophone) && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Voice Features (Required for iOS)
            </label>
            <div className={styles.voiceSetupContainer}>
              {onEnsureMicrophone && (
                <button
                  type="button"
                  className={`${styles.voiceButton} ${styles[micStatus]}`}
                  onClick={handleMicrophoneRequest}
                  disabled={micStatus === "requesting"}
                >
                  {micStatus === "idle" && "🎤 Enable Microphone"}
                  {micStatus === "requesting" && "🎤 Requesting..."}
                  {micStatus === "granted" && "🎤 Microphone Ready"}
                  {micStatus === "denied" && "🎤 Access Denied"}
                </button>
              )}

              {onTestSpeechRecognition && (
                <button
                  type="button"
                  className={`${styles.voiceButton} ${styles[speechStatus]}`}
                  onClick={handleTestSpeechRecognition}
                  disabled={speechStatus === "testing"}
                >
                  {speechStatus === "idle" && "🗣️ Test Speech Recognition"}
                  {speechStatus === "testing" && "🗣️ Testing..."}
                  {speechStatus === "success" && "🗣️ Speech Ready"}
                  {speechStatus === "failed" && "🗣️ Speech Failed"}
                </button>
              )}

              {onTestSpeechSynthesis && (
                <button
                  type="button"
                  className={`${styles.voiceButton} ${styles[speechSynthStatus]}`}
                  onClick={handleTestSpeechSynthesis}
                  disabled={speechSynthStatus === "testing"}
                >
                  {speechSynthStatus === "idle" && "🔊 Test Speech Synthesis"}
                  {speechSynthStatus === "testing" && "🔊 Testing..."}
                  {speechSynthStatus === "success" && "🔊 Audio Ready"}
                  {speechSynthStatus === "failed" && "🔊 Audio Failed"}
                </button>
              )}
            </div>
            <p className={styles.voiceHint}>
              On iOS, tap these buttons to enable voice features. Test both
              speech recognition and audio output. Use Safari for best
              compatibility.
            </p>
          </div>
        )}

        <button className={styles.startButton} onClick={handleSubmit}>
          Start Adventure
        </button>
      </div>
    </div>
  );
}

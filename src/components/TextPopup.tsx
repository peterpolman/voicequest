import { useState, useEffect } from "react";
import styles from "../styles/AudioRPG.module.css";

interface TextPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSendText: (text: string) => void;
  onEnsureMic?: () => Promise<void>;
  onTestSpeechRecognition?: () => Promise<void>;
  onTestSpeechSynthesis?: () => Promise<boolean>;
  getAvailableVoices?: () => SpeechSynthesisVoice[];
  setPreferredVoice?: (voice: SpeechSynthesisVoice | null) => void;
  getSelectedVoice?: () => SpeechSynthesisVoice | null;
}

export default function TextPopup({
  isVisible,
  onClose,
  onSendText,
  onEnsureMic,
  onTestSpeechRecognition,
  onTestSpeechSynthesis,
  getAvailableVoices,
  setPreferredVoice,
  getSelectedVoice,
}: TextPopupProps) {
  const [textInput, setTextInput] = useState("");
  const [micStatus, setMicStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [speechStatus, setSpeechStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [speechSynthStatus, setSpeechSynthStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);

  // Load available voices when component mounts or voice functions are available
  useEffect(() => {
    if (getAvailableVoices) {
      const voices = getAvailableVoices();
      setAvailableVoices(voices);
      
      // Also listen for voices loaded event (iOS)
      const handleVoicesChanged = () => {
        const updatedVoices = getAvailableVoices();
        setAvailableVoices(updatedVoices);
      };
      
      speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      return () => {
        speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, [getAvailableVoices]);

  const handleSendText = () => {
    const action = textInput.trim();
    if (action) {
      onSendText(action);
      setTextInput("");
    }
  };

  const handleMicRequest = async () => {
    if (!onEnsureMic) return;

    setMicStatus("requesting");
    try {
      await onEnsureMic();
      setMicStatus("granted");
    } catch (error) {
      console.error("Microphone access failed:", error);
      setMicStatus("denied");
    }
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

  const handleVoiceSelect = (voice: SpeechSynthesisVoice | null) => {
    if (setPreferredVoice) {
      setPreferredVoice(voice);
      setShowVoiceSelector(false);
    }
  };

  const getCurrentVoiceName = (): string => {
    if (getSelectedVoice) {
      const selected = getSelectedVoice();
      if (selected) {
        return selected.name;
      }
    }
    return "System Default";
  };

  if (!isVisible) return null;

  return (
    <div
      className={styles.textPopup}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.popupHeader}>
        <span>Describe your action</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.popupContent}>
        <textarea
          className={styles.textInput}
          placeholder="Type your action here..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          autoFocus
        />
        
        {/* Voice Selector */}
        {getAvailableVoices && setPreferredVoice && availableVoices.length > 0 && (
          <div className={styles.voiceSelector}>
            <div className={styles.voiceSelectorHeader}>
              <span>🔊 Voice: {getCurrentVoiceName()}</span>
              <button
                className={styles.voiceToggleBtn}
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
              >
                {showVoiceSelector ? "▲" : "▼"}
              </button>
            </div>
            {showVoiceSelector && (
              <div className={styles.voiceOptions}>
                <button
                  className={`${styles.voiceOption} ${!(getSelectedVoice && getSelectedVoice()) ? styles.selected : ""}`}
                  onClick={() => handleVoiceSelect(null)}
                >
                  System Default
                </button>
                {availableVoices.map((voice, index) => (
                  <button
                    key={`${voice.name}-${index}`}
                    className={`${styles.voiceOption} ${
                      getSelectedVoice && getSelectedVoice()?.name === voice.name ? styles.selected : ""
                    }`}
                    onClick={() => handleVoiceSelect(voice)}
                  >
                    {voice.name} {voice.localService ? "📱" : "☁️"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Voice Features Setup for iOS */}
        {(onTestSpeechRecognition || onTestSpeechSynthesis || onEnsureMic) && (
          <div className={styles.voiceSetupContainer}>
            <div className={styles.formLabel}>Voice Features (Required for iOS)</div>
            <div className={styles.voiceSetupButtons}>
              {onEnsureMic && (
                <button
                  type="button"
                  className={`${styles.voiceButton} ${styles[micStatus]}`}
                  onClick={handleMicRequest}
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
        
        <div className={styles.popupActions}>
          <button className={styles.sendButton} onClick={handleSendText}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

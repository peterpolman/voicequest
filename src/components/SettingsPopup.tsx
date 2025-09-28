import { useEffect, useState } from "react";
import styles from "../styles/AudioRPG.module.css";

type TestStatus = "idle" | "testing" | "success" | "failed";
type MicStatus = "idle" | "requesting" | "granted" | "denied";

interface VoiceFeatures {
  onEnsureMic?: () => Promise<void>;
  onTestSpeechRecognition?: () => Promise<void>;
  onTestSpeechSynthesis?: () => Promise<boolean>;
  getAvailableVoices?: () => SpeechSynthesisVoice[];
  setPreferredVoice?: (voice: SpeechSynthesisVoice | null) => void;
  getSelectedVoice?: () => SpeechSynthesisVoice | null;
}

interface SettingsPopupProps extends VoiceFeatures {
  isVisible: boolean;
  onClose: () => void;
}

export default function SettingsPopup({
  isVisible,
  onClose,
  ...voiceFeatures
}: SettingsPopupProps) {
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [speechStatus, setSpeechStatus] = useState<TestStatus>("idle");
  const [speechSynthStatus, setSpeechSynthStatus] = useState<TestStatus>("idle");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(
    []
  );
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);

  const {
    onEnsureMic,
    onTestSpeechRecognition,
    onTestSpeechSynthesis,
    getAvailableVoices,
    setPreferredVoice,
    getSelectedVoice,
  } = voiceFeatures;

  // Load voices and setup handlers
  useEffect(() => {
    if (!getAvailableVoices) return;

    const updateVoices = () => setAvailableVoices(getAvailableVoices());
    updateVoices();

    speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", updateVoices);
  }, [getAvailableVoices]);

  const runTest = async (
    testFn: (() => Promise<void>) | (() => Promise<boolean>) | undefined,
    setStatus: (status: TestStatus) => void
  ) => {
    if (!testFn) return;

    setStatus("testing");
    try {
      const result = await testFn();
      setStatus(typeof result === "boolean" && !result ? "failed" : "success");
    } catch (error) {
      console.error("Test failed:", error);
      setStatus("failed");
    }
  };

  const runMicTest = async () => {
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

  const handleVoiceSelect = (voice: SpeechSynthesisVoice | null) => {
    setPreferredVoice?.(voice);
    setShowVoiceSelector(false);
  };

  const getCurrentVoiceName = () => getSelectedVoice?.()?.name || "System Default";

  const TestButton = ({
    testFn,
    status,
    setStatus,
    icon,
    label,
  }: {
    testFn?: (() => Promise<void>) | (() => Promise<boolean>);
    status: TestStatus;
    setStatus: (status: TestStatus) => void;
    icon: string;
    label: string;
  }) => {
    const handleTest = () => runTest(testFn as any, setStatus);

    return (
      <button
        type="button"
        className={`${styles.voiceButton} ${styles[status]}`}
        onClick={handleTest}
        disabled={status === "testing"}
      >
        {status === "idle" && `${icon} ${label}`}
        {status === "testing" && `${icon} Testing...`}
        {status === "success" && `${icon} Ready`}
        {status === "failed" && `${icon} Failed`}
      </button>
    );
  };

  const MicButton = () => {
    return (
      <button
        type="button"
        className={`${styles.voiceButton} ${styles[micStatus]}`}
        onClick={runMicTest}
        disabled={micStatus === "requesting"}
      >
        {micStatus === "idle" && "🎤 Enable Microphone"}
        {micStatus === "requesting" && "🎤 Requesting..."}
        {micStatus === "granted" && "🎤 Microphone Ready"}
        {micStatus === "denied" && "🎤 Access Denied"}
      </button>
    );
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
        <span>Settings</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.popupContent}>
        {/* Voice Selector */}
        {getAvailableVoices && setPreferredVoice && availableVoices.length > 0 && (
          <div className={styles.voiceSelector}>
            <div
              className={styles.voiceSelectorHeader}
              onClick={() => setShowVoiceSelector(!showVoiceSelector)}
            >
              <span>🔊 Voice: {getCurrentVoiceName()}</span>
              <button className={styles.voiceToggleBtn}>
                {showVoiceSelector ? "▲" : "▼"}
              </button>
            </div>
            {showVoiceSelector && (
              <div className={styles.voiceOptions}>
                <button
                  className={`${styles.voiceOption} ${
                    !getSelectedVoice?.() ? styles.selected : ""
                  }`}
                  onClick={() => handleVoiceSelect(null)}
                >
                  System Default
                </button>
                {availableVoices.map((voice, index) => (
                  <button
                    key={`${voice.name}-${index}`}
                    className={`${styles.voiceOption} ${
                      getSelectedVoice?.()?.name === voice.name
                        ? styles.selected
                        : ""
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
              {onEnsureMic && <MicButton />}
              {onTestSpeechRecognition && (
                <TestButton
                  testFn={onTestSpeechRecognition}
                  status={speechStatus}
                  setStatus={setSpeechStatus}
                  icon="🗣️"
                  label="Test Speech Recognition"
                />
              )}
              {onTestSpeechSynthesis && (
                <TestButton
                  testFn={onTestSpeechSynthesis}
                  status={speechSynthStatus}
                  setStatus={setSpeechSynthStatus}
                  icon="🔊"
                  label="Test Speech Synthesis"
                />
              )}
            </div>
            <p className={styles.voiceHint}>
              On iOS, tap these buttons to enable voice features. Test both speech
              recognition and audio output. Use Safari for best compatibility.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

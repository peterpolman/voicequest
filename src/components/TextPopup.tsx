import { useState } from "react";
import styles from "../styles/AudioRPG.module.css";

interface TextPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSendText: (text: string) => void;
  onEnsureMic?: () => Promise<void>;
}

export default function TextPopup({
  isVisible,
  onClose,
  onSendText,
  onEnsureMic,
}: TextPopupProps) {
  const [textInput, setTextInput] = useState("");
  const [micStatus, setMicStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

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
    setErrorMessage("");
    
    try {
      await onEnsureMic();
      setMicStatus("granted");
    } catch (error) {
      console.error("Microphone access failed:", error);
      setMicStatus("denied");
      setErrorMessage(error instanceof Error ? error.message : "Microphone access failed");
    }
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
      <div>
        <textarea
          className={styles.textInput}
          placeholder="Type your action here..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          autoFocus
        />
        <div className={styles.popupActions}>
          {onEnsureMic && (
            <button
              className={`${styles.micButton} ${styles[micStatus]}`}
              onClick={handleMicRequest}
              disabled={micStatus === "requesting"}
            >
              {micStatus === "requesting" && "🎤 Requesting..."}
              {micStatus === "granted" && "🎤 Granted"}
              {micStatus === "denied" && "🎤 Denied"}
              {micStatus === "idle" && "🎤 Enable Mic"}
            </button>
          )}
          <button className={styles.sendButton} onClick={handleSendText}>
            Send
          </button>
        </div>
        {errorMessage && (
          <div className={styles.errorMessage}>
            ⚠️ {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

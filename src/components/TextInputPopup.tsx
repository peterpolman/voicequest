import { useState } from "react";
import styles from "../styles/AudioRPG.module.css";

interface TextInputPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSendText: (text: string) => void;
}

export default function TextInputPopup({ isVisible, onClose, onSendText }: TextInputPopupProps) {
  const [text, setText] = useState("");

  if (!isVisible) return null;

  const handleSend = () => {
    const action = text.trim();
    if (!action) return;
    onSendText(action);
    setText("");
    onClose();
  };

  return (
    <div
      className={styles.textPopup}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.popupHeader}>
        <span>Type your action</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close text input">
          ×
        </button>
      </div>
      <div className={styles.popupContent}>
        <textarea
          className={styles.textInput}
          placeholder="Describe what you do..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className={styles.popupActions}>
          <button className={styles.sendButton} onClick={handleSend} aria-label="Send action">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

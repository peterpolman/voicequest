import { useState } from "react";
import styles from "../styles/AudioRPG.module.css";

interface TextPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSendText: (text: string) => void;
}

export default function TextPopup({
  isVisible,
  onClose,
  onSendText,
}: TextPopupProps) {
  const [textInput, setTextInput] = useState("");

  const handleSendText = () => {
    const action = textInput.trim();
    if (action) {
      onSendText(action);
      setTextInput("");
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
        <button className={styles.sendButton} onClick={handleSendText}>
          Send
        </button>
      </div>
    </div>
  );
}

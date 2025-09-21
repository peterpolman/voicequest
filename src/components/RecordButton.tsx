import { useCallback } from "react";
import styles from "../styles/AudioRPG.module.css";

interface RecordButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function RecordButton({
  isRecording,
  onStartRecording,
  onStopRecording,
}: RecordButtonProps) {
  // Unified event handler for press start
  const handlePressStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isRecording) {
        onStartRecording();
      }
    },
    [isRecording, onStartRecording]
  );

  // Unified event handler for press end
  const handlePressEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (isRecording) {
        onStopRecording();
      }
    },
    [isRecording, onStopRecording]
  );

  // Prevent click events from bubbling
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className={styles.recordContainer}>
      <button
        className={`${styles.recordButton} ${
          isRecording ? styles.recording : ""
        }`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
        onClick={handleClick}
        type="button"
        aria-label={
          isRecording ? "Recording... Release to stop" : "Hold to record"
        }
      >
        <div className={styles.recordIcon} />
      </button>
    </div>
  );
}

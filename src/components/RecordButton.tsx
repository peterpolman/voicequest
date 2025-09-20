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
  return (
    <div className={styles.recordContainer}>
      <button
        className={`${styles.recordButton} ${
          isRecording ? styles.recording : ""
        }`}
        onMouseDown={(e) => {
          e.preventDefault();
          onStartRecording();
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          onStopRecording();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          onStartRecording();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onStopRecording();
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          onStopRecording();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className={styles.recordIcon}></div>
      </button>
    </div>
  );
}

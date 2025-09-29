import styles from "@/styles/AudioRPG.module.css";
import type { Mechanics } from "@/types";
import { useEffect, useState } from "react";

interface MechanicsDisplayProps {
  mechanics: Mechanics | null;
  isVisible?: boolean;
}

export function MechanicsDisplay({
  mechanics,
  isVisible = true,
}: MechanicsDisplayProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [lastMechanicsId, setLastMechanicsId] = useState<string>("");

  // Auto-show when new mechanics arrive, then auto-hide after 5 seconds
  useEffect(() => {
    if (mechanics && isVisible) {
      // Create a unique ID based on mechanics content to detect new results
      const mechanicsId = `${mechanics.skill_used}-${mechanics.rand}-${
        mechanics.outcome
      }-${Date.now()}`;

      // Only show if this is a new mechanics result
      if (mechanicsId !== lastMechanicsId) {
        setLastMechanicsId(mechanicsId);
        setShouldShow(true);
        const timer = setTimeout(() => setShouldShow(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [mechanics, isVisible, lastMechanicsId]);

  if (!mechanics || !shouldShow) return null;

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "success":
        return "var(--success-color, #4ade80)";
      case "fail":
        return "var(--fail-color, #f87171)";
      case "blocked":
        return "var(--blocked-color, #fbbf24)";
      default:
        return "white";
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "success":
        return "✓";
      case "fail":
        return "✗";
      case "blocked":
        return "⚠";
      default:
        return "";
    }
  };

  const formatPercentage = (value: number) => {
    return Math.round(value * 100);
  };

  return (
    <div className={styles.mechanicsDisplay}>
      <div className={styles.mechanicsHeader}>
        <div
          className={styles.mechanicsOutcome}
          style={{ color: getOutcomeColor(mechanics.outcome) }}
        >
          <span className={styles.outcomeIcon}>
            {getOutcomeIcon(mechanics.outcome)}
          </span>
          <span className={styles.outcomeText}>
            {mechanics.outcome.toUpperCase()}
          </span>
        </div>
      </div>

      <div className={styles.mechanicsDetails}>
        <div className={styles.mechanicsRow}>
          <span className={styles.mechanicsLabel}>Skill:</span>
          <span className={styles.mechanicsValue}>
            {mechanics.skill_used} ({mechanics.skill_value})
          </span>
        </div>

        <div className={styles.mechanicsRow}>
          <span className={styles.mechanicsLabel}>Roll:</span>
          <span className={styles.mechanicsValue}>
            {formatPercentage(mechanics.rand)}%
          </span>
        </div>

        <div className={styles.mechanicsRow}>
          <span className={styles.mechanicsLabel}>Difficulty:</span>
          <span className={styles.mechanicsValue}>
            {formatPercentage(mechanics.difficulty)}%
          </span>
        </div>

        <div className={styles.mechanicsRow}>
          <span className={styles.mechanicsLabel}>Success Chance:</span>
          <span className={styles.mechanicsValue}>
            {formatPercentage(mechanics.p)}%
          </span>
        </div>

        {mechanics.notes && (
          <div className={styles.mechanicsNotes}>
            <span className={styles.mechanicsLabel}>Notes:</span>
            <span className={styles.notesText}>{mechanics.notes}</span>
          </div>
        )}
      </div>

      <button
        className={styles.mechanicsCloseBtn}
        onClick={() => setShouldShow(false)}
        aria-label="Close mechanics display"
      >
        ×
      </button>
    </div>
  );
}

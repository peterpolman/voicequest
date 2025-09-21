import { useState } from "react";
import styles from "../styles/AudioRPG.module.css";

export interface Character {
  name: string;
  class: string;
  traits: string[] | string;
  backstory: string;
  language: "en" | "nl";
}

interface CharacterSetupPopupProps {
  character: Character;
  onSave: (character: Character) => void;
  onEnsureMicrophone?: () => Promise<void>;
}

export default function CharacterSetupPopup({
  character,
  onSave,
  onEnsureMicrophone,
}: CharacterSetupPopupProps) {
  const [formData, setFormData] = useState(character);

  const updateField = (field: keyof Character, value: string | "en" | "nl") => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const processTraits = (traits: string[] | string): string[] => {
    return typeof traits === "string"
      ? traits
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : traits;
  };

  const handleSubmit = async () => {
    // Ensure microphone access before starting adventure
    try {
      await onEnsureMicrophone?.();
    } catch (error) {
      console.error("Microphone access failed:", error);
      // Continue anyway - user can enable in settings later
    }

    const processedCharacter: Character = {
      name: formData.name.trim(),
      class: formData.class.trim(),
      traits: processTraits(formData.traits),
      backstory: formData.backstory.trim(),
      language: formData.language,
    };

    onSave(processedCharacter);
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
            onChange={(e) => updateField("name", e.target.value)}
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
            onChange={(e) => updateField("class", e.target.value)}
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
            onChange={(e) => updateField("traits", e.target.value)}
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
            onChange={(e) => updateField("backstory", e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="charLanguage">
            Language
          </label>
          <select
            id="charLanguage"
            className={styles.formInput}
            value={formData.language}
            onChange={(e) =>
              updateField("language", e.target.value as "en" | "nl")
            }
          >
            <option value="en">🇺🇸 English</option>
            <option value="nl">🇳🇱 Nederlands</option>
          </select>
        </div>

        <button className={styles.startButton} onClick={handleSubmit}>
          Start Adventure
        </button>
      </div>
    </div>
  );
}

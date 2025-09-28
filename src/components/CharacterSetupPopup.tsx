import { useState } from "react";
import styles from "../styles/AudioRPG.module.css";

export interface Character {
  name: string;
  class: string;
  traits: string[] | string;
  backstory: string;
  language: "en" | "nl";
  skills: {
    sword: number;
    alchemy: number;
    stealth: number;
    athletics: number;
    lockpicking: number;
  };
  // Optional fields not configured via the form
  hp?: number;
  maxHp?: number;
  level?: number;
  xp?: number;
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
  const initialSkills = character.skills;
  const [formData, setFormData] = useState<Character>({
    ...character,
    skills: initialSkills,
  });

  const updateField = (field: keyof Character, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateSkill = (skill: keyof Character["skills"], value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setFormData((prev) => ({
      ...prev,
      skills: { ...prev.skills, [skill]: clamped },
    }));
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
      skills: {
        sword: Math.max(0, Math.min(100, Math.round(formData.skills.sword))),
        alchemy: Math.max(
          0,
          Math.min(100, Math.round(formData.skills.alchemy))
        ),
        stealth: Math.max(
          0,
          Math.min(100, Math.round(formData.skills.stealth))
        ),
        athletics: Math.max(
          0,
          Math.min(100, Math.round(formData.skills.athletics))
        ),
        lockpicking: Math.max(
          0,
          Math.min(100, Math.round(formData.skills.lockpicking))
        ),
      },
    };

    onSave(processedCharacter);
  };

  const renderSkillSlider = (label: string, key: keyof Character["skills"]) => (
    <div className={styles.skillRow}>
      <div className={styles.skillHeader}>
        <span className={styles.skillLabel}>{label}</span>
        <span className={styles.skillValue}>{formData.skills[key]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={formData.skills[key]}
        onChange={(e) => updateSkill(key, Number(e.target.value))}
        className={styles.skillSlider}
        aria-label={`${label} skill level`}
      />
    </div>
  );

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

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Skills</label>
          <div className={styles.skillsContainer}>
            {renderSkillSlider("Sword", "sword")}
            {renderSkillSlider("Alchemy", "alchemy")}
            {renderSkillSlider("Stealth", "stealth")}
            {renderSkillSlider("Athletics", "athletics")}
            {renderSkillSlider("Lockpicking", "lockpicking")}
          </div>
        </div>

        <button className={styles.startButton} onClick={handleSubmit}>
          Start Adventure
        </button>
      </div>
    </div>
  );
}

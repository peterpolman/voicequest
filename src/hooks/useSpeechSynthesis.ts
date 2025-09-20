import { useRef } from "react";

export function useSpeechSynthesis() {
  const spokenTextLength = useRef(0);
  const lastSpeechText = useRef("");

  const speakFlush = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    spokenTextLength.current = 0;
    lastSpeechText.current = "";
  };

  const speakText = (text: string) => {
    if (!text || text.trim() === "") return;

    // Check if Speech Synthesis is available
    if (!('speechSynthesis' in window)) {
      console.warn("Speech Synthesis not supported");
      return;
    }

    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // iOS Safari voice selection fix
    const setVoice = () => {
      const voices = speechSynthesis.getVoices();
      console.log("Available voices:", voices.length);
      
      if (voices.length > 0) {
        // Try to find a good English voice
        const preferredVoice = voices.find(
          (voice) =>
            (voice.name.includes("Google UK English Male") ||
             voice.name.includes("Samantha") ||
             voice.name.includes("Karen") ||
             voice.name.includes("Daniel")) &&
            voice.lang.startsWith("en")
        );
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log("Using voice:", preferredVoice.name);
        } else {
          // Fallback to first English voice
          const englishVoice = voices.find(voice => voice.lang.startsWith("en"));
          if (englishVoice) {
            utterance.voice = englishVoice;
            console.log("Using fallback voice:", englishVoice.name);
          }
        }
      }
    };

    // iOS Safari requires voices to be loaded asynchronously
    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.onvoiceschanged = () => {
        setVoice();
        speechSynthesis.speak(utterance);
        speechSynthesis.onvoiceschanged = null; // Clear the handler
      };
    } else {
      setVoice();
      speechSynthesis.speak(utterance);
    }

    // Add event listeners for debugging
    utterance.onstart = () => {
      console.log("Speech started");
    };

    utterance.onend = () => {
      console.log("Speech ended");
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event);
    };
  };

  const speakRealtimeText = (accumulatedText: string) => {
    const newText = accumulatedText.slice(spokenTextLength.current);
    if (!newText.trim()) return;

    const sentenceRegex = /[.!?]+\s*/g;
    let match;
    let lastCompleteIndex = 0;

    while ((match = sentenceRegex.exec(newText)) !== null) {
      lastCompleteIndex = match.index + match[0].length;
    }

    if (lastCompleteIndex > 0) {
      const toSpeak = newText.slice(0, lastCompleteIndex).trim();
      if (toSpeak && toSpeak !== lastSpeechText.current) {
        console.log("Speaking:", toSpeak);
        speakText(toSpeak);
        lastSpeechText.current = toSpeak;
        spokenTextLength.current += lastCompleteIndex;
      }
    }
  };

  return {
    speakFlush,
    speakText,
    speakRealtimeText,
    spokenTextLength,
    lastSpeechText,
  };
}

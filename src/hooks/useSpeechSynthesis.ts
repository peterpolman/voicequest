import { useRef } from "react";

export function useSpeechSynthesis() {
  const spokenTextLength = useRef(0);
  const lastSpeechText = useRef("");
  const speechQueue = useRef<string[]>([]);
  const isSpeaking = useRef(false);

  const speakFlush = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    speechQueue.current = [];
    isSpeaking.current = false;
    spokenTextLength.current = 0;
    lastSpeechText.current = "";
  };

  const createUtterance = (text: string): SpeechSynthesisUtterance => {
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
          const englishVoice = voices.find((voice) =>
            voice.lang.startsWith("en")
          );
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
        speechSynthesis.onvoiceschanged = null; // Clear the handler
      };
    } else {
      setVoice();
    }

    return utterance;
  };

  const processQueue = () => {
    if (isSpeaking.current || speechQueue.current.length === 0) {
      return;
    }

    const text = speechQueue.current.shift()!;
    isSpeaking.current = true;

    const utterance = createUtterance(text);

    // Add event listeners
    utterance.onstart = () => {
      console.log("Speech started:", text);
    };

    utterance.onend = () => {
      console.log("Speech ended:", text);
      isSpeaking.current = false;
      // Process next item in queue after a small delay for Safari
      setTimeout(() => {
        processQueue();
      }, 100);
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event);
      isSpeaking.current = false;
      // Try to continue with next item in queue
      setTimeout(() => {
        processQueue();
      }, 100);
    };

    speechSynthesis.speak(utterance);
  };

  const speakText = (text: string) => {
    if (!text || text.trim() === "") return;

    // Check if Speech Synthesis is available
    if (!("speechSynthesis" in window)) {
      console.warn("Speech Synthesis not supported");
      return;
    }

    // For direct speakText calls (not from streaming), cancel current speech and queue
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    speechQueue.current = [];
    isSpeaking.current = false;

    // Add to queue and process
    speechQueue.current.push(text);
    processQueue();
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
        console.log("Queueing for speech:", toSpeak);

        // Add to queue instead of immediately speaking
        speechQueue.current.push(toSpeak);
        lastSpeechText.current = toSpeak;
        spokenTextLength.current += lastCompleteIndex;

        // Start processing queue if not already speaking
        processQueue();
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

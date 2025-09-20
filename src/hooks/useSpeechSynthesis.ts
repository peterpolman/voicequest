import { useRef } from "react";

export function useSpeechSynthesis() {
  const spokenTextLength = useRef(0);
  const lastSpeechText = useRef("");
  const speechQueue = useRef<string[]>([]);
  const isSpeaking = useRef(false);
  const isProcessingQueue = useRef(false);

  // Test function to validate speech synthesis on iOS
  const testSpeechSynthesis = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        console.warn("Speech Synthesis not supported");
        resolve(false);
        return;
      }

      const testUtterance = new SpeechSynthesisUtterance("Test");
      testUtterance.volume = 0.1; // Very quiet test
      testUtterance.rate = 2; // Fast test

      let hasStarted = false;
      const timeout = setTimeout(() => {
        resolve(false);
      }, 1000);

      testUtterance.onstart = () => {
        hasStarted = true;
        clearTimeout(timeout);
        speechSynthesis.cancel(); // Stop the test
        resolve(true);
      };

      testUtterance.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      testUtterance.onend = () => {
        clearTimeout(timeout);
        resolve(hasStarted);
      };

      speechSynthesis.speak(testUtterance);
    });
  };

  const speakFlush = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    speechQueue.current = [];
    isSpeaking.current = false;
    isProcessingQueue.current = false;
    spokenTextLength.current = 0;
    lastSpeechText.current = "";
  };

  // Initialize speech synthesis for iOS (must be called from user gesture)
  const initializeSpeechSynthesis = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve(false);
        return;
      }

      // Force initialization by speaking a silent utterance
      const initUtterance = new SpeechSynthesisUtterance(" ");
      initUtterance.volume = 0;
      initUtterance.rate = 10;

      initUtterance.onend = () => {
        console.log("Speech synthesis initialized");
        resolve(true);
      };

      initUtterance.onerror = () => {
        console.log("Speech synthesis initialization failed");
        resolve(false);
      };

      speechSynthesis.speak(initUtterance);
    });
  };

  const createUtterance = (text: string): SpeechSynthesisUtterance => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for iOS stability
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US"; // Explicit language setting for iOS

    // iOS Safari voice selection fix
    const setVoice = () => {
      const voices = speechSynthesis.getVoices();
      console.log("Available voices:", voices.length);

      if (voices.length > 0) {
        // iOS-specific voice preferences
        const preferredVoice = voices.find(
          (voice) =>
            (voice.name.includes("Samantha") ||
              voice.name.includes("Alex") ||
              voice.name.includes("Karen") ||
              voice.name.includes("Daniel") ||
              voice.name.includes("Moira") ||
              voice.localService === true) && // Prefer local voices on iOS
            voice.lang.startsWith("en")
        );

        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log(
            "Using voice:",
            preferredVoice.name,
            "Local:",
            preferredVoice.localService
          );
        } else {
          // Fallback to first English voice
          const englishVoice = voices.find((voice) =>
            voice.lang.startsWith("en")
          );
          if (englishVoice) {
            utterance.voice = englishVoice;
            console.log(
              "Using fallback voice:",
              englishVoice.name,
              "Local:",
              englishVoice.localService
            );
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

  const speakUtterance = (
    utterance: SpeechSynthesisUtterance
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          isSpeaking.current = false;
        }
      };

      utterance.onstart = () => {
        console.log("Speech started:", utterance.text);
      };

      utterance.onend = () => {
        console.log("Speech ended:", utterance.text);
        cleanup();
        resolve();
      };

      utterance.onerror = (event) => {
        console.error("Speech error:", event);
        cleanup();
        reject(event);
      };

      // iOS Safari workaround: Resume if paused
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }

      isSpeaking.current = true;
      speechSynthesis.speak(utterance);

      // iOS Safari workaround: Check if speaking started and force timeout
      setTimeout(() => {
        if (!speechSynthesis.speaking && !resolved) {
          console.log("Speech failed to start within timeout");
          cleanup();
          reject(new Error("Speech failed to start"));
        }
      }, 1000); // Give iOS time to start speaking

      // Safety timeout for iOS - sometimes onend doesn't fire
      setTimeout(() => {
        if (!resolved) {
          console.log("Speech timeout - forcing completion");
          cleanup();
          resolve();
        }
      }, 10000); // 10 second max per utterance
    });
  };

  const processQueue = async () => {
    if (isProcessingQueue.current || speechQueue.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;

    while (speechQueue.current.length > 0) {
      const text = speechQueue.current.shift()!;
      const utterance = createUtterance(text);

      try {
        await speakUtterance(utterance);
        // Add a small delay between utterances for iOS stability
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error("Failed to speak text:", text, error);
        // Continue with next item even if current failed
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    isProcessingQueue.current = false;
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
    isProcessingQueue.current = false;

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
    testSpeechSynthesis,
    initializeSpeechSynthesis,
    spokenTextLength,
    lastSpeechText,
  };
}

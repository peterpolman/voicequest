import { useRef } from "react";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function useSpeechRecognition(language: "en" | "nl" = "en") {
  const mediaStream = useRef<MediaStream | null>(null);

  const initSpeechRecognition = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.warn("Speech Recognition API not supported in this browser");
      return null;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    // Set language based on character's language
    recognition.lang = language === "nl" ? "nl-NL" : "en-US";
    recognition.maxAlternatives = 1;

    console.log("Speech recognition language set to:", recognition.lang);

    return recognition;
  };

  const ensureMic = async (): Promise<void> => {
    if (mediaStream.current) return;

    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      console.log("Microphone access granted");
    } catch (error) {
      console.error("Microphone access denied:", error);
      throw new Error("Microphone access required for speech recognition");
    }
  };

  const startSpeechRecognition = (): Promise<string> => {
    const recognition = initSpeechRecognition();
    if (!recognition) {
      throw new Error("Speech Recognition not supported");
    }

    return new Promise((resolve, reject) => {
      recognition.onresult = (event: any) => {
        const result = event.results[0][0].transcript;
        console.log("Speech recognition result:", result);
        resolve(result);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        reject(new Error(`Speech recognition failed: ${event.error}`));
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
      };

      recognition.start();
    });
  };

  return {
    ensureMic,
    startSpeechRecognition,
  };
}

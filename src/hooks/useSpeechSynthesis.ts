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

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) =>
        voice.name.includes("Google UK English Male") &&
        voice.lang.startsWith("en")
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
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

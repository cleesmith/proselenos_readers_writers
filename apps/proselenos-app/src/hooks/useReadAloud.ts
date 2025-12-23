// hooks/useReadAloud.ts
// Reusable Web Speech API hook for Read Aloud functionality
// Works best in MS Edge with "Natural" voices, but available in all browsers

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseReadAloudReturn {
  // State
  isSpeaking: boolean;
  isPaused: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;

  // Actions
  play: (text: string, onEnd?: () => void) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSelectedVoice: (voice: SpeechSynthesisVoice) => void;
}

const VOICE_STORAGE_KEY = 'authorsTTSVoice';

export function useReadAloud(): UseReadAloudReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<SpeechSynthesisVoice | null>(null);

  // Track current utterance for cleanup
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Wrapper to save voice selection to localStorage
  const setSelectedVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoiceState(voice);
    if (typeof window !== 'undefined') {
      localStorage.setItem(VOICE_STORAGE_KEY, voice.name);
    }
  }, []);

  // Load voices on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Only set default voice if not already selected
      if (!selectedVoice && availableVoices.length > 0) {
        // Check localStorage for saved voice preference
        const savedVoiceName = localStorage.getItem(VOICE_STORAGE_KEY);
        const savedVoice = savedVoiceName
          ? availableVoices.find((v) => v.name === savedVoiceName)
          : null;
        // Prefer "Natural" English voice (Edge neural voices)
        const natural = availableVoices.find(
          (v) => v.name.includes('Natural') && v.lang.startsWith('en')
        );
        // Fallback to any English voice
        const english = availableVoices.find((v) => v.lang.startsWith('en'));
        // Priority: saved > natural > english > first
        setSelectedVoiceState(savedVoice || natural || english || availableVoices[0] || null);
      }
    };

    // Load immediately (some browsers have voices ready)
    loadVoices();

    // Also listen for async voice loading (Chrome/Edge)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice]);

  // Play or resume speech
  const play = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // If paused, resume
      if (window.speechSynthesis.paused && window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        return;
      }

      // If already speaking, do nothing
      if (window.speechSynthesis.speaking) return;

      // Cancel any stuck state (Chrome bug workaround)
      window.speechSynthesis.cancel();

      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Set voice if selected
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Speed = 1.0 (normal)
      utterance.rate = 1.0;

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        onEnd?.();
      };

      utterance.onerror = (e) => {
        // "interrupted" is expected when stop() is called - not a real error
        if (e.error !== 'interrupted') {
          console.error('TTS error:', e);
        }
        setIsSpeaking(false);
        setIsPaused(false);
      };

      // Speak
      window.speechSynthesis.speak(utterance);
    },
    [selectedVoice]
  );

  // Pause speech
  const pause = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  // Resume speech
  const resume = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Don't check browser paused state - it's unreliable
    // Just call resume() and update our state
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, []);

  // Stop speech
  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  return {
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    play,
    pause,
    resume,
    stop,
    setSelectedVoice,
  };
}

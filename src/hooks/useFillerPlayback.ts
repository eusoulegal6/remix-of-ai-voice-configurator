import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectionStatus, SessionIndicators } from "@/hooks/useGeminiAudio";

const GREETING_KEYS = ["hello", "hi_there"];

/**
 * Plays a single pre-generated greeting clip on the FIRST turn only.
 *
 * - Preloads the greeting audio when the voice is known.
 * - Plays immediately when the session starts (speaker becomes "ready" for the first time).
 * - Stops instantly on: user speech, real AI audio, disconnect, or toggle off.
 * - Does nothing on later turns.
 */
export function useFillerPlayback({
  voiceName,
  status,
  sessionIndicators,
}: {
  voiceName: string;
  status: ConnectionStatus;
  sessionIndicators: SessionIndicators;
}) {
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedRef = useRef(false);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // ── Preload one greeting clip for the selected voice ──────────────
  const preloadedAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedVoiceRef = useRef<string>("");

  useEffect(() => {
    if (!voiceName) return;
    // Don't re-fetch if already preloaded for this voice
    if (preloadedVoiceRef.current === voiceName && preloadedAudioRef.current) return;

    preloadedAudioRef.current = null;
    preloadedVoiceRef.current = voiceName;

    supabase
      .from("filler_audio")
      .select("audio_url")
      .eq("voice_name", voiceName)
      .eq("status", "ready")
      .in("phrase_key", GREETING_KEYS)
      .not("audio_url", "is", null)
      .limit(1)
      .then(({ data }) => {
        const url = data?.[0]?.audio_url;
        if (!url) return;
        // Preload into an Audio element so playback is instant
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = 0.85;
        // Only store if voice hasn't changed since fetch started
        if (preloadedVoiceRef.current === voiceName) {
          preloadedAudioRef.current = audio;
        }
      });
  }, [voiceName]);

  // ── Stop greeting playback ────────────────────────────────────────
  const stopFiller = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // ── Play the preloaded greeting ───────────────────────────────────
  const playGreeting = useCallback(() => {
    if (!enabledRef.current || playedRef.current) return;
    const audio = preloadedAudioRef.current;
    if (!audio) return;

    playedRef.current = true;
    audio.currentTime = 0;
    audio.onended = () => {
      audioRef.current = null;
    };
    audio.onerror = () => {
      audioRef.current = null;
    };
    audio.play().catch(() => {});
    audioRef.current = audio;
  }, []);

  // ── React to speaker state — first turn only ─────────────────────
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasTriggeredRef.current) return;

    const speakerState = sessionIndicators.speaker.state;

    // Stop instantly when real AI audio arrives
    if (speakerState === "playing") {
      stopFiller();
      hasTriggeredRef.current = true; // first turn is over
      return;
    }

    // Play greeting when speaker is ready and session is listening (first turn)
    if (speakerState === "ready" && status === "listening") {
      playGreeting();
    }
  }, [sessionIndicators.speaker.state, status, enabled, stopFiller, playGreeting]);

  // ── Stop on disconnect and reset for next session ─────────────────
  useEffect(() => {
    if (status === "disconnected") {
      stopFiller();
      playedRef.current = false;
      hasTriggeredRef.current = false;
    }
  }, [status, stopFiller]);

  // ── Stop if user disables ────────────────────────────────────────
  useEffect(() => {
    if (!enabled) stopFiller();
  }, [enabled, stopFiller]);

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => stopFiller();
  }, [stopFiller]);

  return { fillerEnabled: enabled, setFillerEnabled: setEnabled, stopFiller };
}

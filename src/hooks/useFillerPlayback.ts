import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectionStatus, SessionIndicators } from "@/hooks/useGeminiAudio";

const GREETING_KEYS = ["hear_you"];

/**
 * Plays a single pre-generated greeting clip on the FIRST turn only,
 * triggered AFTER the user's first speech burst ends.
 *
 * - Preloads the greeting audio when the voice is known.
 * - Plays only after the first user speech burst finishes (onFirstSpeechEnd).
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
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = 0.85;
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

  // ── Called by Demo when the user's first speech burst ends ────────
  const firstSpeechEndedRef = useRef(false);

  const onFirstSpeechEnd = useCallback(() => {
    if (firstSpeechEndedRef.current || playedRef.current) return;
    firstSpeechEndedRef.current = true;
    playGreeting();
  }, [playGreeting]);

  // ── Stop instantly when real AI audio starts ─────────────────────
  useEffect(() => {
    if (sessionIndicators.speaker.state === "playing") {
      stopFiller();
    }
  }, [sessionIndicators.speaker.state, stopFiller]);

  // ── Stop on disconnect and reset for next session ─────────────────
  useEffect(() => {
    if (status === "disconnected") {
      stopFiller();
      playedRef.current = false;
      firstSpeechEndedRef.current = false;
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

  return { fillerEnabled: enabled, setFillerEnabled: setEnabled, stopFiller, onFirstSpeechEnd };
}

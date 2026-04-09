import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectionStatus, SessionIndicators } from "@/hooks/useGeminiAudio";

interface FillerClip {
  phrase_key: string;
  phrase_text: string;
  audio_url: string;
}

const GREETING_KEYS = ["hello", "hi_there"];
const FILLER_DELAY_MS = 2000;
const FIRST_TURN_DELAY_MS = 1500;

/**
 * Plays pre-generated filler audio clips during conversation gaps.
 *
 * Strategy: observe sessionIndicators.speaker.state from OUTSIDE useGeminiAudio.
 * - speaker "ready" + status "listening" → start delay timer
 * - speaker "playing" → stop filler instantly (real AI audio arrived)
 * - status "disconnected" → stop filler, reset turn counter
 *
 * Playback uses a plain HTMLAudioElement — completely isolated from
 * the core PCM pipeline in useGeminiAudio.
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
  const clipsRef = useRef<FillerClip[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const turnCountRef = useRef(0);
  const lastSpeakerStateRef = useRef(sessionIndicators.speaker.state);
  const enabledRef = useRef(enabled);

  // Keep enabledRef in sync so callbacks see the latest value
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // ── Fetch ready clips for the selected voice ──────────────────────
  useEffect(() => {
    if (!voiceName) return;
    supabase
      .from("filler_audio")
      .select("phrase_key, phrase_text, audio_url")
      .eq("voice_name", voiceName)
      .eq("status", "ready")
      .not("audio_url", "is", null)
      .then(({ data }) => {
        clipsRef.current = (data ?? []) as FillerClip[];
      });
  }, [voiceName]);

  // ── Stop any playing filler and clear pending timer ───────────────
  const stopFiller = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // ── Pick and play one filler clip ─────────────────────────────────
  const playFiller = useCallback(() => {
    if (!enabledRef.current || clipsRef.current.length === 0) return;

    const isFirstTurn = turnCountRef.current === 0;
    let candidates: FillerClip[];

    if (isFirstTurn) {
      candidates = clipsRef.current.filter((c) =>
        GREETING_KEYS.includes(c.phrase_key),
      );
      if (candidates.length === 0) candidates = clipsRef.current;
    } else {
      candidates = clipsRef.current.filter(
        (c) => !GREETING_KEYS.includes(c.phrase_key),
      );
      if (candidates.length === 0) candidates = clipsRef.current;
    }

    const clip = candidates[Math.floor(Math.random() * candidates.length)];
    if (!clip?.audio_url) return;

    const audio = new Audio(clip.audio_url);
    audio.volume = 0.85;
    audio.onended = () => {
      audioRef.current = null;
    };
    audio.onerror = () => {
      audioRef.current = null;
    };
    audio.play().catch(() => {
      /* browser may block autoplay — fail silently */
    });
    audioRef.current = audio;
  }, []);

  // ── React to speaker state changes ────────────────────────────────
  useEffect(() => {
    const speakerState = sessionIndicators.speaker.state;
    const prevState = lastSpeakerStateRef.current;
    lastSpeakerStateRef.current = speakerState;

    if (!enabled) {
      stopFiller();
      return;
    }

    // STOP: real AI audio started playing
    if (speakerState === "playing") {
      stopFiller();
      turnCountRef.current += 1;
      return;
    }

    // START TIMER: speaker just became "ready" while session is active
    if (
      speakerState === "ready" &&
      status === "listening" &&
      prevState !== "ready"
    ) {
      stopFiller(); // clear any prior timer
      const delay =
        turnCountRef.current === 0 ? FIRST_TURN_DELAY_MS : FILLER_DELAY_MS;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        // Re-check conditions at fire time
        if (
          lastSpeakerStateRef.current === "ready" &&
          enabledRef.current
        ) {
          playFiller();
        }
      }, delay);
    }
  }, [sessionIndicators.speaker.state, status, enabled, stopFiller, playFiller]);

  // ── Stop everything on disconnect and reset turn counter ──────────
  useEffect(() => {
    if (status === "disconnected") {
      stopFiller();
      turnCountRef.current = 0;
    }
  }, [status, stopFiller]);

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => stopFiller();
  }, [stopFiller]);

  return { fillerEnabled: enabled, setFillerEnabled: setEnabled, stopFiller };
}

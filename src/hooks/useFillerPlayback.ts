import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectionStatus, SessionIndicators } from "@/hooks/useGeminiAudio";
import { getVersionedAudioUrl } from "@/lib/filler-audio";

const GREETING_KEYS = ["hear_you"];

const logFillerDebug = (phase: string, details: Record<string, unknown> = {}) => {
  console.debug("[FillerDebug]", {
    atMs: performance.now(),
    phase,
    ...details,
  });
};

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
  const playStartedRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    logFillerDebug("useFillerPlayback.state", {
      selectedVoice: voiceName,
      fillerEnabled: enabled,
      played: playedRef.current,
    });
  }, [enabled, voiceName]);

  // ── Preload one greeting clip for the selected voice ──────────────
  const preloadedAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedVoiceRef = useRef<string>("");
  const preloadedAudioUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const firstSpeechEndedRef = useRef(false);
  const SILENT_WARMUP_AUDIO_URL = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

  const playConfiguredGreeting = useCallback(() => {
    if (!enabledRef.current || playedRef.current) return;

    const audio = preloadedAudioRef.current;
    const audioUrl = preloadedAudioUrlRef.current;

    if (!audio || !audioUrl) {
      pendingPlayRef.current = true;
      logFillerDebug("useFillerPlayback.audioPendingUntilReady", {
        hasAudio: Boolean(audio),
        hasAudioUrl: Boolean(audioUrl),
        firstSpeechEnded: firstSpeechEndedRef.current,
      });
      return;
    }

    pendingPlayRef.current = false;
    playStartedRef.current = false;

    if ((audio.currentSrc || audio.src) !== audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }

    audio.muted = false;
    audio.currentTime = 0;
    audio.onplaying = () => {
      playedRef.current = true;
      playStartedRef.current = true;
      logFillerDebug("useFillerPlayback.audioPlaying", {
        currentTime: audio.currentTime,
        paused: audio.paused,
        readyState: audio.readyState,
        networkState: audio.networkState,
        volume: audio.volume,
        muted: audio.muted,
      });
    };
    audio.onended = () => {
      logFillerDebug("useFillerPlayback.audioEnded", {
        currentTime: audio.currentTime,
      });
      audioRef.current = null;
      playStartedRef.current = false;
      pendingPlayRef.current = false;
    };
    audio.onerror = () => {
      logFillerDebug("useFillerPlayback.audioError", {
        currentTime: audio.currentTime,
        readyState: audio.readyState,
        networkState: audio.networkState,
        currentSrc: audio.currentSrc || audio.src,
      });
      audioRef.current = null;
      playStartedRef.current = false;
      playedRef.current = false;
    };

    logFillerDebug("useFillerPlayback.audioPlayCalled", {
      currentTime: audio.currentTime,
      paused: audio.paused,
      readyState: audio.readyState,
      networkState: audio.networkState,
      volume: audio.volume,
      muted: audio.muted,
      currentSrc: audio.currentSrc || audio.src,
    });

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          playedRef.current = true;
          logFillerDebug("useFillerPlayback.audioPlayResolved", {
            currentTime: audio.currentTime,
            paused: audio.paused,
            readyState: audio.readyState,
            networkState: audio.networkState,
            volume: audio.volume,
            muted: audio.muted,
          });

          window.setTimeout(() => {
            logFillerDebug("useFillerPlayback.audioPostPlayCheck", {
              currentTime: audio.currentTime,
              paused: audio.paused,
              ended: audio.ended,
              readyState: audio.readyState,
              networkState: audio.networkState,
              volume: audio.volume,
              muted: audio.muted,
            });
          }, 150);
        })
        .catch((error: unknown) => {
          playedRef.current = false;
          pendingPlayRef.current = firstSpeechEndedRef.current;
          logFillerDebug("useFillerPlayback.audioPlayRejected", {
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : null,
            currentTime: audio.currentTime,
            paused: audio.paused,
            readyState: audio.readyState,
            networkState: audio.networkState,
            volume: audio.volume,
            muted: audio.muted,
          });
        });
    }

    audioRef.current = audio;
  }, []);

  const loadFillerUrl = useCallback((voice: string) => {
    logFillerDebug("useFillerPlayback.preloadLookupStarted", {
      selectedVoice: voice,
      phraseKeys: GREETING_KEYS,
    });

    supabase
      .from("filler_audio")
      .select("audio_url, phrase_key, phrase_text, voice_name, status, updated_at")
      .eq("voice_name", voice)
      .eq("status", "ready")
      .in("phrase_key", GREETING_KEYS)
      .not("audio_url", "is", null)
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          logFillerDebug("useFillerPlayback.preloadLookupError", {
            selectedVoice: voice,
            error: error.message,
          });
          return;
        }

        const row = data?.[0];
        const url = getVersionedAudioUrl(row?.audio_url, row?.updated_at);
        logFillerDebug("useFillerPlayback.preloadLookupResult", {
          selectedVoice: voice,
          rowCount: data?.length ?? 0,
          phraseKey: row?.phrase_key ?? null,
          audioUrl: url ?? null,
        });

        if (!url || preloadedVoiceRef.current !== voice) return;

        preloadedAudioUrlRef.current = url;

        const existing = preloadedAudioRef.current;
        if (existing) {
          if ((existing.currentSrc || existing.src) !== url) {
            existing.src = url;
            existing.load();
          }
          logFillerDebug("useFillerPlayback.preloadSrcUpdated", {
            selectedVoice: voice,
            audioUrl: url,
          });
        } else {
          const audio = new Audio(url);
          audio.preload = "auto";
          audio.volume = 0.85;
          audio.muted = false;
          preloadedAudioRef.current = audio;
          logFillerDebug("useFillerPlayback.preloadAudioCreated", {
            selectedVoice: voice,
            audioUrl: url,
          });
        }

        if (pendingPlayRef.current && firstSpeechEndedRef.current && enabledRef.current && !playedRef.current) {
          logFillerDebug("useFillerPlayback.playPendingGreetingNow", {
            selectedVoice: voice,
          });
          playConfiguredGreeting();
        }
      });
  }, [playConfiguredGreeting]);

  useEffect(() => {
    if (!voiceName) return;
    preloadedVoiceRef.current = voiceName;
    preloadedAudioUrlRef.current = null;
    if (!audioUnlockedRef.current) {
      preloadedAudioRef.current = null;
    }
    loadFillerUrl(voiceName);
  }, [voiceName, loadFillerUrl]);

  // ── Warm-up / unlock: call this from a user gesture (Start tap) ──
  const warmUpAudio = useCallback(() => {
    if (audioUnlockedRef.current && preloadedAudioRef.current) {
      logFillerDebug("useFillerPlayback.warmUpSkipped", { alreadyUnlocked: true });
      return;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 0.85;
    audio.muted = true;
    audio.src = preloadedAudioUrlRef.current ?? SILENT_WARMUP_AUDIO_URL;
    audio.load();

    preloadedAudioRef.current = audio;
    audioUnlockedRef.current = true;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;

          if (!preloadedAudioUrlRef.current && preloadedVoiceRef.current) {
            loadFillerUrl(preloadedVoiceRef.current);
          }

          logFillerDebug("useFillerPlayback.warmUpUnlocked", {
            currentSrc: audio.currentSrc || audio.src,
            hadRealAudioUrl: Boolean(preloadedAudioUrlRef.current),
          });
        })
        .catch((err) => {
          audio.muted = false;
          logFillerDebug("useFillerPlayback.warmUpFailed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }

    logFillerDebug("useFillerPlayback.warmUpCreated", {
      hadRealAudioUrl: Boolean(preloadedAudioUrlRef.current),
    });
  }, [loadFillerUrl]);

  // ── Stop greeting playback ────────────────────────────────────────
  const stopFiller = useCallback((reason = "unknown") => {
    const audio = audioRef.current;

    logFillerDebug("useFillerPlayback.stopFiller", {
      reason,
      hasAudio: Boolean(audio),
      beforeAudible: !playStartedRef.current && (audio?.currentTime ?? 0) < 0.05,
      currentTime: audio?.currentTime ?? null,
      paused: audio?.paused ?? null,
      ended: audio?.ended ?? null,
      readyState: audio?.readyState ?? null,
      networkState: audio?.networkState ?? null,
      volume: audio?.volume ?? null,
      muted: audio?.muted ?? null,
    });

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }

    pendingPlayRef.current = false;
    playStartedRef.current = false;
  }, []);

  // ── Called by Demo when the user's first speech burst ends ────────
  const onFirstSpeechEnd = useCallback(() => {
    logFillerDebug("useFillerPlayback.onFirstSpeechEnd", {
      fillerEnabled: enabledRef.current,
      firstSpeechEnded: firstSpeechEndedRef.current,
      played: playedRef.current,
      hasAudioUrl: Boolean(preloadedAudioUrlRef.current),
    });

    if (firstSpeechEndedRef.current || playedRef.current) return;
    firstSpeechEndedRef.current = true;
    playConfiguredGreeting();
  }, [playConfiguredGreeting]);

  // ── Stop instantly when real AI audio starts ─────────────────────
  useEffect(() => {
    if (sessionIndicators.speaker.state === "playing") {
      logFillerDebug("useFillerPlayback.speakerPlaying", {
        detail: sessionIndicators.speaker.detail,
      });
      stopFiller("real_ai_playing");
    }
  }, [sessionIndicators.speaker.detail, sessionIndicators.speaker.state, stopFiller]);

  // ── Stop on disconnect and reset for next session ─────────────────
  // Reset for each new session (both on connect and disconnect)
  useEffect(() => {
    if (status === "disconnected" || status === "connecting") {
      stopFiller(status === "disconnected" ? "session_disconnected" : "session_starting");
      playedRef.current = false;
      firstSpeechEndedRef.current = false;
      playStartedRef.current = false;
      audioUnlockedRef.current = false;
      logFillerDebug("useFillerPlayback.sessionReset", {
        trigger: status,
        played: playedRef.current,
        firstSpeechEnded: firstSpeechEndedRef.current,
      });
    }
  }, [status, stopFiller]);

  // ── Stop if user disables ────────────────────────────────────────
  useEffect(() => {
    if (!enabled) stopFiller("filler_disabled");
  }, [enabled, stopFiller]);

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => stopFiller("unmount_cleanup");
  }, [stopFiller]);

  return { fillerEnabled: enabled, setFillerEnabled: setEnabled, stopFiller, onFirstSpeechEnd, warmUpAudio };
}

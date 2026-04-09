import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConnectionStatus, SessionIndicators } from "@/hooks/useGeminiAudio";

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

  useEffect(() => {
    if (!voiceName) return;
    if (preloadedVoiceRef.current === voiceName && preloadedAudioRef.current) {
      logFillerDebug("useFillerPlayback.preloadSkippedExisting", {
        selectedVoice: voiceName,
        phraseKeys: GREETING_KEYS,
        readyState: preloadedAudioRef.current.readyState,
        networkState: preloadedAudioRef.current.networkState,
      });
      return;
    }

    preloadedAudioRef.current = null;
    preloadedVoiceRef.current = voiceName;
    logFillerDebug("useFillerPlayback.preloadLookupStarted", {
      selectedVoice: voiceName,
      phraseKeys: GREETING_KEYS,
    });

    supabase
      .from("filler_audio")
      .select("audio_url, phrase_key, phrase_text, voice_name, status")
      .eq("voice_name", voiceName)
      .eq("status", "ready")
      .in("phrase_key", GREETING_KEYS)
      .not("audio_url", "is", null)
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          logFillerDebug("useFillerPlayback.preloadLookupError", {
            selectedVoice: voiceName,
            phraseKeys: GREETING_KEYS,
            error: error.message,
          });
          return;
        }

        const row = data?.[0];
        const url = row?.audio_url;
        logFillerDebug("useFillerPlayback.preloadLookupResult", {
          selectedVoice: voiceName,
          phraseKeys: GREETING_KEYS,
          rowCount: data?.length ?? 0,
          phraseKey: row?.phrase_key ?? null,
          phraseText: row?.phrase_text ?? null,
          voiceName: row?.voice_name ?? null,
          status: row?.status ?? null,
          audioUrl: url ?? null,
        });

        if (!url) return;

        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = 0.85;
        audio.muted = false;
        audio.addEventListener("loadedmetadata", () => {
          logFillerDebug("useFillerPlayback.preloadLoadedMetadata", {
            selectedVoice: voiceName,
            phraseKey: row?.phrase_key ?? null,
            duration: audio.duration,
            readyState: audio.readyState,
            networkState: audio.networkState,
          });
        });
        audio.addEventListener("loadeddata", () => {
          logFillerDebug("useFillerPlayback.preloadLoadedData", {
            selectedVoice: voiceName,
            phraseKey: row?.phrase_key ?? null,
            readyState: audio.readyState,
            networkState: audio.networkState,
          });
        });
        audio.addEventListener("canplaythrough", () => {
          logFillerDebug("useFillerPlayback.preloadCanPlayThrough", {
            selectedVoice: voiceName,
            phraseKey: row?.phrase_key ?? null,
            readyState: audio.readyState,
            networkState: audio.networkState,
          });
        });
        audio.addEventListener("error", () => {
          logFillerDebug("useFillerPlayback.preloadAudioError", {
            selectedVoice: voiceName,
            phraseKey: row?.phrase_key ?? null,
            readyState: audio.readyState,
            networkState: audio.networkState,
            currentSrc: audio.currentSrc || audio.src,
          });
        });

        logFillerDebug("useFillerPlayback.preloadAudioCreated", {
          selectedVoice: voiceName,
          phraseKey: row?.phrase_key ?? null,
          audioUrl: url,
          readyState: audio.readyState,
          networkState: audio.networkState,
          volume: audio.volume,
          muted: audio.muted,
        });

        if (preloadedVoiceRef.current === voiceName) {
          preloadedAudioRef.current = audio;
        }
      });
  }, [voiceName]);

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

    playStartedRef.current = false;
  }, []);

  // ── Play the preloaded greeting ───────────────────────────────────
  const playGreeting = useCallback(() => {
    logFillerDebug("useFillerPlayback.playGreetingAttempt", {
      fillerEnabled: enabledRef.current,
      firstTurnFlagFalse: !playedRef.current,
      played: playedRef.current,
      selectedVoice: preloadedVoiceRef.current,
      hasPreloadedAudio: Boolean(preloadedAudioRef.current),
    });

    if (!enabledRef.current || playedRef.current) return;
    const audio = preloadedAudioRef.current;
    if (!audio) return;

    playStartedRef.current = false;
    playedRef.current = true;
    logFillerDebug("useFillerPlayback.playedRefSet", {
      played: playedRef.current,
      selectedVoice: preloadedVoiceRef.current,
      readyState: audio.readyState,
      networkState: audio.networkState,
      volume: audio.volume,
      muted: audio.muted,
      paused: audio.paused,
      currentSrc: audio.currentSrc || audio.src,
    });

    audio.currentTime = 0;
    audio.onplaying = () => {
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

  // ── Called by Demo when the user's first speech burst ends ────────
  const firstSpeechEndedRef = useRef(false);

  const onFirstSpeechEnd = useCallback(() => {
    logFillerDebug("useFillerPlayback.onFirstSpeechEnd", {
      fillerEnabled: enabledRef.current,
      firstSpeechEnded: firstSpeechEndedRef.current,
      played: playedRef.current,
    });

    if (firstSpeechEndedRef.current || playedRef.current) return;
    firstSpeechEndedRef.current = true;
    playGreeting();
  }, [playGreeting]);

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

  return { fillerEnabled: enabled, setFillerEnabled: setEnabled, stopFiller, onFirstSpeechEnd };
}

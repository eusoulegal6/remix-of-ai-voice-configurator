import { useCallback, useEffect, useRef, useState } from "react";

const MIC_CAPTURE_WORKLET_URL = "/audio-worklets/mic-capture-processor.js";
const MOBILE_CAPTURE_FRAME_SIZE = 2048;
const DEFAULT_CAPTURE_FRAME_SIZE = 4096;
const WS_BUFFERED_AMOUNT_HIGH_WATER_MARK = 128 * 1024;
const WS_BUFFERED_AMOUNT_LOW_WATER_MARK = 32 * 1024;
const SPEECH_END_DEBOUNCE_MS = 350;

function resampleTo16kHz(float32Array: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return float32Array;

  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(float32Array.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, float32Array.length - 1);
    const frac = srcIndex - low;
    result[i] = float32Array[low] * (1 - frac) + float32Array[high] * frac;
  }

  return result;
}

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function isLikelyMobileDevice(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile) {
    return true;
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function getPreferredCaptureFrameSize(): number {
  return isLikelyMobileDevice() ? MOBILE_CAPTURE_FRAME_SIZE : DEFAULT_CAPTURE_FRAME_SIZE;
}

function getRequestedAudioConstraints(mediaDevices: MediaDevices): MediaTrackConstraints | true {
  const supported = mediaDevices.getSupportedConstraints();
  const constraints: MediaTrackConstraints = {};

  if (supported.echoCancellation) constraints.echoCancellation = true;
  if (supported.noiseSuppression) constraints.noiseSuppression = true;
  if (supported.autoGainControl) constraints.autoGainControl = true;
  if (supported.channelCount) constraints.channelCount = 1;

  return Object.keys(constraints).length > 0 ? constraints : true;
}

export type ConnectionStatus = "disconnected" | "connecting" | "listening";
export type PermissionState = "idle" | "requesting" | "granted" | "denied" | "unsupported";
export type SpeakerState = "idle" | "preparing" | "ready" | "playing" | "blocked";
export type ReconnectState = "idle" | "reconnecting" | "available";

interface StatusIndicator<TState extends string> {
  state: TState;
  detail: string;
}

export interface SessionIndicators {
  permission: StatusIndicator<PermissionState>;
  speaker: StatusIndicator<SpeakerState>;
  reconnect: StatusIndicator<ReconnectState>;
}

interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "error" | "audio";
}

interface UseGeminiAudioOptions {
  model: string;
  systemInstructions: string;
  voiceName: string;
  /** Optional callback fired once when the user starts speaking (non-silent mic frames detected). */
  onUserSpeech?: () => void;
  /** Optional callback fired when a speech burst ends (transition from non-silent to silent frames). */
  onUserSpeechEnd?: () => void;
}

type DisconnectIntent = "none" | "manual" | "lifecycle" | "cleanup" | "error";

const INITIAL_SESSION_INDICATORS: SessionIndicators = {
  permission: {
    state: "idle",
    detail: "Microphone access has not been requested yet.",
  },
  speaker: {
    state: "idle",
    detail: "Speaker output will be prepared when a session starts.",
  },
  reconnect: {
    state: "idle",
    detail: "No reconnect action is needed.",
  },
};

export function useGeminiAudio({ model, systemInstructions, voiceName, onUserSpeech, onUserSpeechEnd }: UseGeminiAudioOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionIndicators, setSessionIndicators] = useState<SessionIndicators>(INITIAL_SESSION_INDICATORS);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const activePlaybackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlayTimeRef = useRef(0);
  const connectTimeoutRef = useRef<number | null>(null);
  const streamReadyTimeoutRef = useRef<number | null>(null);
  const isReadyToStreamRef = useRef(false);
  const lifecycleStopRequestedRef = useRef(false);
  const statusRef = useRef<ConnectionStatus>("disconnected");
  const disconnectIntentRef = useRef<DisconnectIntent>("none");
  const isBackpressuredRef = useRef(false);
  const droppedChunksRef = useRef(0);
  const onUserSpeechRef = useRef(onUserSpeech);
  const onUserSpeechEndRef = useRef(onUserSpeechEnd);
  const userIsSpeakingRef = useRef(false);
  const speechEndTimerRef = useRef<number | null>(null);

  // Keep the callback refs in sync without causing re-renders
  useEffect(() => { onUserSpeechRef.current = onUserSpeech; }, [onUserSpeech]);
  useEffect(() => { onUserSpeechEndRef.current = onUserSpeechEnd; }, [onUserSpeechEnd]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { timestamp: new Date(), message, type }]);
  }, []);

  const setPermissionIndicator = useCallback((state: PermissionState, detail: string) => {
    setSessionIndicators((prev) => ({
      ...prev,
      permission: { state, detail },
    }));
  }, []);

  const setSpeakerIndicator = useCallback((state: SpeakerState, detail: string) => {
    setSessionIndicators((prev) => ({
      ...prev,
      speaker: { state, detail },
    }));
  }, []);

  const setReconnectIndicator = useCallback((state: ReconnectState, detail: string) => {
    setSessionIndicators((prev) => ({
      ...prev,
      reconnect: { state, detail },
    }));
  }, []);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const clearStreamReadyTimeout = useCallback(() => {
    if (streamReadyTimeoutRef.current !== null) {
      window.clearTimeout(streamReadyTimeoutRef.current);
      streamReadyTimeoutRef.current = null;
    }
  }, []);

  const interruptPlayback = useCallback(() => {
    for (const source of activePlaybackSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Ignore nodes that already ended.
      }
    }

    activePlaybackSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;

    if (statusRef.current === "listening") {
      setSpeakerIndicator("ready", "Speaker output is ready for the next response.");
    }
  }, [setSpeakerIndicator]);

  const bindPlaybackContextState = useCallback((context: AudioContext) => {
    context.onstatechange = () => {
      if (playbackCtxRef.current !== context) return;

      if (context.state === "running") {
        if (activePlaybackSourcesRef.current.size > 0) {
          setSpeakerIndicator("playing", "Playing the latest AI response.");
        } else if (statusRef.current === "disconnected") {
          setSpeakerIndicator("idle", "Speaker output is idle until the next session starts.");
        } else {
          setSpeakerIndicator("ready", "Speaker output is ready for AI responses.");
        }
        return;
      }

      if (context.state === "suspended" && statusRef.current !== "disconnected") {
        setSpeakerIndicator("blocked", "Speaker output was interrupted by the device or browser. Reconnect or restart audio.");
        return;
      }

      if (context.state === "closed") {
        setSpeakerIndicator("idle", "Speaker output is idle until the next session starts.");
      }
    };
  }, [setSpeakerIndicator]);

  const ensurePlaybackContext = useCallback(async () => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      bindPlaybackContextState(playbackCtxRef.current);
    }

    if (playbackCtxRef.current.state === "suspended") {
      await playbackCtxRef.current.resume();
    }

    return playbackCtxRef.current;
  }, [bindPlaybackContextState]);

  const playAudioChunk = useCallback((base64Data: string) => {
    try {
      const context = playbackCtxRef.current;
      if (!context) {
        setSpeakerIndicator("blocked", "Speaker output is not ready yet. Restart the session from a direct tap.");
        return;
      }

      if (context.state !== "running") {
        setSpeakerIndicator("blocked", "Speaker output is paused by the device or browser. Reconnect to continue.");
        return;
      }

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);

      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = context.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      activePlaybackSourcesRef.current.add(source);
      setSpeakerIndicator("playing", "Playing the latest AI response.");

      source.onended = () => {
        activePlaybackSourcesRef.current.delete(source);

        if (activePlaybackSourcesRef.current.size === 0) {
          if (statusRef.current === "listening") {
            setSpeakerIndicator("ready", "Speaker output is ready for the next response.");
          } else {
            setSpeakerIndicator("idle", "Speaker output is idle until the next session starts.");
          }
        }
      };

      const startTime = Math.max(context.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (error) {
      setSpeakerIndicator("blocked", "Audio playback failed. Check device audio routing and reconnect.");
      console.error("Audio playback error:", error);
    }
  }, [setSpeakerIndicator]);

  const teardownSessionResources = useCallback(async () => {
    clearConnectTimeout();
    clearStreamReadyTimeout();
    isReadyToStreamRef.current = false;
    isBackpressuredRef.current = false;
    droppedChunksRef.current = 0;
    userIsSpeakingRef.current = false;
    if (speechEndTimerRef.current !== null) {
      window.clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
    interruptPlayback();

    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
      processorRef.current.disconnect();
    }

    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      wsRef.current.close();
    }

    const inputContext = audioContextRef.current;
    if (inputContext) {
      await inputContext.close().catch(() => undefined);
    }

    const playbackContext = playbackCtxRef.current;
    if (playbackContext) {
      playbackContext.onstatechange = null;
      await playbackContext.close().catch(() => undefined);
    }

    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    playbackCtxRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
  }, [clearConnectTimeout, clearStreamReadyTimeout, interruptPlayback]);

  const stopSession = useCallback(async (
    intent: DisconnectIntent,
    options?: {
      logMessage?: string;
      reconnectDetail?: string;
      speakerDetail?: string;
    },
  ) => {
    disconnectIntentRef.current = intent;
    await teardownSessionResources();
    setStatus("disconnected");

    if (options?.speakerDetail) {
      setSpeakerIndicator("idle", options.speakerDetail);
    } else if (intent !== "error") {
      setSpeakerIndicator("idle", "Speaker output is idle until the next session starts.");
    }

    if (intent === "manual") {
      setReconnectIndicator("idle", "Session stopped manually.");
    } else if (intent === "lifecycle") {
      setReconnectIndicator("available", options?.reconnectDetail ?? "Session paused when the app moved to the background.");
    } else if (intent === "error") {
      setReconnectIndicator("available", options?.reconnectDetail ?? "Connection dropped. Reconnect to continue.");
    }

    if (options?.logMessage) {
      addLog(options.logMessage);
    }
  }, [addLog, setReconnectIndicator, setSpeakerIndicator, teardownSessionResources]);

  const startAudioCapture = useCallback(async (
    audioContext: AudioContext,
    stream: MediaStream,
    ws: WebSocket,
    frameSize: number,
  ) => {
    if (!("audioWorklet" in audioContext)) {
      throw new Error("AudioWorklet is not available in this browser.");
    }

    await audioContext.audioWorklet.addModule(MIC_CAPTURE_WORKLET_URL);

    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;

    const processor = new AudioWorkletNode(audioContext, "pcm-capture-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      processorOptions: { frameSize },
    });
    processorRef.current = processor;

    processor.port.onmessage = (event) => {
      if (ws.readyState !== WebSocket.OPEN || !isReadyToStreamRef.current) return;

      const rawFloat32 =
        event.data instanceof Float32Array
          ? event.data
          : event.data instanceof ArrayBuffer
            ? new Float32Array(event.data)
            : null;

      if (!rawFloat32) return;

      let isSilent = true;
      for (let i = 0; i < rawFloat32.length; i++) {
        if (rawFloat32[i] !== 0) {
          isSilent = false;
          break;
        }
      }
      if (isSilent) {
        // Start a debounce timer — only fire onUserSpeechEnd after sustained silence
        if (userIsSpeakingRef.current && speechEndTimerRef.current === null) {
          console.debug("[FillerDebug]", {
            atMs: performance.now(),
            phase: "useGeminiAudio.speechEndDebounceStarted",
            thresholdMs: SPEECH_END_DEBOUNCE_MS,
          });
          speechEndTimerRef.current = window.setTimeout(() => {
            speechEndTimerRef.current = null;
            if (userIsSpeakingRef.current) {
              userIsSpeakingRef.current = false;
              console.debug("[FillerDebug]", {
                atMs: performance.now(),
                phase: "useGeminiAudio.onUserSpeechEnd",
              });
              onUserSpeechEndRef.current?.();
            }
          }, SPEECH_END_DEBOUNCE_MS);
        }
        return;
      }

      // Non-silent frame: cancel any pending speech-end timer
      if (speechEndTimerRef.current !== null) {
        window.clearTimeout(speechEndTimerRef.current);
        speechEndTimerRef.current = null;
        console.debug("[FillerDebug]", {
          atMs: performance.now(),
          phase: "useGeminiAudio.speechEndDebounceCancelled",
        });
      }

      // Fire onUserSpeech once per speech burst (non-silent → first frame only)
      if (!userIsSpeakingRef.current) {
        userIsSpeakingRef.current = true;
        console.debug("[FillerDebug]", {
          atMs: performance.now(),
          phase: "useGeminiAudio.onUserSpeech",
        });
        onUserSpeechRef.current?.();
      }

      const resampled = resampleTo16kHz(rawFloat32, audioContext.sampleRate);
      const base64Data = arrayBufferToBase64(floatTo16BitPCM(resampled));

      if (!base64Data) return;

      if (ws.bufferedAmount > WS_BUFFERED_AMOUNT_HIGH_WATER_MARK) {
        droppedChunksRef.current += 1;

        if (!isBackpressuredRef.current) {
          isBackpressuredRef.current = true;
          addLog("Network congestion detected, dropping mic frames", "error");
          setReconnectIndicator("available", "Connection is congested. Wait for recovery or reconnect if audio stalls.");
        }

        return;
      }

      ws.send(JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Data,
          },
        },
      }));

      if (isBackpressuredRef.current && ws.bufferedAmount <= WS_BUFFERED_AMOUNT_LOW_WATER_MARK) {
        isBackpressuredRef.current = false;
        addLog(`Mic streaming recovered after dropping ${droppedChunksRef.current} chunk(s)`);
        droppedChunksRef.current = 0;
        setReconnectIndicator("idle", "Live session connected.");
      }
    };

    source.connect(processor);
  }, [addLog, setReconnectIndicator]);

  const start = useCallback(async () => {
    if (statusRef.current !== "disconnected") return;

    const isReconnectAttempt = sessionIndicators.reconnect.state === "available";

    lifecycleStopRequestedRef.current = false;
    disconnectIntentRef.current = "none";
    setStatus("connecting");
    setLogs([]);
    setPermissionIndicator("requesting", "Waiting for microphone access.");
    setSpeakerIndicator("preparing", "Preparing speaker output for the live session.");
    setReconnectIndicator(
      isReconnectAttempt ? "reconnecting" : "idle",
      isReconnectAttempt ? "Trying to restore the live connection." : "Connection setup is in progress.",
    );
    addLog("Requesting microphone access...");

    try {
      if (!navigator.onLine) {
        setReconnectIndicator("available", "Device is offline. Reconnect after network access returns.");
        throw new Error("Device is offline.");
      }

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        let message = "Microphone access is not available in this browser context.";

        if (!window.isSecureContext) {
          message = "Microphone access requires HTTPS or localhost.";
        } else if (window.self !== window.top) {
          message = "Microphone access is blocked in this embedded preview. Open the app in a new tab or published URL.";
        }

        setPermissionIndicator("unsupported", message);
        setSpeakerIndicator("idle", "Speaker setup did not start because the session could not begin.");
        throw new Error(message);
      }

      // Build the WebSocket URL early so we can start connecting in parallel
      const configuredProxyUrl = import.meta.env.VITE_GEMINI_WS_URL || "";
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const targetUrl = configuredProxyUrl || `${baseUrl}/functions/v1/gemini-ws`;
      if (!targetUrl) throw new Error("Backend URL is missing");

      const wsUrl = targetUrl
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://");

      // Kick off the WebSocket connection immediately so it connects during mic/audio setup
      addLog(`Connecting to proxy: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let inputContext: AudioContext | null = null;
      let stream: MediaStream | null = null;
      let captureFrameSize = getPreferredCaptureFrameSize();
      let setupCompleteReceived = false;
      let audioCaptureStarted = false;

      const beginStreamingIfReady = async () => {
        if (audioCaptureStarted || !setupCompleteReceived || !inputContext || !stream) return;

        audioCaptureStarted = true;
        await startAudioCapture(inputContext, stream, ws, captureFrameSize);
        setStatus("listening");
        setReconnectIndicator("idle", "Live session connected.");
        isReadyToStreamRef.current = false;
        addLog("[Mic] Stabilizing hardware for 500ms...");
        clearStreamReadyTimeout();
        streamReadyTimeoutRef.current = window.setTimeout(() => {
          isReadyToStreamRef.current = true;
          addLog("[Mic] Ready to stream audio");
        }, 500);
      };

      ws.onmessage = async (event) => {
        let textData: string;

        if (event.data instanceof Blob) {
          textData = await event.data.text();
        } else if (typeof event.data === "string") {
          textData = event.data;
        } else {
          addLog(`[WS <-] Unknown data type: ${typeof event.data}`, "error");
          return;
        }

        try {
          const data = JSON.parse(textData);
          addLog(`[WS <-] keys: ${Object.keys(data).join(", ")}`);

          if (data.type === "proxy_error") {
            setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
            setReconnectIndicator("available", data.message || "Proxy connection failed. Try reconnecting.");
            addLog(`[Proxy Error] ${data.message} (code: ${data.code})`, "error");
            return;
          }

          if (data.type === "proxy_ready") {
            addLog("Proxy ready, sending setup...");
            ws.send(JSON.stringify({
              setup: {
                model: `models/${model}`,
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName,
                      },
                    },
                  },
                },
                realtimeInputConfig: {
                  activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
                  automaticActivityDetection: {
                    disabled: false,
                    startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
                    endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
                    prefixPaddingMs: 20,
                    silenceDurationMs: 100,
                  },
                },
                ...(systemInstructions.trim()
                  ? {
                      systemInstruction: {
                        parts: [{ text: systemInstructions }],
                      },
                    }
                  : {}),
              },
            }));
            return;
          }

          if (data.type === "error") {
            setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
            setReconnectIndicator("available", data.message || "The proxy reported an error. Try reconnecting.");
            addLog(`[Proxy] Error: ${data.message}`, "error");
            return;
          }

          if (data.type === "gemini_closed") {
            setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
            setReconnectIndicator("available", "Gemini closed the live session. Reconnect to continue.");
            addLog(`[Gemini] Closed: code=${data.code} reason=${data.reason || "none"}`, "error");
            return;
          }

          if (data.setupComplete) {
            addLog("[Gemini] Setup complete received");
            setupCompleteReceived = true;
            await beginStreamingIfReady();
            return;
          }

          if (data.error) {
            addLog(`[Gemini Error] ${JSON.stringify(data.error)}`, "error");
            return;
          }

          if (data?.serverContent?.interrupted) {
            interruptPlayback();
            addLog("Playback interrupted by user speech");
            return;
          }

          const inlineData = data?.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          if (inlineData?.data) {
            playAudioChunk(inlineData.data);
            addLog("Received audio response", "audio");
          }

          if (data?.serverContent?.turnComplete) {
            setSpeakerIndicator("ready", "Speaker output is ready for the next response.");
            addLog("Agent turn complete");
          }
        } catch {
          addLog(`[WS <-] ${textData.slice(0, 120)}`);
        }
      };

      // Promise that resolves when WS is open, or rejects on error/timeout
      const wsOpenPromise = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error("Connection timed out"));
          ws.close(4000, "Connection timed out");
        }, 5000);

        ws.addEventListener("open", () => {
          window.clearTimeout(timeout);
          addLog("WebSocket connected, waiting for proxy...");
          resolve();
        }, { once: true });

        ws.addEventListener("error", () => {
          window.clearTimeout(timeout);
          reject(new Error("WebSocket connection failed"));
        }, { once: true });
      });

      // Run mic access, playback setup, and WebSocket open in parallel
      stream = await mediaDevices.getUserMedia({
        audio: getRequestedAudioConstraints(mediaDevices),
      });
      streamRef.current = stream;
      setPermissionIndicator("granted", "Microphone access granted.");
      addLog("Microphone access granted");

      const playbackContext = await ensurePlaybackContext();
      if (playbackContext.state !== "running") {
        setSpeakerIndicator("blocked", "Speaker output is still suspended. Start again from a direct tap or disable silent mode.");
        throw new Error("Speaker output is still blocked after setup.");
      }
      setSpeakerIndicator("ready", "Speaker output is ready for AI responses.");
      addLog("Playback context ready");

      inputContext = new AudioContext();
      if (inputContext.state === "suspended") {
        await inputContext.resume();
      }
      audioContextRef.current = inputContext;
      addLog(`AudioContext running at ${inputContext.sampleRate}Hz`);

      captureFrameSize = getPreferredCaptureFrameSize();
      addLog(`Capture frame size: ${captureFrameSize}`);

      // Now wait for the WS to be open (likely already is by now)
      await wsOpenPromise;
      await beginStreamingIfReady();

      ws.onerror = (event) => {
        clearConnectTimeout();
        const targetState = event.target instanceof WebSocket ? event.target.readyState : "unknown";
        addLog(`WebSocket error (readyState: ${targetState})`, "error");
        setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
        if (disconnectIntentRef.current === "none") {
          setReconnectIndicator("available", "The connection hit a network error. Try reconnecting.");
        }
        setStatus("disconnected");
      };

      ws.onclose = (event) => {
        clearConnectTimeout();
        wsRef.current = null;
        addLog(
          `WebSocket closed (code: ${event.code}, reason: ${event.reason || "none"}, clean: ${event.wasClean})`,
          event.code === 1000 ? "info" : "error",
        );
        setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
        if (disconnectIntentRef.current === "none") {
          setReconnectIndicator(
            "available",
            event.reason
              ? `Connection closed: ${event.reason}. Reconnect to continue.`
              : "Connection closed unexpectedly. Reconnect to continue.",
          );
        }
        setStatus("disconnected");
      };
    } catch (error) {
      const message = getErrorMessage(error);

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "SecurityError") {
          setPermissionIndicator("denied", "Microphone access was denied. Allow it in browser settings to continue.");
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
          setPermissionIndicator("unsupported", "No microphone was found on this device.");
        }
      }

      if (message.toLowerCase().includes("speaker")) {
        setSpeakerIndicator("blocked", "Speaker output could not be started. Check silent mode or reconnect from a direct tap.");
      }

      disconnectIntentRef.current = "error";
      await teardownSessionResources();
      if (message === "Device is offline.") {
        setReconnectIndicator("available", "Device is offline. Reconnect after network access returns.");
      } else {
        setReconnectIndicator("idle", "Resolve the device issue before reconnecting.");
      }
      addLog(`Error: ${message}`, "error");
      setStatus("disconnected");
    }
  }, [
    sessionIndicators.reconnect.state,
    model,
    systemInstructions,
    voiceName,
    addLog,
    clearConnectTimeout,
    clearStreamReadyTimeout,
    ensurePlaybackContext,
    interruptPlayback,
    playAudioChunk,
    setPermissionIndicator,
    setReconnectIndicator,
    setSpeakerIndicator,
    startAudioCapture,
    teardownSessionResources,
  ]);

  const stop = useCallback(() => {
    void stopSession("manual", {
      logMessage: "Conversation ended",
      speakerDetail: "Speaker output is idle until the next session starts.",
    });
  }, [stopSession]);

  const retry = useCallback(() => {
    if (statusRef.current !== "disconnected") return;
    void start();
  }, [start]);

  useEffect(() => {
    statusRef.current = status;

    if (status === "disconnected") {
      lifecycleStopRequestedRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    const handleOffline = () => {
      if (statusRef.current !== "disconnected") {
        void stopSession("error", {
          logMessage: "Network connection lost",
          reconnectDetail: "Device is offline. Reconnect after network access returns.",
          speakerDetail: "Speaker output is idle while the device is offline.",
        });
      } else {
        setReconnectIndicator("available", "Device is offline. Reconnect after network access returns.");
      }
    };

    const handleOnline = () => {
      addLog("Network connection restored");

      if (statusRef.current === "disconnected") {
        setReconnectIndicator("available", "Network restored. Reconnect when you are ready.");
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [addLog, setReconnectIndicator, stopSession]);

  useEffect(() => {
    const endSessionForLifecycle = (message: string) => {
      if (statusRef.current === "disconnected" || lifecycleStopRequestedRef.current) {
        return;
      }

      lifecycleStopRequestedRef.current = true;
      void stopSession("lifecycle", {
        logMessage: message,
        reconnectDetail: "Session ended when the app moved to the background. Reconnect when you return.",
        speakerDetail: "Speaker output is idle while the app is in the background.",
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        endSessionForLifecycle("App moved to background, ending session");
      }
    };

    const handlePageHide = () => {
      endSessionForLifecycle("Page is unloading, ending session");
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && statusRef.current === "disconnected") {
        setReconnectIndicator("available", "App resumed from the background. Reconnect when you are ready.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);

      if (statusRef.current !== "disconnected") {
        lifecycleStopRequestedRef.current = true;
        void stopSession("cleanup", {
          speakerDetail: "Speaker output is idle until the next session starts.",
        });
      }
    };
  }, [setReconnectIndicator, stopSession]);

  return { status, logs, sessionIndicators, start, stop, retry };
}

import { useState, useRef, useCallback, useEffect } from "react";

const MIC_CAPTURE_WORKLET_URL = "/audio-worklets/mic-capture-processor.js";
const MOBILE_CAPTURE_FRAME_SIZE = 2048;
const DEFAULT_CAPTURE_FRAME_SIZE = 4096;
const WS_BUFFERED_AMOUNT_HIGH_WATER_MARK = 128 * 1024;
const WS_BUFFERED_AMOUNT_LOW_WATER_MARK = 32 * 1024;

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
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function isLikelyMobileDevice(): boolean {
  const userAgentData = navigator.userAgentData;
  if (userAgentData?.mobile) {
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

  if (supported.echoCancellation) {
    constraints.echoCancellation = true;
  }

  if (supported.noiseSuppression) {
    constraints.noiseSuppression = true;
  }

  if (supported.autoGainControl) {
    constraints.autoGainControl = true;
  }

  if (supported.channelCount) {
    constraints.channelCount = 1;
  }

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

export function useGeminiAudio({ model, systemInstructions, voiceName }: UseGeminiAudioOptions) {
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
  const nextPlayTimeRef = useRef<number>(0);
  const connectTimeoutRef = useRef<number | null>(null);
  const streamReadyTimeoutRef = useRef<number | null>(null);
  const isReadyToStreamRef = useRef(false);
  const lifecycleStopRequestedRef = useRef(false);
  const statusRef = useRef<ConnectionStatus>("disconnected");
  const disconnectIntentRef = useRef<DisconnectIntent>("none");
  const isBackpressuredRef = useRef(false);
  const droppedChunksRef = useRef(0);

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
        // Ignore nodes that have already finished.
      }
    }

    activePlaybackSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
  }, []);

  const ensurePlaybackContext = useCallback(async () => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }

    if (playbackCtxRef.current.state === "suspended") {
      await playbackCtxRef.current.resume();
    }

    return playbackCtxRef.current;
  }, []);

  const playAudioChunk = useCallback((base64Data: string) => {
    try {
      const ctx = playbackCtxRef.current;
      if (!ctx) {
        setSpeakerIndicator("blocked", "Speaker output is not ready. Restart the session from a direct tap.");
        console.warn("Playback context is not ready yet.");
        return;
      }

      if (ctx.state !== "running") {
        setSpeakerIndicator("blocked", "Speaker output is paused by the browser or device. Restart audio to continue.");
        return;
      }

      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);

      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);

      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      activePlaybackSourcesRef.current.add(source);
      source.onended = () => {
        activePlaybackSourcesRef.current.delete(source);
      };

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (err) {
      setSpeakerIndicator("blocked", "Audio playback failed. Check device audio routing and restart the session.");
      console.error("Audio playback error:", err);
    }
  }, [setSpeakerIndicator]);

  const teardownSessionResources = useCallback(() => {
    clearConnectTimeout();
    clearStreamReadyTimeout();
    isReadyToStreamRef.current = false;
    isBackpressuredRef.current = false;
    droppedChunksRef.current = 0;
    interruptPlayback();

    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
      processorRef.current.disconnect();
    }

    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    playbackCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      wsRef.current.close();
    }

    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    playbackCtxRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
  }, [clearConnectTimeout, clearStreamReadyTimeout, interruptPlayback]);

  const stopSession = useCallback((
    intent: DisconnectIntent,
    options?: {
      logMessage?: string;
      reconnectDetail?: string;
      speakerDetail?: string;
    },
  ) => {
    disconnectIntentRef.current = intent;
    teardownSessionResources();
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
    audioCtx: AudioContext,
    stream: MediaStream,
    ws: WebSocket,
    frameSize: number,
  ) => {
    if (!("audioWorklet" in audioCtx)) {
      throw new Error("AudioWorklet is not available in this browser.");
    }

    await audioCtx.audioWorklet.addModule(MIC_CAPTURE_WORKLET_URL);

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const processor = new AudioWorkletNode(audioCtx, "pcm-capture-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      processorOptions: {
        frameSize,
      },
    });
    processorRef.current = processor;

    processor.port.onmessage = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!isReadyToStreamRef.current) return;

      const rawFloat32 = event.data instanceof Float32Array
        ? event.data
        : event.data instanceof ArrayBuffer
          ? new Float32Array(event.data)
          : null;
      if (!rawFloat32) return;

      let isSilent = true;
      for (let i = 0; i < rawFloat32.length; i++) {
        if (rawFloat32[i] !== 0) { isSilent = false; break; }
      }
      if (isSilent) return;

      const resampled = resampleTo16kHz(rawFloat32, audioCtx.sampleRate);
      const pcmBuffer = floatTo16BitPCM(resampled);
      const base64Data = arrayBufferToBase64(pcmBuffer);

      if (base64Data) {
        const payload = {
          realtimeInput: {
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: base64Data,
            },
          },
        };
        if (ws.readyState === WebSocket.OPEN) {
          if (ws.bufferedAmount > WS_BUFFERED_AMOUNT_HIGH_WATER_MARK) {
            droppedChunksRef.current += 1;

            if (!isBackpressuredRef.current) {
              isBackpressuredRef.current = true;
              addLog("Network congestion detected, dropping mic frames", "error");
            }

            return;
          }

          ws.send(JSON.stringify(payload));

          if (isBackpressuredRef.current && ws.bufferedAmount <= WS_BUFFERED_AMOUNT_LOW_WATER_MARK) {
            isBackpressuredRef.current = false;
            addLog(`Mic streaming recovered after dropping ${droppedChunksRef.current} chunk(s)`);
            droppedChunksRef.current = 0;
          }
        }
      }
    };

    source.connect(processor);
  }, [addLog]);

  const start = useCallback(async () => {
    if (status !== "disconnected") return;

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
    addLog("Requesting microphone access…");

    try {
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

      const stream = await mediaDevices.getUserMedia({
        audio: getRequestedAudioConstraints(mediaDevices),
      });
      streamRef.current = stream;
      setPermissionIndicator("granted", "Microphone access granted.");
      addLog("Microphone access granted");

      const audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      audioContextRef.current = audioCtx;
      addLog(`AudioContext running at ${audioCtx.sampleRate}Hz`);

      await ensurePlaybackContext();
      if (playbackCtxRef.current?.state !== "running") {
        setSpeakerIndicator("blocked", "Speaker output is still suspended. Start again from a direct tap or disable silent mode.");
        throw new Error("Speaker output is still blocked after setup.");
      }

      setSpeakerIndicator("ready", "Speaker output is ready for AI responses.");
      addLog("Playback context ready");

      const captureFrameSize = getPreferredCaptureFrameSize();
      addLog(`Capture frame size: ${captureFrameSize}`);

      const configuredProxyUrl = import.meta.env.VITE_GEMINI_WS_URL || "";
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const targetUrl = configuredProxyUrl || `${baseUrl}/functions/v1/gemini-ws`;
      if (!targetUrl) throw new Error("Backend URL is missing");

      const wsUrl = targetUrl
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://");

      addLog(`Connecting to proxy: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      connectTimeoutRef.current = window.setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          addLog("Connection Timed Out", "error");
          setReconnectIndicator("available", "Connection timed out. Try reconnecting.");
          ws.close(4000, "Connection timed out");
          setStatus("disconnected");
        }
      }, 5000);

      ws.onopen = () => {
        clearConnectTimeout();
        addLog("WebSocket connected, waiting for proxy…");
      };

      ws.onmessage = async (event) => {
        let textData: string;

        if (event.data instanceof Blob) {
          textData = await event.data.text();
        } else if (typeof event.data === "string") {
          textData = event.data;
        } else {
          addLog(`[WS ←] Unknown data type: ${typeof event.data}`, "error");
          return;
        }

        try {
          const data = JSON.parse(textData);
          const parsedKeys = Object.keys(data).join(", ");
          addLog(`[WS ←] keys: ${parsedKeys}`);

          if (data.type === "proxy_error") {
            addLog(`[Proxy Error] ${data.message} (code: ${data.code})`, "error");
            setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
            setReconnectIndicator("available", data.message || "Proxy connection failed. Try reconnecting.");
            return;
          }

          if (data.type === "proxy_ready") {
            addLog("Proxy ready, sending setup…");
            const setupMsg = {
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
            };
            const stringified = JSON.stringify(setupMsg);
            addLog(`[WS →] ${stringified}`);
            ws.send(stringified);
            return;
          }

          if (data.type === "error") {
            addLog(`[Proxy] Error: ${data.message}`, "error");
            setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
            setReconnectIndicator("available", data.message || "The proxy reported an error. Try reconnecting.");
            return;
          }

          if (data.type === "gemini_closed") {
            addLog(`[Gemini] Closed: code=${data.code} reason=${data.reason || "none"}`, "error");
            setSpeakerIndicator("idle", "Speaker output is idle until the connection is restored.");
            setReconnectIndicator("available", "Gemini closed the live session. Reconnect to continue.");
            return;
          }

          if (data.setupComplete) {
            addLog("[Gemini] Setup Complete received");
            try {
              await startAudioCapture(audioCtx, stream, ws, captureFrameSize);
            } catch (err) {
              addLog(`Error: ${getErrorMessage(err)}`, "error");
              ws.close(1011, "Audio capture setup failed");
              return;
            }

            setStatus("listening");
            setReconnectIndicator("idle", "Live session connected.");
            isReadyToStreamRef.current = false;
            addLog("[Mic] Stabilizing hardware for 500ms…");
            clearStreamReadyTimeout();
            streamReadyTimeoutRef.current = window.setTimeout(() => {
              isReadyToStreamRef.current = true;
              addLog("[Mic] Ready to stream audio");
            }, 500);
            return;
          }

          if (data.error) {
            addLog(`[Gemini Error] ${JSON.stringify(data.error)}`, "error");
            return;
          }

          if (data?.serverContent?.interrupted) {
            interruptPlayback();
            setSpeakerIndicator("ready", "Speaker output is ready for the next response.");
            addLog("Playback interrupted by user speech");
            return;
          }

          const inlineData = data?.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          if (inlineData?.data) {
            setSpeakerIndicator("playing", "Playing the latest AI response.");
            playAudioChunk(inlineData.data);
            addLog("Received audio response", "audio");
          }

          if (data?.serverContent?.turnComplete) {
            setSpeakerIndicator("ready", "Speaker output is ready for the next response.");
            addLog("Agent turn complete");
          }
        } catch {
          addLog(`[WS ←] ${textData.slice(0, 120)}`);
        }
      };

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
    } catch (err) {
      const message = getErrorMessage(err);

      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "SecurityError") {
          setPermissionIndicator("denied", "Microphone access was denied. Allow it in browser settings to continue.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setPermissionIndicator("unsupported", "No microphone was found on this device.");
        }
      }

      if (message.toLowerCase().includes("speaker")) {
        setSpeakerIndicator("blocked", "Speaker output could not be started. Check silent mode or restart from a direct tap.");
      }

      disconnectIntentRef.current = "error";
      teardownSessionResources();
      setReconnectIndicator("idle", "Resolve the device issue before reconnecting.");
      addLog(`Error: ${message}`, "error");
      setStatus("disconnected");
    }
  }, [
    sessionIndicators.reconnect.state,
    status,
    model,
    systemInstructions,
    voiceName,
    addLog,
    interruptPlayback,
    playAudioChunk,
    clearConnectTimeout,
    clearStreamReadyTimeout,
    ensurePlaybackContext,
    setPermissionIndicator,
    setSpeakerIndicator,
    setReconnectIndicator,
    startAudioCapture,
    teardownSessionResources,
  ]);

  const stop = useCallback(() => {
    stopSession("manual", {
      logMessage: "Conversation ended",
      speakerDetail: "Speaker output is idle until the next session starts.",
    });
  }, [stopSession]);

  const retry = useCallback(() => {
    if (status !== "disconnected") return;
    void start();
  }, [start, status]);

  useEffect(() => {
    statusRef.current = status;

    if (status === "disconnected") {
      lifecycleStopRequestedRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    const endSessionForLifecycle = (message: string) => {
      if (statusRef.current === "disconnected" || lifecycleStopRequestedRef.current) {
        return;
      }

      lifecycleStopRequestedRef.current = true;
      stopSession("lifecycle", {
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

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);

      if (statusRef.current !== "disconnected") {
        lifecycleStopRequestedRef.current = true;
        stopSession("cleanup", {
          speakerDetail: "Speaker output is idle until the next session starts.",
        });
      }
    };
  }, [stopSession]);

  return { status, logs, sessionIndicators, start, stop, retry };
}

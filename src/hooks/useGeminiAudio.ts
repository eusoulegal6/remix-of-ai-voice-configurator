import { useState, useRef, useCallback } from "react";

const MIC_CAPTURE_WORKLET_URL = "/audio-worklets/mic-capture-processor.js";

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
    let s = Math.max(-1, Math.min(1, float32Array[i]));
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

export type ConnectionStatus = "disconnected" | "connecting" | "listening";

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

export function useGeminiAudio({ model, systemInstructions, voiceName }: UseGeminiAudioOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { timestamp: new Date(), message, type }]);
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

  const playAudioChunk = useCallback((base64Data: string) => {
    try {
      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const ctx = playbackCtxRef.current;
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
      console.error("Audio playback error:", err);
    }
  }, []);

  const startAudioCapture = useCallback(async (audioCtx: AudioContext, stream: MediaStream, ws: WebSocket) => {
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
        frameSize: 4096,
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
          ws.send(JSON.stringify(payload));
        }
      }
    };

    source.connect(processor);
  }, []);

  const start = useCallback(async () => {
    if (status !== "disconnected") return;

    setStatus("connecting");
    setLogs([]);
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

        throw new Error(message);
      }

      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      addLog("Microphone access granted");

      const audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      audioContextRef.current = audioCtx;
      addLog(`AudioContext running at ${audioCtx.sampleRate}Hz`);

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
            return;
          }

          if (data.type === "gemini_closed") {
            addLog(`[Gemini] Closed: code=${data.code} reason=${data.reason || "none"}`, "error");
            return;
          }

          if (data.setupComplete) {
            addLog("[Gemini] Setup Complete received");
            try {
              await startAudioCapture(audioCtx, stream, ws);
            } catch (err: any) {
              addLog(`Error: ${err.message}`, "error");
              ws.close(1011, "Audio capture setup failed");
              return;
            }

            setStatus("listening");
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
            addLog("Playback interrupted by user speech");
            return;
          }

          const inlineData = data?.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          if (inlineData?.data) {
            playAudioChunk(inlineData.data);
            addLog("Received audio response", "audio");
          }

          if (data?.serverContent?.turnComplete) {
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
        setStatus("disconnected");
      };

      ws.onclose = (event) => {
        clearConnectTimeout();
        wsRef.current = null;
        addLog(
          `WebSocket closed (code: ${event.code}, reason: ${event.reason || "none"}, clean: ${event.wasClean})`,
          event.code === 1000 ? "info" : "error",
        );
        setStatus("disconnected");
      };
    } catch (err: any) {
      clearConnectTimeout();
      addLog(`Error: ${err.message}`, "error");
      setStatus("disconnected");
    }
  }, [
    status,
    model,
    systemInstructions,
    voiceName,
    addLog,
    interruptPlayback,
    playAudioChunk,
    clearConnectTimeout,
    clearStreamReadyTimeout,
    startAudioCapture,
  ]);

  const stop = useCallback(() => {
    clearConnectTimeout();
    clearStreamReadyTimeout();
    isReadyToStreamRef.current = false;
    interruptPlayback();
    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
      processorRef.current.disconnect();
    }
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    playbackCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();

    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    playbackCtxRef.current = null;
    streamRef.current = null;
    wsRef.current = null;

    setStatus("disconnected");
    addLog("Conversation ended");
  }, [addLog, clearConnectTimeout, clearStreamReadyTimeout, interruptPlayback]);

  return { status, logs, start, stop };
}

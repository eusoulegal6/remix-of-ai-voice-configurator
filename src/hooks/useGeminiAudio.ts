import { useState, useRef, useCallback } from "react";

export type ConnectionStatus = "disconnected" | "connecting" | "listening";

interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "error" | "audio";
}

interface UseGeminiAudioOptions {
  model: string;
  systemInstructions: string;
}

export function useGeminiAudio({ model, systemInstructions }: UseGeminiAudioOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { timestamp: new Date(), message, type }]);
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

      // Gemini returns 16-bit PCM at 24kHz
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

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }, []);

  const start = useCallback(async () => {
    if (status !== "disconnected") return;

    setStatus("connecting");
    setLogs([]);
    addLog("Requesting microphone access…");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      addLog("Microphone access granted");

      // Capture audio context at 16kHz for Gemini input
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      // Build WebSocket URL to edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID
        || import.meta.env.VITE_SUPABASE_URL?.replace("https://", "").split(".")[0]
        || "";
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/gemini-ws`;

      addLog(`Connecting to proxy: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog("WebSocket connected, waiting for proxy…");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Proxy ready → send setup message
          if (data.type === "proxy_ready") {
            addLog("Proxy ready, sending setup…");
            const setupMsg = {
              setup: {
                model: `models/${model}`,
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: "Aoede" },
                    },
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
            ws.send(JSON.stringify(setupMsg));
            return;
          }

          // Error from proxy
          if (data.type === "error") {
            addLog(`Error: ${data.message}`, "error");
            return;
          }

          // Gemini closed
          if (data.type === "gemini_closed") {
            addLog(`Gemini closed: ${data.reason || data.code}`, "error");
            return;
          }

          // Setup complete from Gemini
          if (data.setupComplete) {
            addLog("Gemini setup complete — start speaking!");
            setStatus("listening");
            startAudioCapture(audioCtx, stream, ws);
            return;
          }

          // Audio response from Gemini
          const inlineData =
            data?.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          if (inlineData?.data) {
            playAudioChunk(inlineData.data);
            addLog("Received audio response", "audio");
          }

          // Turn complete
          if (data?.serverContent?.turnComplete) {
            addLog("Agent turn complete");
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onerror = () => {
        addLog("WebSocket error", "error");
        setStatus("disconnected");
      };

      ws.onclose = () => {
        addLog("WebSocket disconnected");
        setStatus("disconnected");
      };
    } catch (err: any) {
      addLog(`Error: ${err.message}`, "error");
      setStatus("disconnected");
    }
  }, [status, model, systemInstructions, addLog, playAudioChunk]);

  const startAudioCapture = (
    audioCtx: AudioContext,
    stream: MediaStream,
    ws: WebSocket
  ) => {
    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // Buffer size 4096 at 16kHz ≈ 256ms chunks
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // Convert float32 → int16 PCM
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Convert to base64
      const bytes = new Uint8Array(int16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const msg = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: base64,
            },
          ],
        },
      };
      ws.send(JSON.stringify(msg));
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
  };

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
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
    nextPlayTimeRef.current = 0;

    setStatus("disconnected");
    addLog("Conversation ended");
  }, [addLog]);

  return { status, logs, start, stop };
}

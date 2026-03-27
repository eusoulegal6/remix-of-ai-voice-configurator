import { useState, useRef, useCallback } from "react";

export type ConnectionStatus = "disconnected" | "connecting" | "listening";

interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "error";
}

interface UseGeminiAudioOptions {
  model: string;
  systemInstructions: string;
}

export function useGeminiAudio({ model, systemInstructions }: UseGeminiAudioOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { timestamp: new Date(), message, type }]);
  }, []);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const describeCloseEvent = useCallback((event: CloseEvent) => {
    return `WebSocket closed (code: ${event.code}, reason: ${event.reason || "none"}, clean: ${event.wasClean})`;
  }, []);

  const describeErrorEvent = useCallback((event: Event) => {
    const targetState = event.target instanceof WebSocket ? event.target.readyState : "unknown";
    return `WebSocket error (readyState: ${targetState})`;
  }, []);

  const sendStringifiedPayload = useCallback((stringifiedPayload: string) => {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addLog("WebSocket is not open", "error");
      return false;
    }

    console.log("[WS →] Outgoing:", stringifiedPayload);
    addLog(`[WS →] Outgoing: ${stringifiedPayload}`);
    ws.send(stringifiedPayload);
    return true;
  }, [addLog]);

  const connect = useCallback(() => {
    if (status !== "disconnected") return;

    setStatus("connecting");
    setLogs([]);
    addLog("Connecting to Gemini proxy…");

    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      if (!baseUrl) {
        throw new Error("Backend URL is missing");
      }

      const wsUrl = `${baseUrl
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://")}/functions/v1/gemini-ws`;

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

          if (data.type === "proxy_error") {
            addLog(`[Proxy Error] ${data.message} (code: ${data.code})`, "error");
            return;
          }

          if (data.type === "proxy_ready") {
            addLog("Proxy ready, sending setup…");
            const setupPayload = {
              setup: {
                model: `models/${model}`,
                generationConfig: {
                  responseModalities: ["TEXT"],
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
            const stringifiedPayload = JSON.stringify(setupPayload);
            sendStringifiedPayload(stringifiedPayload);
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
            setStatus("listening");
            return;
          }

          const modelParts = data?.serverContent?.modelTurn?.parts;
          if (Array.isArray(modelParts)) {
            modelParts.forEach((part: { text?: string }) => {
              if (part.text) {
                addLog(`[Gemini] ${part.text}`);
              }
            });
          }

          if (data?.serverContent?.turnComplete) {
            addLog("Agent turn complete");
          }
        } catch {
          addLog(`[WS ←] ${textData}`);
        }
      };

      ws.onerror = (event) => {
        clearConnectTimeout();
        addLog(describeErrorEvent(event), "error");
        setStatus("disconnected");
      };

      ws.onclose = (event) => {
        clearConnectTimeout();
        wsRef.current = null;
        addLog(describeCloseEvent(event), event.code === 1000 ? "info" : "error");
        setStatus("disconnected");
      };
    } catch (err: any) {
      clearConnectTimeout();
      addLog(`Error: ${err.message}`, "error");
      setStatus("disconnected");
    }
  }, [status, model, systemInstructions, addLog, clearConnectTimeout, describeCloseEvent, describeErrorEvent, sendStringifiedPayload]);

  const disconnect = useCallback(() => {
    clearConnectTimeout();
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
    addLog("Disconnected");
  }, [addLog, clearConnectTimeout]);

  const sendMessage = useCallback((rawMessageText: string) => {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || status !== "listening") {
      addLog("Message unavailable until the connection is active", "error");
      return;
    }

    const messageText = rawMessageText.trim();
    if (!messageText) {
      addLog("Message cannot be empty", "error");
      return;
    }

    const payload = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: messageText }],
          },
        ],
        turnComplete: true,
      },
    };

    const stringifiedPayload = JSON.stringify(payload);
    sendStringifiedPayload(stringifiedPayload);
  }, [addLog, sendStringifiedPayload, status]);

  return { status, logs, connect, disconnect, sendMessage };
}

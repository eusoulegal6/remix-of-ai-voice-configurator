import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

Deno.serve((req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let geminiSocket: WebSocket | null = null;

  clientSocket.onopen = () => {
    console.log("[proxy] Client connected");

    const url = `${GEMINI_WS_URL}?key=${GEMINI_API_KEY}`;
    geminiSocket = new WebSocket(url);

    geminiSocket.onopen = () => {
      console.log("[proxy] Connected to Gemini");
      clientSocket.send(JSON.stringify({ type: "proxy_ready" }));
    };

    geminiSocket.onmessage = (event) => {
      // Forward Gemini responses to the client
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(typeof event.data === "string" ? event.data : event.data);
      }
    };

    geminiSocket.onerror = (event) => {
      console.error("[proxy] Gemini WS error:", event);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: "error", message: "Gemini connection error" }));
      }
    };

    geminiSocket.onclose = (event) => {
      console.log("[proxy] Gemini WS closed:", event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: "gemini_closed", code: event.code, reason: event.reason }));
        clientSocket.close();
      }
    };
  };

  clientSocket.onmessage = (event) => {
    // Forward client messages to Gemini
    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(typeof event.data === "string" ? event.data : event.data);
    } else {
      console.warn("[proxy] Gemini socket not ready, buffering message skipped");
    }
  };

  clientSocket.onclose = () => {
    console.log("[proxy] Client disconnected");
    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.close();
    }
  };

  clientSocket.onerror = (event) => {
    console.error("[proxy] Client WS error:", event);
  };

  return response;
});

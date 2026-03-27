import { useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectionStatus } from "@/hooks/useGeminiAudio";

interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "error";
}

interface TestingAreaProps {
  status: ConnectionStatus;
  logs: LogEntry[];
  onConnect: () => void;
  onDisconnect: () => void;
  onSendMessage: (message: string) => void;
}

const statusConfig: Record<ConnectionStatus, { label: string; color: string; dotClass: string }> = {
  disconnected: { label: "Disconnected", color: "text-muted-foreground", dotClass: "bg-muted-foreground" },
  connecting: { label: "Connecting…", color: "text-foreground", dotClass: "bg-accent animate-pulse" },
  listening: { label: "Connected", color: "text-primary", dotClass: "bg-primary animate-pulse" },
};

const logTypeColors: Record<LogEntry["type"], string> = {
  info: "text-muted-foreground",
  error: "text-destructive",
};

const TestingArea = ({ status, logs, onConnect, onDisconnect, onSendMessage }: TestingAreaProps) => {
  const [message, setMessage] = useState("");
  const { label, color, dotClass } = statusConfig[status];
  const isConnected = status !== "disconnected";
  const canSendMessage = status === "listening" && message.trim().length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = message.trim();
    if (!nextMessage) return;
    onSendMessage(nextMessage);
    setMessage("");
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Button
            type="button"
            size="lg"
            variant={isConnected ? "destructive" : "default"}
            onClick={isConnected ? onDisconnect : onConnect}
            className="min-w-56"
          >
            {isConnected ? "Disconnect" : "Connect to Gemini"}
          </Button>

          <form onSubmit={handleSubmit} className="flex w-full gap-3">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type a message to Gemini…"
              disabled={status !== "listening"}
              className="flex-1"
            />
            <Button type="submit" disabled={!canSendMessage}>
              Send Message
            </Button>
          </form>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <Radio className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Activity Log</span>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4 h-64 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground opacity-50">Waiting for connection…</p>
            ) : (
              logs.map((entry, i) => (
                <p key={i} className={logTypeColors[entry.type]}>
                  <span className="opacity-50">[{entry.timestamp.toLocaleTimeString()}]</span>{" "}
                  {entry.message}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default TestingArea;

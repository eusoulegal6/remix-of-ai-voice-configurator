import { Mic, MicOff } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/useGeminiAudio";

interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "error" | "audio";
}

interface TestingAreaProps {
  status: ConnectionStatus;
  logs: LogEntry[];
  onStart: () => void;
  onStop: () => void;
}

const statusConfig: Record<ConnectionStatus, { label: string; color: string; dotClass: string }> = {
  disconnected: { label: "Disconnected", color: "text-muted-foreground", dotClass: "bg-muted-foreground" },
  connecting: { label: "Connecting…", color: "text-foreground", dotClass: "bg-accent animate-pulse" },
  listening: { label: "Listening / Speaking", color: "text-primary", dotClass: "bg-primary animate-pulse" },
};

const logTypeColors: Record<string, string> = {
  info: "text-muted-foreground",
  error: "text-destructive",
  audio: "text-primary",
};

const TestingArea = ({ status, logs, onStart, onStop }: TestingAreaProps) => {
  const { label, color, dotClass } = statusConfig[status];
  const isActive = status !== "disconnected";
  const recentLogs = logs.slice(-8).reverse();

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6 sm:gap-10 sm:p-8">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleClick}
          className={`group relative flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all active:scale-95 sm:h-36 sm:w-36 ${
            isActive
              ? "bg-destructive/20 border-destructive"
              : "bg-secondary border-border hover:border-primary"
          }`}
        >
          {isActive ? (
            <MicOff className="h-12 w-12 text-destructive" />
          ) : (
            <Mic className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
          <span className="absolute -bottom-7 text-xs font-medium text-muted-foreground sm:-bottom-8">
            {isActive ? "Stop Conversation" : "Start Conversation"}
          </span>
        </button>
      </div>
      <section className="w-full max-w-2xl rounded-xl border border-border bg-card/60 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Connection Logs</h2>
          <span className="text-xs text-muted-foreground">
            {logs.length ? `${logs.length} event${logs.length === 1 ? "" : "s"}` : "No events yet"}
          </span>
        </div>
        {recentLogs.length > 0 ? (
          <div className="space-y-2">
            {recentLogs.map((log, index) => (
              <div
                key={`${log.timestamp.toISOString()}-${index}`}
                className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={logTypeColors[log.type] ?? "text-muted-foreground"}>{log.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Start a conversation to see microphone, WebSocket, and backend events here.
          </p>
        )}
      </section>
    </main>
  );
};

export default TestingArea;

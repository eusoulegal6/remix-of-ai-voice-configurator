import { Mic, MicOff, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onSendTextTest: () => void;
}

const statusConfig: Record<ConnectionStatus, { label: string; color: string; dotClass: string }> = {
  disconnected: { label: "Disconnected", color: "text-muted-foreground", dotClass: "bg-muted-foreground" },
  connecting: { label: "Connecting…", color: "text-yellow-400", dotClass: "bg-yellow-400 animate-pulse" },
  listening: { label: "Listening / Speaking", color: "text-primary", dotClass: "bg-primary animate-pulse" },
};

const logTypeColors: Record<string, string> = {
  info: "text-muted-foreground",
  error: "text-destructive",
  audio: "text-primary",
};

const TestingArea = ({ status, logs, onStart, onStop, onSendTextTest }: TestingAreaProps) => {
  const { label, color, dotClass } = statusConfig[status];
  const isActive = status !== "disconnected";
  const canSendTextTest = status === "listening";

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>

      {/* Push to Talk */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleClick}
          className={`group relative h-36 w-36 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
            isActive
              ? "bg-destructive/20 border-destructive glow-primary-strong"
              : "bg-secondary border-border hover:border-primary hover:glow-primary"
          }`}
        >
          {isActive ? (
            <MicOff className="h-12 w-12 text-destructive" />
          ) : (
            <Mic className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
          <span className="absolute -bottom-8 text-xs text-muted-foreground font-medium">
            {isActive ? "Stop Conversation" : "Start Conversation"}
          </span>
        </button>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onSendTextTest}
          disabled={!canSendTextTest}
          className="min-w-40"
        >
          Send Text Test
        </Button>
      </div>

      {/* Log area */}
      <div className="w-full max-w-2xl mt-8">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Radio className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Activity Log</span>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <p className="text-muted-foreground opacity-50">Waiting for connection…</p>
          ) : (
            logs.map((entry, i) => (
              <p key={i} className={logTypeColors[entry.type] || "text-muted-foreground"}>
                <span className="opacity-50">
                  [{entry.timestamp.toLocaleTimeString()}]
                </span>{" "}
                {entry.message}
              </p>
            ))
          )}
        </div>
      </div>
    </main>
  );
};

export default TestingArea;

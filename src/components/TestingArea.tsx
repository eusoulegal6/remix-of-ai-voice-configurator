import { Mic, MicOff, RefreshCw, ShieldCheck, Volume2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ConnectionStatus,
  PermissionState,
  ReconnectState,
  SessionIndicators,
  SpeakerState,
} from "@/hooks/useGeminiAudio";

interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "error" | "audio";
}

interface TestingAreaProps {
  status: ConnectionStatus;
  logs: LogEntry[];
  sessionIndicators: SessionIndicators;
  onStart: () => void;
  onStop: () => void;
  onReconnect: () => void;
}

const statusConfig: Record<ConnectionStatus, { label: string; color: string; dotClass: string }> = {
  disconnected: { label: "Disconnected", color: "text-muted-foreground", dotClass: "bg-muted-foreground" },
  connecting: { label: "Connecting...", color: "text-foreground", dotClass: "bg-accent animate-pulse" },
  listening: { label: "Listening / Speaking", color: "text-primary", dotClass: "bg-primary animate-pulse" },
};

const logTypeColors: Record<string, string> = {
  info: "text-muted-foreground",
  error: "text-destructive",
  audio: "text-primary",
};

const permissionConfig: Record<PermissionState, { label: string; className: string }> = {
  idle: { label: "Not Requested", className: "border-border/60 bg-background/80 text-muted-foreground" },
  requesting: { label: "Requesting", className: "border-accent/50 bg-accent/10 text-foreground" },
  granted: { label: "Granted", className: "border-primary/40 bg-primary/10 text-foreground" },
  denied: { label: "Denied", className: "border-destructive/40 bg-destructive/10 text-foreground" },
  unsupported: { label: "Unavailable", className: "border-destructive/40 bg-destructive/10 text-foreground" },
};

const speakerConfig: Record<SpeakerState, { label: string; className: string }> = {
  idle: { label: "Idle", className: "border-border/60 bg-background/80 text-muted-foreground" },
  preparing: { label: "Preparing", className: "border-accent/50 bg-accent/10 text-foreground" },
  ready: { label: "Ready", className: "border-primary/40 bg-primary/10 text-foreground" },
  playing: { label: "Playing", className: "border-primary/40 bg-primary/10 text-foreground" },
  blocked: { label: "Blocked", className: "border-destructive/40 bg-destructive/10 text-foreground" },
};

const reconnectConfig: Record<ReconnectState, { label: string; className: string }> = {
  idle: { label: "Stable", className: "border-border/60 bg-background/80 text-muted-foreground" },
  reconnecting: { label: "Retrying", className: "border-accent/50 bg-accent/10 text-foreground" },
  available: { label: "Action Needed", className: "border-destructive/40 bg-destructive/10 text-foreground" },
};

const TestingArea = ({
  status,
  logs,
  sessionIndicators,
  onStart,
  onStop,
  onReconnect,
}: TestingAreaProps) => {
  const { label, color, dotClass } = statusConfig[status];
  const isActive = status !== "disconnected";
  const recentLogs = logs.slice(-8).reverse();
  const primaryActionLabel =
    sessionIndicators.reconnect.state === "available" ? "Reconnect Conversation" : "Start Conversation";

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:gap-10 sm:p-8 sm:pb-36">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleClick}
          className={`group relative flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all active:scale-95 sm:h-36 sm:w-36 ${
            isActive
              ? "border-destructive bg-destructive/20"
              : "border-border bg-secondary hover:border-primary"
          }`}
        >
          {isActive ? (
            <MicOff className="h-12 w-12 text-destructive" />
          ) : (
            <Mic className="h-12 w-12 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
          <span className="absolute -bottom-7 text-xs font-medium text-muted-foreground sm:-bottom-8">
            {isActive ? "Stop Conversation" : primaryActionLabel}
          </span>
        </button>
      </div>

      <section className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <div className={`rounded-xl border p-4 ${permissionConfig[sessionIndicators.permission.state].className}`}>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-semibold">Microphone</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
            {permissionConfig[sessionIndicators.permission.state].label}
          </p>
          <p className="mt-2 text-sm">{sessionIndicators.permission.detail}</p>
        </div>

        <div className={`rounded-xl border p-4 ${speakerConfig[sessionIndicators.speaker.state].className}`}>
          <div className="mb-2 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <span className="text-sm font-semibold">Speaker</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
            {speakerConfig[sessionIndicators.speaker.state].label}
          </p>
          <p className="mt-2 text-sm">{sessionIndicators.speaker.detail}</p>
        </div>

        <div className={`rounded-xl border p-4 ${reconnectConfig[sessionIndicators.reconnect.state].className}`}>
          <div className="mb-2 flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-semibold">Reconnect</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
            {reconnectConfig[sessionIndicators.reconnect.state].label}
          </p>
          <p className="mt-2 text-sm">{sessionIndicators.reconnect.detail}</p>
          {sessionIndicators.reconnect.state === "available" && (
            <Button onClick={onReconnect} variant="outline" size="sm" className="mt-3 w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Reconnect
            </Button>
          )}
        </div>
      </section>

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

import { Mic, MicOff, RefreshCw, ShieldCheck, Volume2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import InstallPrompt from "@/components/InstallPrompt";
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

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleClick}
          className={`group flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all active:scale-95 sm:h-36 sm:w-36 ${
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
        </button>
        <span className="text-xs font-medium text-muted-foreground">
          {isActive ? "Stop Conversation" : primaryActionLabel}
        </span>
      </div>

      <InstallPrompt />
    </main>
  );
};

export default TestingArea;

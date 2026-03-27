import { Mic, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConnectionStatus = "disconnected" | "connecting" | "listening";

interface TestingAreaProps {
  status: ConnectionStatus;
}

const statusConfig: Record<ConnectionStatus, { label: string; color: string; dotClass: string }> = {
  disconnected: { label: "Disconnected", color: "text-muted-foreground", dotClass: "bg-muted-foreground" },
  connecting: { label: "Connecting…", color: "text-yellow-400", dotClass: "bg-yellow-400 animate-pulse" },
  listening: { label: "Listening / Speaking", color: "text-primary", dotClass: "bg-primary animate-pulse" },
};

const TestingArea = ({ status }: TestingAreaProps) => {
  const { toast } = useToast();
  const { label, color, dotClass } = statusConfig[status];

  const handleStart = () => {
    toast({
      title: "Ready to connect",
      description: "Backend API key configured. Ready to connect to Gemini.",
    });
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>

      {/* Push to Talk */}
      <button
        onClick={handleStart}
        className="group relative h-36 w-36 rounded-full bg-secondary border-2 border-border flex items-center justify-center transition-all hover:border-primary hover:glow-primary active:scale-95"
      >
        <Mic className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="absolute -bottom-8 text-xs text-muted-foreground font-medium">
          Start Conversation
        </span>
      </button>

      {/* Log area */}
      <div className="w-full max-w-2xl mt-8">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Radio className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Activity Log</span>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border p-4 h-48 overflow-y-auto font-mono text-xs text-muted-foreground">
          <p className="opacity-50">Waiting for connection…</p>
        </div>
      </div>
    </main>
  );
};

export default TestingArea;

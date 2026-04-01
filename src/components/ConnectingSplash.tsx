import type { ConnectionStatus } from "@/hooks/useGeminiAudio";

interface ConnectingSplashProps {
  status: ConnectionStatus;
  error?: string;
  onRetry: () => void;
}

const ConnectingSplash = ({ status, error, onRetry }: ConnectingSplashProps) => {
  if (status === "listening") return null;

  const isError = !!error;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background animate-fade-in">
      {/* Animated rings */}
      <div className="relative flex items-center justify-center">
        <div
          className={`absolute h-40 w-40 rounded-full border-2 ${
            isError ? "border-destructive/30" : "border-primary/20"
          } animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]`}
        />
        <div
          className={`absolute h-28 w-28 rounded-full border-2 ${
            isError ? "border-destructive/40" : "border-primary/30"
          } animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]`}
        />
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full ${
            isError ? "border-destructive/50 bg-destructive/10" : "border-primary/40 bg-primary/10"
          } border-2`}
        >
          <div
            className={`h-4 w-4 rounded-full ${
              isError ? "bg-destructive" : "bg-primary animate-pulse"
            }`}
          />
        </div>
      </div>

      <p className="mt-10 text-lg font-semibold text-foreground">
        {isError ? "Connection Failed" : "Connecting to your agent…"}
      </p>
      <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
        {isError
          ? error
          : status === "connecting"
            ? "Setting up microphone and establishing a live session."
            : "Preparing to connect…"}
      </p>

      {isError && (
        <button
          onClick={onRetry}
          className="mt-6 rounded-full border border-border bg-secondary px-6 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ConnectingSplash;

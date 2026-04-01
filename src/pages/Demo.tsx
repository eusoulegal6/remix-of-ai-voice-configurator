import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";
import TestingArea from "@/components/TestingArea";
import ConfigSection from "@/components/ConfigSection";
import ConnectingSplash from "@/components/ConnectingSplash";
import { Button } from "@/components/ui/button";

const Demo = () => {
  const [config, setConfig] = useState({
    model: "gemini-3.1-flash-live-preview",
    systemInstructions: "",
    voiceName: "Kore",
  });

  const { status, logs, sessionIndicators, start, stop, retry } = useGeminiAudio({
    model: config.model,
    systemInstructions: config.systemInstructions,
    voiceName: config.voiceName,
  });

  // Track whether an auto-start error occurred so the splash can show it
  const [splashError, setSplashError] = useState<string | undefined>();
  const autoStartedRef = useRef(false);

  // Auto-start the session on mount
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    start();
  }, [start]);

  // Detect if we moved from connecting → disconnected (error happened)
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === "connecting" && status === "disconnected") {
      // Pull the latest error detail from session indicators
      const permDetail = sessionIndicators.permission.state === "denied"
        ? sessionIndicators.permission.detail
        : undefined;
      const reconnectDetail = sessionIndicators.reconnect.state === "available"
        ? sessionIndicators.reconnect.detail
        : undefined;
      setSplashError(permDetail || reconnectDetail || "Could not connect. Check your microphone and try again.");
    }

    if (status === "listening") {
      setSplashError(undefined);
    }
  }, [status, sessionIndicators]);

  const handleRetry = () => {
    setSplashError(undefined);
    retry();
  };

  const showSplash = status !== "listening" && (status === "connecting" || splashError);

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden animate-slide-down-fade">
      {showSplash && (
        <ConnectingSplash status={status} error={splashError} onRetry={handleRetry} />
      )}
      <div className="absolute top-4 left-4 z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="mr-1" />
            Back
          </Link>
        </Button>
      </div>
      <TestingArea
        status={status}
        logs={logs}
        sessionIndicators={sessionIndicators}
        onStart={start}
        onStop={stop}
        onReconnect={retry}
      />
      <ConfigSection onApply={setConfig} />
    </div>
  );
};

export default Demo;

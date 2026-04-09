import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";
import { useFillerPlayback } from "@/hooks/useFillerPlayback";
import TestingArea from "@/components/TestingArea";
import ConfigSection from "@/components/ConfigSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Demo = () => {
  const [config, setConfig] = useState({
    model: "gemini-3.1-flash-live-preview",
    systemInstructions: "",
    voiceName: "Kore",
  });

  // Stable refs so useGeminiAudio's callbacks always call the latest filler functions
  const stopFillerRef = useRef<(reason?: string) => void>(() => {});
  const onFirstSpeechEndRef = useRef<() => void>(() => {});

  const handleUserSpeech = useCallback(() => {
    console.debug("[FillerDebug]", {
      atMs: performance.now(),
      phase: "Demo.onUserSpeechForwarded",
      selectedVoice: config.voiceName,
    });
    stopFillerRef.current("user_speech");
  }, [config.voiceName]);

  const handleUserSpeechEnd = useCallback(() => {
    console.debug("[FillerDebug]", {
      atMs: performance.now(),
      phase: "Demo.onUserSpeechEndForwarded",
      selectedVoice: config.voiceName,
    });
    onFirstSpeechEndRef.current();
  }, [config.voiceName]);

  const { status, logs, sessionIndicators, start, stop, retry } = useGeminiAudio({
    model: config.model,
    systemInstructions: config.systemInstructions,
    voiceName: config.voiceName,
    onUserSpeech: handleUserSpeech,
    onUserSpeechEnd: handleUserSpeechEnd,
  });

  const { fillerEnabled, setFillerEnabled, stopFiller, onFirstSpeechEnd, warmUpAudio } = useFillerPlayback({
    voiceName: config.voiceName,
    status,
    sessionIndicators,
  });

  useEffect(() => {
    console.debug("[FillerDebug]", {
      atMs: performance.now(),
      phase: "Demo.fillerState",
      selectedVoice: config.voiceName,
      fillerEnabled,
    });
  }, [config.voiceName, fillerEnabled]);

  // Keep ref in sync
  useEffect(() => { stopFillerRef.current = stopFiller; }, [stopFiller]);
  useEffect(() => { onFirstSpeechEndRef.current = onFirstSpeechEnd; }, [onFirstSpeechEnd]);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const warmUpUrl = `${baseUrl}/functions/v1/gemini-ws`;

    if (warmUpUrl && baseUrl) {
      fetch(warmUpUrl, { method: "OPTIONS" }).catch(() => {});
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden animate-slide-down-fade">
      <div className="absolute top-4 left-4 z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="mr-1" />
            Back
          </Link>
        </Button>
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Label htmlFor="filler-toggle" className="text-xs text-muted-foreground cursor-pointer">
          Filler audio
        </Label>
        <Switch
          id="filler-toggle"
          checked={fillerEnabled}
          onCheckedChange={setFillerEnabled}
        />
      </div>
      <TestingArea
        status={status}
        logs={logs}
        sessionIndicators={sessionIndicators}
        onStart={() => {
          warmUpAudio();
          start();
        }}
        onStop={stop}
        onReconnect={retry}
      />
      <ConfigSection onApply={setConfig} />
    </div>
  );
};

export default Demo;

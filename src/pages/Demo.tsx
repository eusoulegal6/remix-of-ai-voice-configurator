import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";
import TestingArea from "@/components/TestingArea";
import ConfigSection from "@/components/ConfigSection";
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

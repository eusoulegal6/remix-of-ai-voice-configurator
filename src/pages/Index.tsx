import { useState } from "react";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";
import TestingArea from "@/components/TestingArea";
import ConfigSection from "@/components/ConfigSection";

const Index = () => {
  const [config, setConfig] = useState({
    model: "gemini-3.1-flash-live-preview",
    systemInstructions: "",
    voiceName: "Kore",
  });

  const { status, logs, start, stop } = useGeminiAudio({
    model: config.model,
    systemInstructions: config.systemInstructions,
    voiceName: config.voiceName,
  });

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden animate-slide-down-fade">
      <TestingArea status={status} logs={logs} onStart={start} onStop={stop} />
      <ConfigSection onApply={setConfig} />
    </div>
  );
};

export default Index;

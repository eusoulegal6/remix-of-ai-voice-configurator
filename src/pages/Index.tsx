import { useState } from "react";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";
import TestingArea from "@/components/TestingArea";
import ConfigSection from "@/components/ConfigSection";

const Index = () => {
  const [config, setConfig] = useState({
    model: "gemini-3.1-flash-live-preview",
    systemInstructions: "",
  });

  const { status, logs, start, stop } = useGeminiAudio({
    model: config.model,
    systemInstructions: config.systemInstructions,
  });

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      <TestingArea status={status} logs={logs} onStart={start} onStop={stop} />
      <ConfigSection onApply={setConfig} />
    </div>
  );
};

export default Index;

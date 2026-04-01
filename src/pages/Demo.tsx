import { useState } from "react";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";
import TestingArea from "@/components/TestingArea";
import ConfigSection from "@/components/ConfigSection";

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

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden animate-slide-down-fade">
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

import { useState } from "react";
import ConfigPanel from "@/components/ConfigPanel";
import TestingArea from "@/components/TestingArea";
import { useGeminiAudio } from "@/hooks/useGeminiAudio";

const Index = () => {
  const [config, setConfig] = useState({
    model: "gemini-3.1-flash-live-preview",
    systemInstructions: "",
  });

  const { status, logs, start, stop, sendTextTest, isMicMuted, setIsMicMuted } = useGeminiAudio({
    model: config.model,
    systemInstructions: config.systemInstructions,
  });

  return (
    <div className="flex min-h-screen">
      <ConfigPanel onApply={setConfig} />
      <TestingArea status={status} logs={logs} onStart={start} onStop={stop} onSendTextTest={sendTextTest} isMicMuted={isMicMuted} onToggleMic={() => setIsMicMuted(prev => !prev)} />
    </div>
  );
};

export default Index;

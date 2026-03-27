import { useState } from "react";
import ConfigPanel from "@/components/ConfigPanel";
import TestingArea from "@/components/TestingArea";

type ConnectionStatus = "disconnected" | "connecting" | "listening";

const Index = () => {
  const [config, setConfig] = useState({
    model: "gemini-3.1-flash-live-preview",
    systemInstructions: "",
  });
  const [status] = useState<ConnectionStatus>("disconnected");

  return (
    <div className="flex min-h-screen">
      <ConfigPanel onApply={setConfig} />
      <TestingArea status={status} />
    </div>
  );
};

export default Index;

import { useState } from "react";
import { Settings, Save, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ConfigPanelProps {
  onApply: (config: { model: string; systemInstructions: string }) => void;
}

const ConfigPanel = ({ onApply }: ConfigPanelProps) => {
  const [model, setModel] = useState("gemini-3.1-flash-live-preview");
  const [systemInstructions, setSystemInstructions] = useState("");
  const { toast } = useToast();

  const handleApply = () => {
    onApply({ model, systemInstructions });
    toast({
      title: "Settings Saved",
      description: "Your configuration has been applied.",
    });
  };

  return (
    <aside className="w-80 shrink-0 border-r border-border bg-sidebar p-5 flex flex-col gap-6 overflow-y-auto">
      <div className="flex items-center gap-2 text-sidebar-foreground">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Configuration</h2>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-accent/30 border border-accent px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-accent-foreground shrink-0" />
        <span className="text-xs text-accent-foreground">
          Gemini API Key is securely stored on the backend.
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model-id" className="text-sm text-muted-foreground">Model ID</Label>
        <Input
          id="model-id"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-muted border-border font-mono text-sm"
        />
      </div>

      <div className="space-y-2 flex-1 flex flex-col">
        <Label htmlFor="system-instructions" className="text-sm text-muted-foreground">
          Knowledge Base / System Instructions
        </Label>
        <Textarea
          id="system-instructions"
          value={systemInstructions}
          onChange={(e) => setSystemInstructions(e.target.value)}
          placeholder="Paste company policies, support docs, or custom instructions here…"
          className="flex-1 min-h-[200px] bg-muted border-border text-sm resize-none"
        />
      </div>

      <Button onClick={handleApply} className="w-full gap-2">
        <Save className="h-4 w-4" />
        Apply Configuration
      </Button>
    </aside>
  );
};

export default ConfigPanel;

import { useState } from "react";
import { Settings, Save, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ConfigSectionProps {
  onApply: (config: { model: string; systemInstructions: string }) => void;
}

const ConfigSection = ({ onApply }: ConfigSectionProps) => {
  const [model] = useState("gemini-3.1-flash-live-preview");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleApply = () => {
    onApply({ model, systemInstructions });
    toast({
      title: "Settings Saved",
      description: "Your configuration has been applied.",
    });
  };

  return (
    <div className="w-full px-4 pb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-3 text-muted-foreground"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Configuration</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center gap-2 rounded-lg bg-accent/30 border border-accent px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-accent-foreground shrink-0" />
            <span className="text-xs text-accent-foreground">
              API Key is securely stored on the backend.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-instructions" className="text-sm text-muted-foreground">
              Knowledge Base / System Instructions
            </Label>
            <Textarea
              id="system-instructions"
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              placeholder="Paste company policies, support docs, or custom instructions here…"
              className="min-h-[120px] bg-muted border-border text-sm resize-none"
            />
          </div>

          <Button onClick={handleApply} className="w-full gap-2">
            <Save className="h-4 w-4" />
            Apply Configuration
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConfigSection;

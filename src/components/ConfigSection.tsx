import { useState } from "react";
import { Settings, X, ShieldCheck, Save, MessageSquare, Globe, Sparkles, Users } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfigSectionProps {
  onApply: (config: { model: string; systemInstructions: string; voiceName: string }) => void;
}

const PERSONA_OPTIONS = [
  { value: "professional", label: "Professional", description: "Clear, concise, business-appropriate", icon: "💼" },
  { value: "friendly", label: "Friendly", description: "Warm, casual, relationship-first approach", icon: "😊" },
  { value: "technical", label: "Technical", description: "Detailed, precise, domain-expert style", icon: "🔧" },
  { value: "concise", label: "Concise", description: "Short answers, straight to the point", icon: "⚡" },
  { value: "custom", label: "Custom", description: "Write your own instructions below", icon: "✏️" },
];

const VOICE_OPTIONS = [
  { value: "Kore", label: "Kore", tone: "Firm" },
  { value: "Puck", label: "Puck", tone: "Upbeat" },
  { value: "Charon", label: "Charon", tone: "Informative" },
  { value: "Zephyr", label: "Zephyr", tone: "Bright" },
  { value: "Fenrir", label: "Fenrir", tone: "Excitable" },
  { value: "Leda", label: "Leda", tone: "Youthful" },
  { value: "Orus", label: "Orus", tone: "Firm" },
  { value: "Aoede", label: "Aoede", tone: "Breezy" },
  { value: "Callirrhoe", label: "Callirrhoe", tone: "Easy-going" },
  { value: "Autonoe", label: "Autonoe", tone: "Bright" },
  { value: "Enceladus", label: "Enceladus", tone: "Breathy" },
  { value: "Iapetus", label: "Iapetus", tone: "Clear" },
  { value: "Umbriel", label: "Umbriel", tone: "Easy-going" },
  { value: "Algieba", label: "Algieba", tone: "Smooth" },
  { value: "Despina", label: "Despina", tone: "Smooth" },
  { value: "Erinome", label: "Erinome", tone: "Clear" },
  { value: "Algenib", label: "Algenib", tone: "Gravelly" },
  { value: "Rasalgethi", label: "Rasalgethi", tone: "Informative" },
  { value: "Laomedeia", label: "Laomedeia", tone: "Upbeat" },
  { value: "Achernar", label: "Achernar", tone: "Soft" },
  { value: "Alnilam", label: "Alnilam", tone: "Firm" },
  { value: "Schedar", label: "Schedar", tone: "Even" },
  { value: "Gacrux", label: "Gacrux", tone: "Mature" },
  { value: "Pulcherrima", label: "Pulcherrima", tone: "Forward" },
  { value: "Achird", label: "Achird", tone: "Friendly" },
  { value: "Zubenelgenubi", label: "Zubenelgenubi", tone: "Casual" },
  { value: "Vindemiatrix", label: "Vindemiatrix", tone: "Gentle" },
  { value: "Sadachbia", label: "Sadachbia", tone: "Lively" },
  { value: "Sadaltager", label: "Sadaltager", tone: "Knowledgeable" },
  { value: "Sulafat", label: "Sulafat", tone: "Warm" },
];

const ConfigSection = ({ onApply }: ConfigSectionProps) => {
  const [model] = useState("gemini-3.1-flash-live-preview");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [voiceName, setVoiceName] = useState("Kore");
  const [persona, setPersona] = useState("professional");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleApply = () => {
    const personaPrefix = persona !== "custom"
      ? `You are a ${persona} AI assistant. `
      : "";
    onApply({
      model,
      systemInstructions: personaPrefix + systemInstructions,
      voiceName,
    });
    toast({
      title: "Configuration Applied",
      description: "Your settings have been saved.",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 right-6 gap-2 z-50 shadow-lg border-border bg-card hover:bg-secondary"
        >
          <Settings className="h-4 w-4" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto bg-card border-border p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold text-foreground">
            Configure Your AI Assistant
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 flex flex-col gap-6">
          {/* System Instructions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              System Instructions
            </Label>
            <Textarea
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              placeholder='e.g. "You are a helpful customer support agent for our SaaS product"'
              className="min-h-[80px] bg-muted border-border text-sm resize-none"
            />
          </div>

          {/* Persona Style */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Persona Style
            </Label>
            <div className="flex flex-col gap-2">
              {PERSONA_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPersona(p.value)}
                  className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-all ${
                    persona === p.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  <span className="text-lg shrink-0">{p.icon}</span>
                  <div>
                    <span className="font-semibold text-sm">{p.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {p.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="h-4 w-4 text-primary" />
              Voice
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.value}
                  onClick={() => setVoiceName(voice.value)}
                  className={`rounded-lg border px-3 py-2.5 text-sm text-center transition-all ${
                    voiceName === voice.value
                      ? "border-primary bg-primary/10 text-foreground font-semibold"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  {voice.label}{" "}
                  <span className="text-xs opacity-70">({voice.tone})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Security Note */}
          <div className="flex items-center gap-2 rounded-lg bg-accent/30 border border-accent px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-accent-foreground shrink-0" />
            <span className="text-xs text-accent-foreground">
              API Key is securely stored on the backend.
            </span>
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full gap-2">
            <Save className="h-4 w-4" />
            Apply Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigSection;

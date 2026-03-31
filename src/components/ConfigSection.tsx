import { useState } from "react";
import { Settings, ShieldCheck, Save, MessageSquare, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  {
    value: "professional",
    label: "Professional",
    description: "Clear, concise, business-appropriate",
    icon: "💼",
    voices: [
      { value: "Kore", tone: "Firm" },
      { value: "Orus", tone: "Firm" },
      { value: "Alnilam", tone: "Firm" },
      { value: "Charon", tone: "Informative" },
      { value: "Rasalgethi", tone: "Informative" },
      { value: "Schedar", tone: "Even" },
      { value: "Pulcherrima", tone: "Forward" },
      { value: "Gacrux", tone: "Mature" },
      { value: "Sadaltager", tone: "Knowledgeable" },
    ],
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm, casual, relationship-first approach",
    icon: "😊",
    voices: [
      { value: "Achird", tone: "Friendly" },
      { value: "Sulafat", tone: "Warm" },
      { value: "Puck", tone: "Upbeat" },
      { value: "Laomedeia", tone: "Upbeat" },
      { value: "Callirrhoe", tone: "Easy-going" },
      { value: "Umbriel", tone: "Easy-going" },
      { value: "Zubenelgenubi", tone: "Casual" },
      { value: "Vindemiatrix", tone: "Gentle" },
      { value: "Achernar", tone: "Soft" },
      { value: "Sadachbia", tone: "Lively" },
    ],
  },
  {
    value: "technical",
    label: "Technical",
    description: "Detailed, precise, domain-expert style",
    icon: "🔧",
    voices: [
      { value: "Iapetus", tone: "Clear" },
      { value: "Erinome", tone: "Clear" },
      { value: "Charon", tone: "Informative" },
      { value: "Rasalgethi", tone: "Informative" },
      { value: "Sadaltager", tone: "Knowledgeable" },
      { value: "Gacrux", tone: "Mature" },
      { value: "Schedar", tone: "Even" },
    ],
  },
  {
    value: "concise",
    label: "Concise",
    description: "Short answers, straight to the point",
    icon: "⚡",
    voices: [
      { value: "Kore", tone: "Firm" },
      { value: "Orus", tone: "Firm" },
      { value: "Alnilam", tone: "Firm" },
      { value: "Iapetus", tone: "Clear" },
      { value: "Erinome", tone: "Clear" },
      { value: "Schedar", tone: "Even" },
    ],
  },
];

const ConfigSection = ({ onApply }: ConfigSectionProps) => {
  const [model] = useState("gemini-3.1-flash-live-preview");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [voiceName, setVoiceName] = useState("Kore");
  const [persona, setPersona] = useState("professional");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handlePersonaChange = (value: string) => {
    setPersona(value);
    const selected = PERSONA_OPTIONS.find((p) => p.value === value);
    if (selected && !selected.voices.some((v) => v.value === voiceName)) {
      setVoiceName(selected.voices[0].value);
    }
  };

  const handleApply = () => {
    const personaPrefix =
      persona !== "custom" ? `You are a ${persona} AI assistant. ` : "";
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

  const activePersona = PERSONA_OPTIONS.find((p) => p.value === persona)!;

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
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto scrollbar-none bg-card border-border p-0 animate-slide-down-fade">
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

          {/* Persona Style with grouped voices */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Persona &amp; Voice
            </Label>
            <div className="flex flex-col gap-2">
              {PERSONA_OPTIONS.map((p) => (
                <div key={p.value} className="flex flex-col">
                  <button
                    onClick={() => handlePersonaChange(p.value)}
                    className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-all ${
                      persona === p.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-lg shrink-0">{p.icon}</span>
                    <div>
                      <span className="font-semibold text-sm">{p.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        — {p.description}
                      </span>
                    </div>
                  </button>

                  {/* Voice chips shown when this persona is selected */}
                  {persona === p.value && (
                    <div className="flex flex-wrap gap-1.5 pt-2 pb-1 pl-10">
                      {p.voices.map((voice) => (
                        <button
                          key={voice.value}
                          onClick={() => setVoiceName(voice.value)}
                          className={`rounded-full border px-3 py-1 text-xs transition-all ${
                            voiceName === voice.value
                              ? "border-primary bg-primary/15 text-foreground font-semibold"
                              : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                          }`}
                        >
                          {voice.value}{" "}
                          <span className="opacity-60">· {voice.tone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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

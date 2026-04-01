import { useState, type ReactNode } from "react";
import { MessageSquare, Save, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface ConfigSectionProps {
  onApply: (config: { model: string; systemInstructions: string; voiceName: string }) => void;
}

const PERSONA_OPTIONS = [
  {
    value: "professional",
    label: "Professional",
    description: "Clear, concise, business-appropriate",
    icon: "PRO",
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
    icon: "FRI",
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
    icon: "TEC",
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
    icon: "FAST",
    voices: [
      { value: "Kore", tone: "Firm" },
      { value: "Orus", tone: "Firm" },
      { value: "Alnilam", tone: "Firm" },
      { value: "Iapetus", tone: "Clear" },
      { value: "Erinome", tone: "Clear" },
      { value: "Schedar", tone: "Even" },
    ],
  },
] as const;

const ConfigSection = ({ onApply }: ConfigSectionProps) => {
  const [model] = useState("gemini-3.1-flash-live-preview");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [voiceName, setVoiceName] = useState("Kore");
  const [persona, setPersona] = useState("professional");
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const handlePersonaChange = (value: string) => {
    setPersona(value);
    const selected = PERSONA_OPTIONS.find((item) => item.value === value);
    if (selected && !selected.voices.some((voice) => voice.value === voiceName)) {
      setVoiceName(selected.voices[0].value);
    }
  };

  const handleApply = () => {
    onApply({
      model,
      systemInstructions: `You are a ${persona} AI assistant. ${systemInstructions}`,
      voiceName,
    });
    toast({
      title: "Configuration Applied",
      description: "Your settings have been saved.",
    });
    setOpen(false);
  };

  const activePersona = PERSONA_OPTIONS.find((item) => item.value === persona) ?? PERSONA_OPTIONS[0];
  const hasInstructions = systemInstructions.trim().length > 0;

  const configContent = (
    <div className="flex flex-col gap-6 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          System Instructions
        </Label>
        <Textarea
          value={systemInstructions}
          onChange={(event) => setSystemInstructions(event.target.value)}
          placeholder='e.g. "You are a helpful customer support agent for our SaaS product"'
          className="min-h-[96px] resize-none border-border bg-muted text-sm"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Persona and Voice
        </Label>
        <div className="flex flex-col gap-2">
          {PERSONA_OPTIONS.map((item) => (
            <div key={item.value} className="flex flex-col">
              <button
                onClick={() => handlePersonaChange(item.value)}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                  persona === item.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-border/70 bg-background text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                  {item.icon}
                </span>
                <div>
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">- {item.description}</span>
                </div>
              </button>

              {persona === item.value && (
                <div className="flex flex-wrap gap-1.5 pb-1 pl-10 pt-2">
                  {item.voices.map((voice) => (
                    <button
                      key={voice.value}
                      onClick={() => setVoiceName(voice.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition-all ${
                        voiceName === voice.value
                          ? "border-primary bg-primary/15 font-semibold text-foreground"
                          : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {voice.value} <span className="opacity-60">- {voice.tone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-accent bg-accent/30 px-3 py-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-accent-foreground" />
        <span className="text-xs text-accent-foreground">
          API key access stays on the backend proxy.
        </span>
      </div>

      <Button onClick={handleApply} className="w-full gap-2">
        <Save className="h-4 w-4" />
        Apply Configuration
      </Button>
    </div>
  );

  const renderActionBar = (trigger: ReactNode) => (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Assistant Setup
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {activePersona.label} voice - {voiceName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {hasInstructions ? "Custom instructions ready to apply." : "No custom instructions yet."}
          </p>
        </div>
        {trigger}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {renderActionBar(
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-2">
              <Settings className="h-4 w-4" />
              Configure
            </Button>
          </SheetTrigger>,
        )}
        <SheetContent
          side="bottom"
          className="max-h-[90vh] rounded-t-3xl border-border bg-card px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="px-4 pb-2 pt-2 text-left sm:px-6">
            <SheetTitle className="text-xl font-bold text-foreground">
              Configure Your AI Assistant
            </SheetTitle>
          </SheetHeader>
          {configContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {renderActionBar(
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </Button>
        </DialogTrigger>,
      )}
      <DialogContent className="max-h-[85vh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl border-border bg-card p-0 scrollbar-none animate-slide-down-fade sm:max-w-[540px]">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle className="text-xl font-bold text-foreground">
            Configure Your AI Assistant
          </DialogTitle>
        </DialogHeader>
        {configContent}
      </DialogContent>
    </Dialog>
  );
};

export default ConfigSection;

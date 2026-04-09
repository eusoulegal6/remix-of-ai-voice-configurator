import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useFillerAudio } from "@/hooks/useFillerAudio";
import { useToast } from "@/hooks/use-toast";

const ALL_VOICES = [
  "Kore", "Orus", "Alnilam", "Charon", "Rasalgethi", "Schedar",
  "Pulcherrima", "Gacrux", "Sadaltager", "Achird", "Sulafat", "Puck",
  "Laomedeia", "Callirrhoe", "Umbriel", "Zubenelgenubi", "Vindemiatrix",
  "Achernar", "Sadachbia", "Iapetus", "Erinome",
];

const statusConfig: Record<string, { icon: typeof Clock; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: Clock, label: "Not Generated", variant: "outline" },
  generating: { icon: Loader2, label: "Generating…", variant: "secondary" },
  ready: { icon: CheckCircle2, label: "Ready", variant: "default" },
  failed: { icon: XCircle, label: "Failed", variant: "destructive" },
};

const FillerAudio = () => {
  const [voiceName, setVoiceName] = useState("Kore");
  const { phrases, loading, generatingKeys, generate, generateAll, deleteFiller } =
    useFillerAudio(voiceName);
  const { toast } = useToast();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = (url: string, key: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingKey === key) {
      setPlayingKey(null);
      return;
    }
    const audio = new Audio(url);
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => {
      setPlayingKey(null);
      toast({ title: "Playback Error", description: "Could not play audio.", variant: "destructive" });
    };
    audio.play();
    audioRef.current = audio;
    setPlayingKey(key);
  };

  const handleGenerate = async (phraseKey: string, phraseText: string) => {
    try {
      await generate(phraseKey, phraseText);
      toast({ title: "Generated", description: `"${phraseText}" is ready.` });
    } catch {
      toast({ title: "Error", description: "Generation failed.", variant: "destructive" });
    }
  };

  const handleGenerateAll = async () => {
    toast({ title: "Batch Generation", description: "Generating all missing fillers…" });
    await generateAll();
    toast({ title: "Done", description: "Batch generation complete." });
  };

  const handleDelete = async (phraseKey: string, phraseText: string) => {
    await deleteFiller(phraseKey);
    toast({ title: "Deleted", description: `"${phraseText}" removed.` });
  };

  const readyCount = phrases.filter((p) => p.status === "ready").length;
  const totalCount = phrases.length;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background animate-slide-down-fade">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/demo">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Filler Audio Manager</h1>
            <p className="text-xs text-muted-foreground">
              Generate & manage short filler clips for conversation gaps
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {readyCount}/{totalCount} ready
          </Badge>
        </div>
      </header>

      {/* Controls */}
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              Voice
            </label>
            <Select value={voiceName} onValueChange={setVoiceName}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_VOICES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerateAll}
            disabled={readyCount === totalCount || generatingKeys.size > 0}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generate All Missing
          </Button>
        </div>
      </div>

      {/* Phrase List */}
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-2">
            {phrases.map((phrase) => {
              const sc = statusConfig[phrase.status] ?? statusConfig.pending;
              const StatusIcon = sc.icon;
              const isGenerating = generatingKeys.has(phrase.phrase_key);
              const isPlaying = playingKey === phrase.phrase_key;

              return (
                <Card
                  key={phrase.phrase_key}
                  className="border-border bg-card/60 transition-colors hover:bg-card"
                >
                  <CardContent className="flex items-center gap-3 px-4 py-3">
                    {/* Phrase text */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        "{phrase.phrase_text}"
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {phrase.phrase_key}
                      </p>
                    </div>

                    {/* Status badge */}
                    <Badge variant={sc.variant} className="shrink-0 gap-1 text-[11px]">
                      <StatusIcon
                        className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`}
                      />
                      {sc.label}
                    </Badge>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {phrase.status === "ready" && phrase.audio_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => playAudio(phrase.audio_url!, phrase.phrase_key)}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isGenerating}
                        onClick={() => handleGenerate(phrase.phrase_key, phrase.phrase_text)}
                        title={phrase.status === "ready" ? "Regenerate" : "Generate"}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      {phrase.status === "ready" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(phrase.phrase_key, phrase.phrase_text)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FillerAudio;

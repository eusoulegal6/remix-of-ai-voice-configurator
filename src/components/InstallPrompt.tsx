import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "install-prompt-dismissed";

function isIosSafari(): boolean {
  const userAgent = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(userAgent) && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
}

function isStandaloneMode(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

const InstallPrompt = () => {
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
    setIsInstalled(isStandaloneMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const showIosHint = useMemo(() => isMobile && isIosSafari() && !isStandaloneMode(), [isMobile]);
  const shouldShow = isMobile && !isInstalled && !dismissed && (deferredPrompt !== null || showIosHint);

  const dismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "true");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  if (!shouldShow) return null;

  return (
    <section className="w-full max-w-2xl rounded-xl border border-primary/20 bg-primary/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="rounded-lg bg-primary/15 p-2 text-primary">
            {deferredPrompt ? <Download className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Install for faster mobile access</p>
            {deferredPrompt ? (
              <p className="text-sm text-muted-foreground">
                Install this app to keep it on your home screen and reopen sessions in a standalone window.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                On iPhone, tap <Share2 className="mx-1 inline h-3.5 w-3.5 align-[-1px]" /> then choose
                {" "}Add to Home Screen.
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} className="h-8 w-8 shrink-0">
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss install prompt</span>
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {deferredPrompt ? (
          <Button onClick={() => void handleInstall()} className="gap-2">
            <Download className="h-4 w-4" />
            Install App
          </Button>
        ) : null}
        <Button variant="outline" onClick={dismiss}>
          Maybe Later
        </Button>
      </div>
    </section>
  );
};

export default InstallPrompt;

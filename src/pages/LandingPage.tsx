import { ArrowRight, Phone, PhoneIncoming, Brain, Clock, FileText, BarChart3, Shield, AudioWaveform, Zap, CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Demo", href: "/demo" },
];

const FEATURES = [
  {
    icon: Phone,
    title: "Outbound Sales Calls",
    description: "Proactively reach prospects with persuasive, natural conversations that convert. Your AI never gets rejected — it persists intelligently.",
  },
  {
    icon: PhoneIncoming,
    title: "Inbound Support & Sales",
    description: "Answer every call instantly. Qualify leads, handle objections, and close deals — or resolve support tickets with empathy and speed.",
  },
  {
    icon: Brain,
    title: "Master Persuasion AI",
    description: "Trained on proven sales methodologies from legendary closers. Handles objections, creates urgency, and guides prospects to yes.",
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    description: "No sick days. No holidays. No coffee breaks. Your AI salesperson works around the clock across every timezone.",
  },
  {
    icon: FileText,
    title: "Custom Knowledge Base",
    description: "Upload your sales docs, FAQs, and product info. The AI learns your business and speaks your language.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track every call, conversion, and conversation. Get insights into what's working and optimize your pitch.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption. SOC 2 compliance. Your data and your customers' data is always protected.",
  },
  {
    icon: AudioWaveform,
    title: "Human-Like Voice",
    description: "Ultra-realistic AI voice that sounds natural, empathetic, and persuasive. Callers won't know the difference.",
  },
];

const PRICING_FEATURES = [
  "Unlimited AI sales & support agents",
  "Inbound & outbound calling",
  "Custom knowledge base upload",
  "Real-time call analytics",
  "Human-like AI voice",
  "24/7 availability",
  "CRM integrations",
  "Priority support",
];

const STATS = [
  { value: "24/7", label: "Always On" },
  { value: "$0.15", label: "Per Minute" },
  { value: "∞", label: "Scalability" },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-primary">Salesman.ac</span>
          <div className="hidden items-center gap-8 sm:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  if (link.href.startsWith("/")) {
                    e.preventDefault();
                    navigate(link.href);
                  }
                }}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          <Button
            onClick={() => navigate("/demo")}
            size="sm"
            className="rounded-full px-5"
          >
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 pb-20 pt-24 text-center sm:pt-32 animate-slide-down-fade">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Zap className="h-4 w-4" />
          AI-Powered Sales & Support Calls
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Your AI Salesperson{" "}
          <span className="text-primary">Never Sleeps.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Automated AI calling for inbound & outbound sales and customer support.
          Trained in the persuasion techniques of the world's greatest closers.
          Handles calls 24/7 at a fraction of the cost.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Button
            onClick={() => navigate("/demo")}
            size="lg"
            className="gap-2 rounded-full px-8 text-base"
          >
            <Phone className="h-4 w-4" />
            Try Live Demo
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full px-8 text-base"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >
            View Pricing
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-16 grid w-full max-w-lg grid-cols-3 gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
              <p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-5xl">
              Everything You Need to{" "}
              <span className="text-primary">Close More Deals</span>
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              A complete AI-powered calling platform for sales and customer support teams that demand results.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-base font-bold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-5xl">
              Simple, <span className="text-primary">Transparent</span> Pricing
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              No hidden fees. No contracts. Pay only for what you use.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
              <div className="shrink-0">
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Zap className="h-3 w-3" />
                  Pay As You Go
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-primary sm:text-6xl">$0.15</span>
                  <span className="text-lg text-muted-foreground">/min</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Billed per minute of AI call time. That's it.</p>
                <Button
                  onClick={() => navigate("/demo")}
                  className="mt-6 rounded-full px-6"
                >
                  Get Started Instantly
                </Button>
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                {PRICING_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Rocket className="h-4 w-4" />
          Start in under 5 minutes
        </span>
        <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-5xl">
          Ready to Let AI{" "}
          <span className="text-primary">Close Your Deals?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-muted-foreground sm:text-lg">
          Create your account, upload your sales documents, and let your AI salesperson start making calls. It's that simple.
        </p>
        <Button
          onClick={() => navigate("/demo")}
          size="lg"
          className="mt-10 gap-2 rounded-full px-10 text-base"
        >
          Create Free Account
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required • Start with free minutes • Cancel anytime
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-sm font-bold text-primary">Salesman.ac</span>
          <span className="text-xs text-muted-foreground">
            © 2026 Salesman.ac — AI-Powered Sales & Support
          </span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

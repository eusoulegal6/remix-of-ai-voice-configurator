import { ArrowRight, Code2, Mic, Settings2, Rocket, Globe, Webhook, BarChart3, Shield, Cpu, Zap, CheckCircle2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Demo", href: "/demo" },
];

const FEATURES = [
  {
    icon: Mic,
    title: "Custom Voices",
    description: "Choose from a library of natural-sounding voices or clone your own for a fully branded agent experience.",
  },
  {
    icon: Code2,
    title: "Config-First Design",
    description: "Define agent behavior with a simple config object — system prompts, voice, model, and tools in one place.",
  },
  {
    icon: Cpu,
    title: "Multi-Model Support",
    description: "Swap between Gemini, GPT, and more. Pick the right model for cost, latency, or reasoning needs.",
  },
  {
    icon: Globe,
    title: "Multi-Language",
    description: "Deploy agents that understand and speak 30+ languages with automatic detection and seamless switching.",
  },
  {
    icon: Webhook,
    title: "Webhook Events",
    description: "Get real-time callbacks for call events — transcripts, sentiment, intent, and custom triggers.",
  },
  {
    icon: BarChart3,
    title: "Usage Analytics",
    description: "Track call volume, latency, token usage, and conversation quality from a unified dashboard.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "End-to-end encryption, SOC 2 compliance, and role-based access for production deployments.",
  },
  {
    icon: Settings2,
    title: "Knowledge Injection",
    description: "Upload docs, FAQs, and product data. Your agent learns your domain and answers with authority.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Add Knowledge",
    description: "Paste your company docs, FAQs, support policies, or custom instructions into the knowledge base.",
  },
  {
    step: "02",
    title: "Apply Settings",
    description: "Hit Apply — your agent is configured instantly. The AI model and API key are handled securely for you.",
  },
  {
    step: "03",
    title: "Start Talking",
    description: "Press the mic button and have a live conversation with your agent. Test, iterate, and refine in real time.",
  },
];

const PRICING_FEATURES = [
  "Unlimited voice agents",
  "All voices included",
  "Custom knowledge base",
  "Real-time analytics",
  "Webhook integrations",
  "Multi-language support",
  "99.9% uptime SLA",
  "Priority support",
];

const STATS = [
  { value: "<200ms", label: "Latency" },
  { value: "30+", label: "Languages" },
  { value: "99.9%", label: "Uptime" },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-primary">VoiceBuddy</span>
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
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Terminal className="h-4 w-4" />
          Programmable AI Voice Agents
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Build Voice Agents in{" "}
          <span className="text-primary">Minutes, Not Months.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          A developer-friendly platform for creating, configuring, and deploying
          AI voice agents. Define behavior with config, inject knowledge, and
          scale to thousands of concurrent conversations.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Button
            onClick={() => navigate("/demo")}
            size="lg"
            className="gap-2 rounded-full px-8 text-base"
          >
            <Mic className="h-4 w-4" />
            Try Live Demo
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full px-8 text-base"
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
          >
            See How It Works
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

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-5xl">
              Three Steps to a{" "}
              <span className="text-primary">Live Agent</span>
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              From idea to production in under five minutes.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.step}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/20"
              >
                <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-accent-foreground">
                  Step {step.step}
                </span>
                <h3 className="mb-2 text-xl font-bold">{step.title}</h3>
                <p className="mb-4 text-sm text-muted-foreground">{step.description}</p>
                <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground font-mono">
                  {step.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-5xl">
              Everything to Build{" "}
              <span className="text-primary">Production Agents</span>
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              A complete toolkit for voice AI — from prototyping to enterprise deployment.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
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
              Simple, <span className="text-primary">Pay-As-You-Go</span> Pricing
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              No contracts. No minimums. Scale up or down as you need.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
              <div className="shrink-0">
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Zap className="h-3 w-3" />
                  Usage Based
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-primary sm:text-6xl">$0.08</span>
                  <span className="text-lg text-muted-foreground">/min</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Per minute of voice agent time. No hidden fees.</p>
                <Button
                  onClick={() => navigate("/demo")}
                  className="mt-6 rounded-full px-6"
                >
                  Start Building Free
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
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Rocket className="h-4 w-4" />
          Developer-first platform
        </span>
        <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-5xl">
          Ready to Build Your{" "}
          <span className="text-primary">Voice Agent?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-muted-foreground sm:text-lg">
          Sign up, define your agent config, and deploy to production in minutes.
          Free tier included — no credit card required.
        </p>
        <Button
          onClick={() => navigate("/demo")}
          size="lg"
          className="mt-10 gap-2 rounded-full px-10 text-base"
        >
          Get Started Free
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          Free tier included • No credit card required • Deploy in minutes
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-sm font-bold text-primary">VoiceBuddy</span>
          <span className="text-xs text-muted-foreground">
            © 2026 VoiceBuddy — Programmable AI Voice Agents
          </span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

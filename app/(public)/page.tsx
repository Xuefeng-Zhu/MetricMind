import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Shield,
  Eye,
  LayoutDashboard,
  BarChart3,
  Activity,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

function Navigation() {
  return (
    <nav
      className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold">MetricMind</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#features"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Pricing
          </Link>
          <Link
            href="#docs"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Docs
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="px-6 py-24 text-center md:py-32">
      <div className="mx-auto max-w-7xl">
        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-gray-900">
          AI BI that gives answers you can trust
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-600">
          MetricMind is an AI-first business intelligence platform that lets you
          ask natural-language questions and get governed, transparent answers
          with full citations and SQL traces.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/demo">Watch Demo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: MessageSquare,
    title: "Natural-Language Questions",
    description:
      "Ask questions in plain English and get instant answers powered by AI-generated SQL queries.",
  },
  {
    icon: Shield,
    title: "Governed Metrics",
    description:
      "Define, certify, and enforce consistent metric definitions across your organization.",
  },
  {
    icon: Eye,
    title: "AI Transparency",
    description:
      "Every answer includes SQL traces, confidence scores, citations, and assumptions — nothing hidden.",
  },
  {
    icon: LayoutDashboard,
    title: "Interactive Dashboards",
    description:
      "Save insights to dashboards, visualize trends, and share analyses with your team.",
  },
];

function FeatureCards() {
  return (
    <section id="features" className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          Core Capabilities
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const stats = [
  { value: "30 sec", label: "Avg answer time" },
  { value: "97%", label: "SQL safety" },
  { value: "6.2k", label: "Questions answered" },
];

function StatsSection() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-center gap-16 sm:flex-row">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const pricingPlans = [
  {
    name: "Starter",
    price: "Free",
    description: "For trying MetricMind with a small team.",
    points: ["Demo workspace", "CSV uploads", "Governed answers"],
  },
  {
    name: "Team",
    price: "$49",
    description: "For teams connecting shared data sources.",
    points: ["Shared dashboards", "Metric certification", "Audit logs"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For governed analytics across departments.",
    points: ["Workspace roles", "AI provider controls", "Priority support"],
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          Pricing
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div key={plan.name} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{plan.price}</p>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.points.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const docsLinks = [
  "Connect data sources",
  "Define semantic entities",
  "Certify metrics",
  "Review audit trails",
];

function DocsSection() {
  return (
    <section id="docs" className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-600">
                <BookOpen className="h-4 w-4" />
                Docs
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                Build a governed analytics workspace
              </h2>
              <p className="mt-3 text-gray-600">
                Follow the setup path inside the app: connect data, model it,
                certify metrics, and ask questions with traceable answers.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/signup">Start Setup</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {docsLinks.map((label) => (
              <div key={label} className="rounded-lg border bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-2xl">
          <div className="flex gap-4">
            {/* Sidebar mockup */}
            <div className="hidden w-48 flex-shrink-0 rounded-lg bg-slate-700/50 p-4 md:block">
              <div className="mb-4 h-4 w-24 rounded bg-white/20" />
              <div className="space-y-3">
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-primary/60" />
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/10" />
              </div>
            </div>
            {/* Main content mockup */}
            <div className="flex-1 space-y-4">
              <div className="h-4 w-48 rounded bg-white/20" />
              {/* KPI cards row */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="h-2 w-12 rounded bg-white/20" />
                  <div className="mt-2 h-4 w-16 rounded bg-white/30" />
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="h-2 w-12 rounded bg-white/20" />
                  <div className="mt-2 h-4 w-16 rounded bg-white/30" />
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="h-2 w-12 rounded bg-white/20" />
                  <div className="mt-2 h-4 w-16 rounded bg-white/30" />
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="h-2 w-12 rounded bg-white/20" />
                  <div className="mt-2 h-4 w-16 rounded bg-white/30" />
                </div>
              </div>
              {/* Chart mockup */}
              <div className="rounded-lg bg-white/10 p-4">
                <div className="flex h-32 items-end gap-2">
                  <div className="h-[40%] flex-1 rounded-t bg-primary/40" />
                  <div className="h-[55%] flex-1 rounded-t bg-primary/50" />
                  <div className="h-[45%] flex-1 rounded-t bg-primary/40" />
                  <div className="h-[65%] flex-1 rounded-t bg-primary/60" />
                  <div className="h-[70%] flex-1 rounded-t bg-primary/50" />
                  <div className="h-[60%] flex-1 rounded-t bg-primary/40" />
                  <div className="h-[80%] flex-1 rounded-t bg-primary/70" />
                  <div className="h-[75%] flex-1 rounded-t bg-primary/60" />
                  <div className="h-[85%] flex-1 rounded-t bg-primary/70" />
                  <div className="h-[90%] flex-1 rounded-t bg-primary/80" />
                  <div className="h-[88%] flex-1 rounded-t bg-primary/75" />
                  <div className="h-full flex-1 rounded-t bg-primary/90" />
                </div>
              </div>
              {/* Table mockup */}
              <div className="space-y-2 rounded-lg bg-white/10 p-4">
                <div className="flex gap-4">
                  <div className="h-2 w-20 rounded bg-white/20" />
                  <div className="h-2 w-16 rounded bg-white/20" />
                  <div className="h-2 w-24 rounded bg-white/20" />
                </div>
                <div className="flex gap-4">
                  <div className="h-2 w-20 rounded bg-white/10" />
                  <div className="h-2 w-16 rounded bg-white/10" />
                  <div className="h-2 w-24 rounded bg-white/10" />
                </div>
                <div className="flex gap-4">
                  <div className="h-2 w-20 rounded bg-white/10" />
                  <div className="h-2 w-16 rounded bg-white/10" />
                  <div className="h-2 w-24 rounded bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
            <Activity className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold">MetricMind</span>
        </div>

        <nav className="flex gap-6" aria-label="Footer navigation">
          <Link
            href="#features"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Pricing
          </Link>
          <Link
            href="#docs"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Login
          </Link>
        </nav>

        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} MetricMind. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navigation />
      <main>
        <HeroSection />
        <FeatureCards />
        <StatsSection />
        <PricingSection />
        <DocsSection />
        <ProductPreview />
      </main>
      <Footer />
    </div>
  );
}

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24 text-center md:py-32">
      <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        Ask your data. Trust the answer.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
        MetricMind is an AI-first business intelligence platform that lets you
        ask natural-language questions about your data and get governed,
        transparent answers with full citations and SQL traces.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/signup">Sign Up</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/demo">Try Demo</Link>
        </Button>
      </div>
    </section>
  );
}

const features = [
  {
    title: "Natural-Language Questions",
    description:
      "Ask questions in plain English and get instant answers powered by AI-generated SQL queries.",
  },
  {
    title: "Governed Metrics",
    description:
      "Define, certify, and enforce consistent metric definitions across your organization.",
  },
  {
    title: "AI Transparency",
    description:
      "Every answer includes SQL traces, confidence scores, citations, and assumptions — nothing hidden.",
  },
  {
    title: "Interactive Dashboards",
    description:
      "Save insights to dashboards, visualize trends, and share analyses with your team.",
  },
];

function FeatureCards() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          Core Capabilities
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <CardHeader>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  { step: "1", title: "Connect", description: "Link your data sources or upload CSV files" },
  { step: "2", title: "Model", description: "Define metrics and semantic entities" },
  { step: "3", title: "Ask", description: "Ask questions in natural language" },
  { step: "4", title: "Insight", description: "Get governed answers with full transparency" },
];

function HowItWorksSection() {
  return (
    <section className="bg-muted/50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          How It Works
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <div key={item.title} className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {item.step}
              </div>
              {index < steps.length - 1 && (
                <div className="hidden h-0.5 w-full bg-border lg:block" aria-hidden="true" />
              )}
              <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Ready to unlock your data?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Start asking questions and get transparent, governed answers in
          minutes.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Sign Up</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/demo">Try Demo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} MetricMind. All rights reserved.
        </p>
        <nav className="flex gap-6" aria-label="Footer navigation">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign Up
          </Link>
          <Link
            href="/demo"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Demo
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />
      <FeatureCards />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </main>
  );
}

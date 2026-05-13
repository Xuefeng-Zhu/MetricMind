"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signupSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  workspaceName: z.string().min(1, "Workspace name is required"),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const result = signupSchema.safeParse({ fullName, email, password, workspaceName });

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SignupFormData, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof SignupFormData;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    router.push("/app");
  }

  return (
    <main className="grid min-h-screen grid-cols-[45%_55%]">
      {/* Left branding panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-[#1E293B] p-10 text-white">
        {/* Decorative gradient circles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/10 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <span className="text-xl font-bold">MetricMind</span>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-bold leading-tight">
            AI BI that gives answers you can trust
          </h2>
          <p className="text-lg text-gray-300">
            Transform your data into actionable insights with confidence scores,
            governed metrics, and full transparency.
          </p>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <blockquote className="border-l-2 border-white/30 pl-4">
            <p className="text-sm italic text-gray-300">
              &ldquo;MetricMind transformed how we understand our data. The AI
              answers are remarkably accurate.&rdquo;
            </p>
            <footer className="mt-2 text-sm font-medium text-gray-400">
              — Sarah Chen, VP Analytics
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center bg-white p-10">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500">Get started with MetricMind for your team</p>
          </div>

          {/* SSO Buttons */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-center gap-3"
              type="button"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-3"
              type="button"
            >
              <svg className="h-5 w-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Continue with Microsoft
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">
                or continue with email
              </span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={errors.fullName ? "true" : "false"}
                aria-describedby={errors.fullName ? "fullName-error" : undefined}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-sm text-red-600">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-red-600">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input
                id="workspaceName"
                type="text"
                placeholder="My Company"
                autoComplete="organization"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                aria-invalid={errors.workspaceName ? "true" : "false"}
                aria-describedby={errors.workspaceName ? "workspaceName-error" : undefined}
              />
              {errors.workspaceName && (
                <p id="workspaceName-error" className="text-sm text-red-600">
                  {errors.workspaceName}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

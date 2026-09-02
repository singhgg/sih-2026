"use client";

import { useState } from "react";

const capabilities = [
  "AI-powered detection",
  "Sonar preprocessing",
  "Confidence scoring",
  "Geotagging",
  "Interactive map",
  "Human validation",
  "Automated reporting",
];

export function LandingAuth({
  isAuthPage,
  onAuthenticate,
  onOpenAuth,
  onBackToHero,
}: {
  isAuthPage: boolean;
  onAuthenticate: () => void;
  onOpenAuth: () => void;
  onBackToHero: () => void;
}) {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(63,156,255,0.24),transparent_34%),linear-gradient(135deg,#041b2c_0%,#072d47_18%,#0a2340_50%,#06182a_100%)] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.35)]">
            <span className="text-lg font-bold text-cyan-200">AI</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Marine AI</p>
            <h1 className="text-lg font-semibold text-slate-100">Sonar Intelligence</h1>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm text-slate-200 md:gap-8">
          <a href="#features" className="transition hover:text-cyan-200">Capabilities</a>
          <a href="#workflow" className="transition hover:text-cyan-200">Workflow</a>
          <a href="#about" className="transition hover:text-cyan-200">About</a>
          {!isAuthPage && (
            <button type="button" onClick={onOpenAuth} className="rounded-full border border-cyan-300/35 px-4 py-2 font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/10">
              Login
            </button>
          )}
          {isAuthPage && (
            <button type="button" onClick={onBackToHero} className="rounded-full border border-cyan-300/35 px-4 py-2 font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/10">
              Back to home
            </button>
          )}
        </nav>
      </header>

      <main className={`mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-8 lg:px-10 lg:pb-20 lg:pt-10 ${isAuthPage ? "lg:max-w-xl" : "lg:grid-cols-[1.25fr_0.75fr] lg:pt-10"}`}>
        {!isAuthPage && (
        <section className="pt-6 lg:pt-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.26em] text-cyan-100">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
            Underwater AI detection
          </div>

          <h2 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
            AI-Powered Underwater Marine Debris &amp; Anomaly Detection System
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200/90">
            Using Side Scan Sonar + AI, the platform automatically detects debris, anomalous structures,
            and suspicious underwater objects with probability-based classification and geotagged validation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_45px_rgba(59,130,246,0.5)] transition hover:scale-[1.02]"
            >
              Get Started
            </button>
            <a
              href="#features"
              className="rounded-full border border-cyan-300/35 bg-white/5 px-7 py-3 text-sm font-semibold text-cyan-100 backdrop-blur transition hover:border-cyan-200/70 hover:bg-cyan-400/10"
            >
              Learn More
            </a>
          </div>

          <div id="features" className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item} className="rounded-2xl border border-cyan-300/15 bg-slate-900/30 p-4 backdrop-blur-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
                  <span className="text-base">◉</span>
                </div>
                <p className="text-sm font-medium text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </section>
        )}
        {isAuthPage && (
        <aside className="rounded-[28px] border border-cyan-300/20 bg-slate-950/40 p-6 shadow-[0_0_30px_rgba(14,165,233,0.18)] backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Secure access</p>
              <h3 className="mt-2 text-2xl font-bold text-white">{isSignUp ? "Create Account" : "Marine Ops Portal"}</h3>
            </div>
            <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-200">
              Live
            </div>
          </div>

          <div className="space-y-4">
            {isSignUp ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-200">Name</span>
                  <input defaultValue="Ava Morgan" className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-300/70" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-200">Email</span>
                  <input defaultValue="ava@marine.ai" className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-300/70" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-200">Password</span>
                  <input type="password" defaultValue="marine123" className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/70" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-200">Confirm Password</span>
                  <input type="password" defaultValue="marine123" className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/70" />
                </label>
                <button type="button" onClick={onAuthenticate} className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_35px_rgba(45,212,191,0.35)]">
                  Create Account
                </button>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-200">Email</span>
                  <input defaultValue="operator@marine.ai" className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-300/70" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-200">Password</span>
                  <input type="password" defaultValue="marine123" className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/70" />
                </label>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="accent-cyan-400" />
                    Remember me
                  </label>
                  <button type="button" className="text-cyan-200 hover:text-cyan-100">Forgot password?</button>
                </div>
                <button type="button" onClick={onAuthenticate} className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_35px_rgba(45,212,191,0.35)]">
                  Login
                </button>
              </>
            )}

            <div className="pt-2 text-center text-sm text-slate-400">
              {isSignUp ? "Already have an account?" : "New to the platform?"}{" "}
              <button type="button" onClick={() => setIsSignUp((current) => !current)} className="font-medium text-cyan-200 hover:text-cyan-100">
                {isSignUp ? "Login" : "Sign Up"}
              </button>
            </div>
          </div>
        </aside>
        )}
      </main>

      {!isAuthPage && <section id="workflow" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            "Upload Sonar Data",
            "AI Processing & Prediction",
            "Human Validation & Reporting",
          ].map((step, index) => (
            <div key={step} className="rounded-2xl border border-cyan-300/15 bg-slate-900/35 p-5 backdrop-blur-sm">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-200">
                0{index + 1}
              </div>
              <p className="text-lg font-semibold text-white">{step}</p>
              <p className="mt-2 text-sm text-slate-300">
                {index === 0 && "Capture, validate, and securely ingest sonar survey files."}
                {index === 1 && "Preprocess sonar frames and score anomaly probabilities."}
                {index === 2 && "Review detections, generate reports, and document decisions."}
              </p>
            </div>
          ))}
        </div>
      </section>}
    </div>
  );
}

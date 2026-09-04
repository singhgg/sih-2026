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
  onOpenSetup,
}: {
  isAuthPage: boolean;
  onAuthenticate: (email?: string, name?: string) => void;
  onOpenAuth: () => void;
  onBackToHero: () => void;
  onOpenSetup?: () => void;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("operator@marine.ai");
  const [password, setPassword] = useState("marine123");
  const [name, setName] = useState("Ava Morgan");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      if (onOpenSetup) {
        onOpenSetup();
      } else {
        onAuthenticate(email, name);
      }
    } else {
      onAuthenticate(email, name);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <span className="text-lg font-black text-slate-950">AI</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400 font-mono">Marine AI</p>
            <h1 className="text-lg font-bold text-white tracking-wide">Sonar Intelligence</h1>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm text-slate-400 md:gap-8">
          <a href="#features" className="transition hover:text-cyan-400">Capabilities</a>
          <a href="#workflow" className="transition hover:text-cyan-400">Workflow</a>
          <a href="#about" className="transition hover:text-cyan-400">About</a>
          {!isAuthPage && (
            <button 
              type="button" 
              onClick={onOpenAuth} 
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:text-white cursor-pointer"
            >
              Login
            </button>
          )}
          {isAuthPage && (
            <button 
              type="button" 
              onClick={onBackToHero} 
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:text-white cursor-pointer"
            >
              Back to home
            </button>
          )}
        </nav>
      </header>

      <main className={`mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-8 lg:px-10 lg:pb-20 lg:pt-10 ${isAuthPage ? "lg:max-w-xl" : "lg:grid-cols-[1.25fr_0.75fr] lg:pt-10"}`}>
        {!isAuthPage && (
        <section className="pt-6 lg:pt-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-[0.26em] text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-pulse" />
            Underwater AI detection
          </div>

          <h2 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
            AI-Powered Underwater Marine Debris &amp; Anomaly Detection System
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Using Side Scan Sonar + AI, the platform automatically detects debris, anomalous structures,
            and suspicious underwater objects with probability-based classification and geotagged validation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] cursor-pointer"
            >
              Get Started
            </button>
            <a
              href="#features"
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-7 py-3 text-sm font-semibold text-slate-300 backdrop-blur transition hover:border-slate-600 hover:text-white"
            >
              Learn More
            </a>
          </div>

          <div id="features" className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                  <span className="text-base font-bold">◉</span>
                </div>
                <p className="text-sm font-semibold text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </section>
        )}
        {isAuthPage && (
        <aside className="rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono">Secure access</p>
              <h3 className="mt-2 text-2xl font-bold text-white tracking-wide">{isSignUp ? "Create Account" : "Marine Ops Portal"}</h3>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
              Live
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300 uppercase tracking-wider">Name</span>
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500" 
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300 uppercase tracking-wider">Email</span>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500" 
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300 uppercase tracking-wider">Password</span>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500" 
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300 uppercase tracking-wider">Confirm Password</span>
                  <input 
                    type="password" 
                    defaultValue="marine123" 
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500" 
                  />
                </label>
                <button 
                  type="submit" 
                  className="mt-2 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 cursor-pointer transition"
                >
                  Create Account &amp; Proceed to Setup
                </button>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300 uppercase tracking-wider">Email</span>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500" 
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300 uppercase tracking-wider">Password</span>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500" 
                  />
                </label>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-cyan-400" />
                    Remember me
                  </label>
                  <button type="button" className="text-cyan-400 hover:text-cyan-300">Forgot password?</button>
                </div>
                <button 
                  type="submit" 
                  className="mt-2 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 cursor-pointer transition"
                >
                  Login
                </button>
              </>
            )}

            <div className="pt-2 text-center text-sm text-slate-400">
              {isSignUp ? "Already have an account?" : "New to the platform?"}{" "}
              <button 
                type="button" 
                onClick={() => setIsSignUp((current) => !current)} 
                className="font-bold text-cyan-400 hover:text-cyan-300 transition"
              >
                {isSignUp ? "Login" : "Sign Up"}
              </button>
            </div>
          </form>
        </aside>
        )}
      </main>

      {!isAuthPage && (
        <section id="workflow" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              "Upload Sonar Data",
              "AI Processing & Prediction",
              "Human Validation & Reporting",
            ].map((step, index) => (
              <div key={step} className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur shadow-sm">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-mono font-bold text-cyan-400">
                  0{index + 1}
                </div>
                <p className="text-lg font-bold text-white">{step}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {index === 0 && "Capture, validate, and securely ingest sonar survey files."}
                  {index === 1 && "Preprocess sonar frames and score anomaly probabilities."}
                  {index === 2 && "Review detections, generate reports, and document decisions."}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

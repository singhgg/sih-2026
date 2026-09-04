"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSetupProfile } from "@/lib/auth";

export default function SetupPage() {
  const router = useRouter();

  const [draft, setDraft] = useState({
    surveyName: "Marine Zone Survey",
    date: "2026-08-29",
    time: "10:30",
    description: "Underwater debris inspection across marine zone corridor.",
    area: "North Reef Sector",
    fileName: "zone-a-reef-01.sss",
    fileType: "Side Scan Sonar",
    size: "18.4 MB",
    metadata: {
      gpsAvailable: true,
      timestampAvailable: true,
      depthAvailable: true,
    },
  });

  const [validationState, setValidationState] = useState<"Accepted" | "Pending" | "Error">("Accepted");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [surveyId] = useState("SSS-20260904-482");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const supportedTypes = [".sss", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".s7k"];
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (!supportedTypes.includes(`.${extension}`)) {
      setValidationState("Error");
      setUploadError("Unsupported file format. Please upload a valid Side Scan Sonar image or sonar data file.");
      return;
    }

    if (file.size <= 0) {
      setValidationState("Error");
      setUploadError("Empty file detected. Please replace the file and retry.");
      return;
    }

    if (file.size > 35 * 1024 * 1024) {
      setValidationState("Error");
      setUploadError("File too large. Please upload a sonar file under 35 MB.");
      return;
    }

    setDraft((existing) => ({
      ...existing,
      fileName: file.name,
      fileType: "Side Scan Sonar",
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    }));

    setValidationState("Accepted");
    setUploadError(null);
  };

  const handleValidation = () => {
    const hasGps = draft.metadata.gpsAvailable;
    const hasTimestamp = draft.metadata.timestampAvailable;
    const hasDepth = draft.metadata.depthAvailable;

    if (!hasGps || !hasTimestamp || !hasDepth) {
      setValidationState("Pending");
      setUploadError("Pending: GPS, timestamp, and depth metadata are required before analysis can begin.");
      return;
    }

    setValidationState("Accepted");
    setUploadError(null);
  };

  const handleSubmitSurvey = () => {
    if (validationState === "Error") {
      setUploadError("Processing stopped because validation failed. Please fix the file or metadata and retry.");
      return;
    }

    if (validationState === "Pending") {
      setUploadError("Submission is pending because required metadata is still missing.");
      return;
    }

    saveSetupProfile({
      surveyArea: draft.area,
      setupCompleted: true,
    });

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <span className="text-lg font-black text-slate-950">AI</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400 font-mono">Mission Onboarding</p>
            <h1 className="text-lg font-bold text-white tracking-wide">Operator Setup &amp; Calibration</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition cursor-pointer"
          >
            Switch Account
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-mono">System Configuration</p>
          <h2 className="text-3xl font-black text-white mt-1">Initial Mission &amp; Sonar Setup</h2>
          <p className="text-sm text-slate-400 mt-1">Configure your sonar ingest parameters and validate mission sensors before accessing AquaScan.</p>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur shadow-xl">
            <h3 className="text-xl font-bold text-white tracking-wide">Upload Sonar Data</h3>
            <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center hover:border-cyan-500/60 transition">
              <p className="text-3xl text-cyan-400 font-mono">⇪</p>
              <p className="mt-4 text-lg font-bold text-white">Drag &amp; drop sonar files here</p>
              <p className="mt-2 text-xs text-slate-400">Supports .sss, .png, .jpg, .tif, .tiff and .s7k</p>
              <label className="mt-5 inline-flex cursor-pointer rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition">
                Select Sonar File
                <input type="file" className="hidden" onChange={handleFileChange} />
              </label>
              {draft.fileName && (
                <p className="mt-3 text-xs font-mono text-cyan-400">Selected: {draft.fileName} ({draft.size})</p>
              )}
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="mb-2 block">Survey Name</span>
                  <input
                    value={draft.surveyName}
                    onChange={(event) => setDraft((current) => ({ ...current, surveyName: event.target.value }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="mb-2 block">Survey Area</span>
                  <input
                    value={draft.area}
                    onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="mb-2 block">Date</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="mb-2 block">Time</span>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                <span className="mb-2 block">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur shadow-xl">
            <h3 className="text-xl font-bold text-white tracking-wide">Validation Outcomes</h3>
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-400 font-mono">Auto-generated Survey ID</p>
                <p className="mt-2 text-2xl font-black font-mono text-white">{surveyId}</p>
                <p className="mt-2 text-xs text-slate-400">This survey ID will be retained across processing, AI detections, geotagging, and reporting.</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">File validation</p>
                <div className="mt-3 space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex items-center justify-between"><span>Supported format</span><span className="text-emerald-400 font-bold">✓</span></div>
                  <div className="flex items-center justify-between"><span>File size</span><span className="text-emerald-400 font-bold">✓</span></div>
                  <div className="flex items-center justify-between"><span>GPS metadata</span><span className={draft.metadata.gpsAvailable ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{draft.metadata.gpsAvailable ? "✓" : "Pending"}</span></div>
                  <div className="flex items-center justify-between"><span>Timestamp</span><span className={draft.metadata.timestampAvailable ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{draft.metadata.timestampAvailable ? "✓" : "Pending"}</span></div>
                  <div className="flex items-center justify-between"><span>Depth metadata</span><span className={draft.metadata.depthAvailable ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{draft.metadata.depthAvailable ? "✓" : "Pending"}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Validation status</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-[0.2em] ${
                    validationState === "Accepted"
                      ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                      : validationState === "Pending"
                        ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                        : "border border-rose-500/30 bg-rose-500/20 text-rose-400"
                  }`}>
                    {validationState}
                  </span>
                </div>
                {uploadError && <p className="mt-3 text-xs text-rose-400 font-semibold">{uploadError}</p>}
              </div>

              <div className="flex flex-col gap-3 md:flex-row pt-2">
                <button
                  type="button"
                  onClick={handleValidation}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-200 hover:border-slate-600 hover:text-white transition cursor-pointer"
                >
                  Validate Data
                </button>
                <button
                  type="button"
                  onClick={handleSubmitSurvey}
                  className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-3 text-xs font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Complete Setup &amp; Launch Dashboard ✓
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

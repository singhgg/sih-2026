"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createSurveyFromDraft,
  demoSurveys,
  type Detection,
  type Survey,
  type SurveyDraft,
  generateSurveyId,
} from "@/lib/surveyData";

type ViewName = "dashboard" | "upload" | "results" | "map" | "analytics" | "reports" | "settings";

const navItems: Array<{ id: ViewName; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard / My Surveys", icon: "◫" },
  { id: "upload", label: "Create / Upload Survey", icon: "⇪" },
  { id: "results", label: "Results", icon: "▣" },
  { id: "map", label: "Map", icon: "◌" },
  { id: "analytics", label: "Analytics", icon: "◔" },
  { id: "reports", label: "Reports", icon: "▤" },
  { id: "settings", label: "Profile / Settings", icon: "⚙" },
];

const defaultDraft: SurveyDraft = {
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
};

function toConfidenceLabel(value: number): "High" | "Medium" | "Low" {
  if (value >= 80) return "High";
  if (value >= 60) return "Medium";
  return "Low";
}

function formatPrediction(prediction: { label: string; value: number; possibleOutcome?: string }) {
  const confidence = toConfidenceLabel(prediction.value);
  return `${prediction.label} — ${prediction.value}% ${confidence}`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function SurveyDashboard({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
  onCreateSurvey,
  onSurveysChange,
}: {
  surveys: Survey[];
  selectedSurveyId: string | null;
  onSelectSurvey: (id: string) => void;
  onCreateSurvey: (draft: SurveyDraft, survey?: Survey) => void;
  onSurveysChange: (surveys: Survey[]) => void;
}) {
  const [activeView, setActiveView] = useState<ViewName>("dashboard");
  const [draft, setDraft] = useState<SurveyDraft>(defaultDraft);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<"Accepted" | "Pending" | "Error">("Accepted");
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [reportFormats, setReportFormats] = useState<("PDF" | "CSV" | "JSON")[]>(["PDF", "CSV", "JSON"]);

  const currentSurvey = useMemo(() => {
    if (!selectedSurveyId) return surveys[0] ?? demoSurveys[0];
    return surveys.find((survey) => survey.id === selectedSurveyId) ?? surveys[0] ?? demoSurveys[0];
  }, [selectedSurveyId, surveys]);

  const selectedDetection = useMemo(() => {
    const detections = currentSurvey?.detections ?? [];
    return detections.find((detection) => detection.id === selectedDetectionId) ?? detections[0] ?? null;
  }, [currentSurvey, selectedDetectionId]);

  useEffect(() => {
    if (!currentSurvey || currentSurvey.status !== "Processing") return;

    const interval = setInterval(() => {
      onSurveysChange(
        surveys.map((survey) => {
          if (survey.id !== currentSurvey.id) return survey;

          const nextProgress = Math.min(survey.progress + 8, 100);
          const stages = survey.processingStages.map((stage, index) => {
            if (stage.name === "AI Analysis") {
              return { ...stage, complete: nextProgress >= 100, active: nextProgress < 100 };
            }
            return { ...stage, complete: true, active: false };
          });

          const isCompleted = nextProgress >= 100;

          return {
            ...survey,
            progress: nextProgress,
            processingStages: stages,
            status: isCompleted ? "Completed" : "Processing",
            metrics: isCompleted
              ? { ...survey.metrics, highConfidence: Math.max(2, survey.metrics.highConfidence), processingTime: "12 min 08 sec" }
              : survey.metrics,
            validation: {
              ...survey.validation,
              state: isCompleted ? "Accepted" : survey.validation.state,
            },
            report: isCompleted ? { ...survey.report, generated: true } : survey.report,
            processingHistory: isCompleted
              ? [...survey.processingHistory, "Analysis complete and evidence reviewed"]
              : survey.processingHistory,
          };
        }),
      );
    }, 1300);

    return () => clearInterval(interval);
  }, [currentSurvey, surveys, onSurveysChange]);

  const updateSurveyStatus = (surveyId: string, nextStatus: Survey["status"], nextProgress: number) => {
    onSurveysChange(
      surveys.map((survey) => {
        if (survey.id !== surveyId) return survey;
        return {
          ...survey,
          status: nextStatus,
          progress: nextProgress,
          processingStages: survey.processingStages.map((stage, index) => ({
            ...stage,
            complete: nextProgress >= 20 + index * 12,
            active: nextStatus === "Processing" && index === 6,
          })),
        };
      }),
    );
  };

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

    const newSurvey = createSurveyFromDraft(draft);
    onCreateSurvey(draft, newSurvey);
    onSelectSurvey(newSurvey.id);
    setActiveView("results");
    setValidationState("Accepted");
    setDraft(defaultDraft);
  };

  const handleReportDownload = (type: "PDF" | "CSV" | "JSON") => {
    const reportPayload = {
      surveyId: currentSurvey.id,
      surveyName: currentSurvey.name,
      date: currentSurvey.date,
      detections: currentSurvey.detections,
      validations: currentSurvey.detections.map((detection) => ({
        detectionId: detection.id,
        status: detection.status,
      })),
    };

    if (type === "CSV") {
      const rows = [
        ["surveyId", "detectionId", "prediction", "confidence"],
        ...currentSurvey.detections.flatMap((detection) =>
          detection.predictions.map((prediction) => [
            currentSurvey.id,
            detection.id,
            prediction.label,
            `${prediction.value}%`,
          ]),
        ),
      ];
      const csv = rows.map((row) => row.join(",")).join("\n");
      downloadFile(csv, `${currentSurvey.id}-report.csv`, "text/csv;charset=utf-8");
    } else if (type === "JSON") {
      downloadFile(JSON.stringify(reportPayload, null, 2), `${currentSurvey.id}-report.json`, "application/json;charset=utf-8");
    } else {
      const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 66 >>\nstream\nBT /F1 18 Tf 72 720 Td (${currentSurvey.name}) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000122 00000 n \n0000000259 00000 n \n0000000740 00000 n \ntrailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n813\n%%EOF`;
      downloadFile(pdfContent, `${currentSurvey.id}-report.pdf`, "application/pdf;charset=utf-8");
    }

    onSurveysChange(
      surveys.map((survey) =>
        survey.id === currentSurvey.id
          ? {
              ...survey,
              report: {
                generated: true,
                format: type,
                createdAt: new Date().toLocaleString(),
              },
            }
          : survey,
      ),
    );
  };

  const totalHighPercent = Math.round((currentSurvey.metrics.highConfidence / Math.max(currentSurvey.metrics.detections, 1)) * 100);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,78,128,0.3),transparent_28%),linear-gradient(90deg,#020d1d_0%,#041d33_28%,#062744_100%)] text-white">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-5 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[28px] border border-cyan-300/15 bg-slate-950/45 p-4 shadow-[0_0_30px_rgba(28,145,255,0.12)] backdrop-blur-xl lg:block">
          <div className="mb-6 flex items-center gap-3 px-2 pt-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
              <span className="text-lg">AI</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/80">Marine</p>
              <p className="text-base font-semibold text-slate-100">Sonar AI</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${
                  activeView === item.id
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white ring-1 ring-cyan-300/30"
                    : "text-slate-300 hover:bg-slate-900/70 hover:text-white"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-cyan-200">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200">Current Survey</p>
            <p className="mt-3 text-lg font-semibold text-white">{currentSurvey.id}</p>
            <p className="mt-1 text-sm text-slate-300">{currentSurvey.status}</p>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <header className="flex flex-col gap-4 rounded-[26px] border border-cyan-300/15 bg-slate-950/40 p-4 shadow-[0_0_30px_rgba(14,165,233,0.10)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">Operations Console</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Underwater Debris Intelligence Suite</h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
                Survey ID: {currentSurvey.id}
              </div>
              <button
                type="button"
                onClick={() => setActiveView("upload")}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
              >
                + New Survey / Upload Sonar Data
              </button>
            </div>
          </header>

          {activeView === "dashboard" && (
            <div className="space-y-6">
              <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">My Surveys</h3>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
                      {surveys.length} Active
                    </span>
                  </div>

                  <div className="space-y-4">
                    {surveys.map((survey) => (
                      <button
                        key={survey.id}
                        type="button"
                        onClick={() => {
                          onSelectSurvey(survey.id);
                          setActiveView("results");
                        }}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          survey.id === currentSurvey.id
                            ? "border-cyan-300/45 bg-cyan-500/10"
                            : "border-slate-700/70 bg-slate-900/30 hover:border-cyan-300/25"
                        }`}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">{survey.id}</p>
                            <h4 className="mt-2 text-lg font-semibold text-white">{survey.name}</h4>
                          </div>
                          <div className="flex gap-2">
                            <span className="rounded-full border border-cyan-300/20 bg-blue-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                              {survey.status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-4">
                          <div><span className="text-slate-400">Date</span><p>{survey.date}</p></div>
                          <div><span className="text-slate-400">Time</span><p>{survey.time}</p></div>
                          <div><span className="text-slate-400">Detections</span><p>{survey.metrics.detections}</p></div>
                          <div><span className="text-slate-400">Results</span><p>{survey.status === "Completed" ? "Ready" : survey.status === "Processing" ? "In progress" : "Pending"}</p></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                  <h3 className="text-xl font-bold text-white">Processing Overview</h3>
                  <div className="mt-5 space-y-4">
                    {currentSurvey.processingStages.map((stage) => (
                      <div key={stage.name} className="flex items-center gap-3">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${stage.complete ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-300"}`}>
                          {stage.complete ? "✓" : "•"}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{stage.name}</p>
                          <div className="mt-1 h-2 rounded-full bg-slate-800">
                            <div className={`h-full rounded-full ${stage.complete ? "w-full bg-gradient-to-r from-emerald-400 to-cyan-400" : "w-0 bg-cyan-400"}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Overall Progress</span>
                      <span className="text-sm font-medium text-cyan-200">{currentSurvey.progress}%</span>
                    </div>
                    <div className="mt-3 h-2.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${currentSurvey.progress}%` }} />
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Status: {currentSurvey.status}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Detection Summary</h3>
                  <span className="text-sm text-slate-400">AI review board</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {currentSurvey.detections.map((detection) => (
                    <button
                      key={detection.id}
                      type="button"
                      onClick={() => setSelectedDetectionId(detection.id)}
                      className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4 text-left transition hover:border-cyan-300/30"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{detection.id}</p>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                          {detection.status}
                        </span>
                      </div>
                      <p className="mt-4 text-lg font-semibold text-white">{detection.highestPrediction}</p>
                      <p className="mt-2 text-sm text-slate-300">Confidence: {detection.confidence}</p>
                      <div className="mt-3 space-y-1 text-xs text-slate-400">
                        {detection.predictions.map((prediction) => (
                          <div key={prediction.label} className="flex justify-between gap-2">
                            <span>{prediction.label}</span>
                            <span>{prediction.value}%</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeView === "upload" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white">Upload Sonar Data</h3>
                <div className="mt-5 rounded-[26px] border border-dashed border-cyan-300/30 bg-slate-900/50 p-8 text-center">
                  <p className="text-3xl text-cyan-200">⇪</p>
                  <p className="mt-4 text-lg font-semibold text-white">Drag &amp; drop sonar files here</p>
                  <p className="mt-2 text-sm text-slate-400">Supports .sss, .png, .jpg, .tif, .tiff and .s7k</p>
                  <label className="mt-5 inline-flex cursor-pointer rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-slate-950">
                    Select Sonar File
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Survey Name</span>
                      <input
                        value={draft.surveyName}
                        onChange={(event) => setDraft((current) => ({ ...current, surveyName: event.target.value }))}
                        className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
                      />
                    </label>
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Survey Area</span>
                      <input
                        value={draft.area}
                        onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value }))}
                        className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
                      />
                    </label>
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Date</span>
                      <input
                        type="date"
                        value={draft.date}
                        onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                        className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
                      />
                    </label>
                    <label className="block text-sm text-slate-200">
                      <span className="mb-2 block">Time</span>
                      <input
                        type="time"
                        value={draft.time}
                        onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                        className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-slate-200">
                    <span className="mb-2 block">Description</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      rows={4}
                      className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300/60"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white">Validation Outcomes</h3>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-cyan-300/15 bg-slate-900/40 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Auto-generated Survey ID</p>
                    <p className="mt-3 text-2xl font-bold text-white">{generateSurveyId()}</p>
                    <p className="mt-2 text-sm text-slate-400">This survey ID will be retained across processing, AI detections, geotagging, and reporting.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                    <p className="text-sm font-medium text-slate-200">File validation</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                      <div className="flex items-center justify-between"><span>Supported format</span><span className="text-emerald-300">✓</span></div>
                      <div className="flex items-center justify-between"><span>File size</span><span className="text-emerald-300">✓</span></div>
                      <div className="flex items-center justify-between"><span>GPS metadata</span><span className={draft.metadata.gpsAvailable ? "text-emerald-300" : "text-amber-300"}>{draft.metadata.gpsAvailable ? "✓" : "Pending"}</span></div>
                      <div className="flex items-center justify-between"><span>Timestamp</span><span className={draft.metadata.timestampAvailable ? "text-emerald-300" : "text-amber-300"}>{draft.metadata.timestampAvailable ? "✓" : "Pending"}</span></div>
                      <div className="flex items-center justify-between"><span>Depth metadata</span><span className={draft.metadata.depthAvailable ? "text-emerald-300" : "text-amber-300"}>{draft.metadata.depthAvailable ? "✓" : "Pending"}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                    <p className="text-sm font-medium text-slate-200">Validation status</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs uppercase tracking-[0.2em] ${
                        validationState === "Accepted"
                          ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : validationState === "Pending"
                            ? "border border-amber-400/30 bg-amber-500/10 text-amber-200"
                            : "border border-red-400/30 bg-red-500/10 text-red-200"
                      }`}>
                        {validationState}
                      </span>
                    </div>
                    {uploadError && <p className="mt-3 text-sm text-red-200">{uploadError}</p>}
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      type="button"
                      onClick={handleValidation}
                      className="flex-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200"
                    >
                      Validate Data
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitSurvey}
                      className="flex-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950"
                    >
                      Survey Submitted Successfully ✓
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === "results" && (
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200">Results dashboard</p>
                    <h3 className="mt-2 text-2xl font-bold text-white">{currentSurvey.name}</h3>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
                    {currentSurvey.id}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total area processed</p>
                    <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.metrics.totalArea}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Objects detected</p>
                    <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.metrics.detections}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">High confidence %</p>
                    <p className="mt-3 text-2xl font-bold text-white">{totalHighPercent}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Processing time</p>
                    <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.metrics.processingTime}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-slate-900/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-white">AI Detection Results</h4>
                    <span className="text-sm text-slate-400">Probability distribution</span>
                  </div>

                  <div className="space-y-4">
                    {currentSurvey.detections.map((detection) => (
                      <button
                        key={detection.id}
                        type="button"
                        onClick={() => setSelectedDetectionId(detection.id)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-left transition hover:border-cyan-300/25"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{detection.id}</p>
                            <p className="mt-2 text-lg font-semibold text-white">{detection.highestPrediction}</p>
                          </div>
                          <div className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                            {detection.confidence} Confidence
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {detection.predictions.map((prediction) => (
                            <div key={`${detection.id}-${prediction.label}`}>
                              <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                                <span>{prediction.label}</span>
                                <span>{prediction.value}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                                  style={{ width: `${prediction.value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white">Detection Details</h3>

                {selectedDetection && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Detection ID</p>
                      <h4 className="mt-2 text-2xl font-bold text-white">{selectedDetection.id}</h4>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AI Predictions</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        {selectedDetection.predictions.map((prediction) => (
                          <div key={prediction.label} className="flex items-center justify-between">
                            <span>{prediction.label}</span>
                            <span>{prediction.value}%</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-sm text-cyan-200">Highest prediction: {selectedDetection.highestPrediction}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Confidence</p>
                        <p className="mt-2 text-lg font-semibold text-white">{selectedDetection.confidence}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Validation</p>
                        <p className="mt-2 text-lg font-semibold text-white">{selectedDetection.status}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-200">
                      <p>GPS: {selectedDetection.lat.toFixed(4)} / {selectedDetection.lon.toFixed(4)}</p>
                      <p>Depth: {selectedDetection.depth}m</p>
                      <p>Timestamp: {selectedDetection.timestamp}</p>
                      <p>Frame: {selectedDetection.frame}</p>
                      <p>Survey ID: {currentSurvey.id}</p>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" className="flex-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200">
                        ✓ Confirm Detection
                      </button>
                      <button type="button" className="flex-1 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200">
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === "map" && (
            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Interactive Map</h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-cyan-200">Survey track + hotspots</span>
                </div>

                <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-cyan-300/15 bg-[radial-gradient(circle_at_center,_rgba(96,165,250,0.18),_rgba(3,7,18,0.72)_60%)]">
                  <svg viewBox="0 0 600 420" className="h-full w-full">
                    <g opacity="0.28" stroke="#67e8f9" strokeWidth="1">
                      {[...Array(12)].map((_, index) => (
                        <line key={`v-${index}`} x1={index * 50} x2={index * 50} y1="0" y2="420" />
                      ))}
                      {[...Array(9)].map((_, index) => (
                        <line key={`h-${index}`} x1="0" x2="600" y1={index * 50} y2={index * 50} />
                      ))}
                    </g>

                    <path d="M40 280 C120 230, 190 250, 260 210 S430 100, 560 165" fill="none" stroke="#a5f3fc" strokeWidth="3" strokeDasharray="9 10" />
                    <circle cx="190" cy="250" r="26" fill="rgba(34,211,238,0.14)" />
                    <circle cx="360" cy="170" r="34" fill="rgba(59,130,246,0.14)" />
                    <circle cx="480" cy="150" r="22" fill="rgba(34,211,238,0.14)" />

                    {currentSurvey.detections.map((detection) => {
                      const x = 110 + detection.lon * 1200;
                      const y = 320 - detection.lat * 1200;
                      return (
                        <g key={detection.id} onClick={() => setSelectedDetectionId(detection.id)} style={{ cursor: "pointer" }}>
                          <circle cx={x} cy={y} r={detection.status === "Confirmed" ? 14 : 10} fill={detection.status === "Rejected" ? "#f87171" : detection.status === "Confirmed" ? "#34d399" : "#7dd3fc"}  />
                          <circle cx={x} cy={y} r={detection.status === "Confirmed" ? 22 : 16} fill="rgba(125, 211, 252, 0.18)" />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white">Geotagged Detection</h3>
                {selectedDetection && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200">{selectedDetection.id}</p>
                      <h4 className="mt-2 text-xl font-semibold text-white">Type: {selectedDetection.highestPrediction}</h4>
                    </div>
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-200">
                      <div className="flex justify-between"><span>Latitude</span><span>{selectedDetection.lat.toFixed(4)}</span></div>
                      <div className="mt-2 flex justify-between"><span>Longitude</span><span>{selectedDetection.lon.toFixed(4)}</span></div>
                      <div className="mt-2 flex justify-between"><span>Depth</span><span>{selectedDetection.depth}m</span></div>
                      <div className="mt-2 flex justify-between"><span>Timestamp</span><span>{selectedDetection.timestamp}</span></div>
                      <div className="mt-2 flex justify-between"><span>Frame</span><span>{selectedDetection.frame}</span></div>
                      <div className="mt-2 flex justify-between"><span>Survey ID</span><span>{currentSurvey.id}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === "analytics" && (
            <section className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Analytics Overview</h3>
                <span className="text-sm text-slate-400">Survey statistics & confidence analysis</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total area surveyed</p>
                  <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.metrics.totalArea}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sonar data processed</p>
                  <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.metrics.totalSonarData}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Processing time</p>
                  <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.metrics.processingTime}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hotspots</p>
                  <p className="mt-3 text-2xl font-bold text-white">{currentSurvey.analytics.hotspots}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="mb-4 text-lg font-semibold text-white">Confidence Statistics</p>
                  <div className="space-y-4">
                    {[
                      { label: "High-confidence detections", value: currentSurvey.metrics.highConfidence },
                      { label: "Medium-confidence detections", value: currentSurvey.metrics.mediumConfidence },
                      { label: "Low-confidence detections", value: currentSurvey.metrics.lowConfidence },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.min(item.value * 34, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="mb-4 text-lg font-semibold text-white">Detection Categories</p>
                  <div className="space-y-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between"><span>Marine debris</span><span>{currentSurvey.analytics.debrisCount}</span></div>
                    <div className="flex items-center justify-between"><span>Fishing nets</span><span>{currentSurvey.analytics.fishingNetCount}</span></div>
                    <div className="flex items-center justify-between"><span>Unknown anomalies</span><span>{currentSurvey.analytics.unknownAnomalies}</span></div>
                    <div className="flex items-center justify-between"><span>Total anomalies</span><span>{currentSurvey.analytics.totalAnomalies}</span></div>
                    <div className="flex items-center justify-between"><span>Coverage</span><span>{currentSurvey.analytics.surveyCoverage}</span></div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === "reports" && (
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Report Generation</h3>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
                    {currentSurvey.report.generated ? "Generated" : "Ready"}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Survey Details</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="flex justify-between"><span>Survey ID</span><span>{currentSurvey.id}</span></div>
                      <div className="flex justify-between"><span>Survey Area</span><span>{currentSurvey.area}</span></div>
                      <div className="flex justify-between"><span>Date</span><span>{currentSurvey.date}</span></div>
                      <div className="flex justify-between"><span>Data Processed</span><span>{currentSurvey.metrics.totalSonarData}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Detection Summary</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="flex justify-between"><span>Total detections</span><span>{currentSurvey.metrics.detections}</span></div>
                      <div className="flex justify-between"><span>High confidence</span><span>{currentSurvey.metrics.highConfidence}</span></div>
                      <div className="flex justify-between"><span>Medium confidence</span><span>{currentSurvey.metrics.mediumConfidence}</span></div>
                      <div className="flex justify-between"><span>Low confidence</span><span>{currentSurvey.metrics.lowConfidence}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visual Evidence</p>
                    <div className="mt-3 flex gap-3">
                      <div className="h-20 flex-1 rounded-xl bg-[radial-gradient(circle,_rgba(59,130,246,0.4),_rgba(15,23,42,0.9)_60%)]" />
                      <div className="h-20 flex-1 rounded-xl bg-[radial-gradient(circle,_rgba(34,211,238,0.28),_rgba(15,23,42,0.9)_60%)]" />
                      <div className="h-20 flex-1 rounded-xl bg-[radial-gradient(circle,_rgba(96,165,250,0.36),_rgba(15,23,42,0.9)_60%)]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white">Download</h3>
                <div className="mt-5 space-y-4">
                  <button
                    type="button"
                    onClick={() => handleReportDownload("PDF")}
                    className="w-full rounded-full border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200"
                  >
                    Generate Report
                  </button>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    {reportFormats.map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => handleReportDownload(format)}
                        className="rounded-xl border border-slate-700 bg-slate-900/30 px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-300/30"
                      >
                        Download {format}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    {currentSurvey.report.generated
                      ? `Report generated successfully ✓ for ${currentSurvey.id}`
                      : "Generate report to create evidence package and audit trail."}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === "settings" && (
            <section className="rounded-[28px] border border-cyan-300/15 bg-slate-950/40 p-5 backdrop-blur-xl">
              <h3 className="text-xl font-bold text-white">Profile / Settings</h3>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Operator</p>
                  <p className="mt-3 text-xl font-semibold text-white">Marine Research Analyst</p>
                  <p className="mt-2 text-sm text-slate-300">operator@marine.ai</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">System mode</p>
                  <p className="mt-3 text-xl font-semibold text-white">AI + Human Validation</p>
                  <p className="mt-2 text-sm text-slate-300">Processing, validation, and report generation active.</p>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

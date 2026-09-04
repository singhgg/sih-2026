"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Edit3, 
  Filter, 
  Target, 
  Save
} from 'lucide-react';
import { apiService } from '@/services/api';

// Subcomponent: Extracts and renders a high-res image crop of the anomaly
function AnomalyCropCanvas({ imageUrl, bbox, width = 140, height = 140 }: { imageUrl: string | null; bbox: any; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!imageUrl || !bbox) {
      // Fallback synthetic acoustic crop preview
      ctx.fillStyle = "#091726";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
      for (let i = 0; i < canvas.height; i += 6) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255, 204, 0, 0.7)";
      ctx.fillRect(canvas.width * 0.25, canvas.height * 0.25, canvas.width * 0.5, canvas.height * 0.4);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.strokeRect(canvas.width * 0.2, canvas.height * 0.2, canvas.width * 0.6, canvas.height * 0.5);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const padW = bbox.w * 0.35;
      const padH = bbox.h * 0.35;

      const sx = Math.max(0, bbox.x - bbox.w / 2 - padW);
      const sy = Math.max(0, bbox.y - bbox.h / 2 - padH);
      const sw = Math.min(img.width - sx, bbox.w + padW * 2);
      const sh = Math.min(img.height - sy, bbox.h + padH * 2);

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      const targetScreenX = ((bbox.x - bbox.w / 2 - sx) / sw) * canvas.width;
      const targetScreenY = ((bbox.y - bbox.h / 2 - sy) / sh) * canvas.height;
      const targetScreenW = (bbox.w / sw) * canvas.width;
      const targetScreenH = (bbox.h / sh) * canvas.height;

      ctx.strokeRect(targetScreenX, targetScreenY, targetScreenW, targetScreenH);
    };
  }, [imageUrl, bbox]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-black/60 shadow-inner flex items-center justify-center">
      <canvas ref={canvasRef} width={width} height={height} className="w-full h-full object-cover" />
      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-mono text-cyan-400">
        SSS Crop
      </div>
    </div>
  );
}

interface TriagePortalProps {
  scanData: any;
  onUpdateDetection: (id: number, status: string, notes: string | null) => void;
  onSelectDetection: (det: any) => void;
  selectedDetection: any;
}

export default function TriagePortal({ 
  scanData, 
  onUpdateDetection, 
  onSelectDetection,
  selectedDetection 
}: TriagePortalProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [analystNotes, setAnalystNotes] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (scanData?.detections) {
      const initialNotes: Record<number, string> = {};
      scanData.detections.forEach((d: any) => {
        initialNotes[d.id] = d.analyst_notes || '';
      });
      setAnalystNotes(initialNotes);
    }
  }, [scanData]);

  if (!scanData || !scanData.detections || scanData.detections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-xl border border-slate-800">
        <Target className="w-12 h-12 text-slate-600 mb-3" />
        <h3 className="text-lg font-bold text-slate-300">No Acoustic Anomalies Detected</h3>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          Select or upload a sonar scan from the mission control dashboard to begin AI triage.
        </p>
      </div>
    );
  }

  const imageUrl = apiService.getFullImageUrl(scanData.processed_image_url || scanData.raw_image_url);

  const approvedCount = scanData.detections.filter((d: any) => d.validation_status === 'approved').length;
  const rejectedCount = scanData.detections.filter((d: any) => d.validation_status === 'rejected').length;
  const pendingCount = scanData.detections.filter((d: any) => !d.validation_status || d.validation_status === 'pending').length;

  const filteredDetections = scanData.detections.filter((d: any) => {
    const statusMatch = 
      activeFilter === 'all' ? true :
      activeFilter === 'pending' ? (!d.validation_status || d.validation_status === 'pending') :
      d.validation_status === activeFilter;

    const classMatch = classFilter === 'all' ? true : d.class_name === classFilter;
    const priorityMatch = priorityFilter === 'all' ? true : d.priority === priorityFilter;

    return statusMatch && classMatch && priorityMatch;
  });

  const handleTriageAction = async (detId: number, newStatus: string) => {
    setUpdatingId(detId);
    try {
      const notes = analystNotes[detId] || null;
      await apiService.verifyDetection(detId, newStatus, notes);
      if (onUpdateDetection) {
        onUpdateDetection(detId, newStatus, notes);
      }
    } catch (err) {
      console.error("Triage action failed:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (detId: number) => {
    setUpdatingId(detId);
    try {
      const det = scanData.detections.find((d: any) => d.id === detId);
      const currentStatus = det?.validation_status || 'pending';
      const notes = analystNotes[detId] || '';
      await apiService.verifyDetection(detId, currentStatus, notes);
      if (onUpdateDetection) {
        onUpdateDetection(detId, currentStatus, notes);
      }
    } catch (err) {
      console.error("Failed to save analyst notes:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Triage Header & Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-base">Analyst Anomaly Triage Portal</h3>
              {scanData.is_synthetic ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SYNTHETIC DEMONSTRATION
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  REAL SSS ANALYSIS
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Multi-signal validation, acoustic shadow verification, and triage confirmation.
            </p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'all' 
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20' 
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Targets ({scanData.detections.length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'pending' 
                ? 'bg-amber-500 text-slate-950' 
                : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({pendingCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('approved')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'approved' 
                ? 'bg-emerald-500 text-slate-950' 
                : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Confirmed ({approvedCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('rejected')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === 'rejected' 
                ? 'bg-rose-500 text-slate-950' 
                : 'bg-slate-800 text-rose-400 hover:bg-slate-700'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>False Positives ({rejectedCount})</span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Class:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Classes</option>
              <option value="shipwreck">Shipwreck</option>
              <option value="pipe">Pipe / Conduit</option>
              <option value="debris">Marine Debris</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Target Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-1 flex-1">
        {filteredDetections.map((det: any) => {
          const isSelected = selectedDetection?.id === det.id;
          const isUpdating = updatingId === det.id;

          let statusBadge = (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-3 h-3" />
              <span>Pending</span>
            </span>
          );
          if (det.validation_status === 'approved') {
            statusBadge = (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" />
                <span>Confirmed</span>
              </span>
            );
          } else if (det.validation_status === 'rejected') {
            statusBadge = (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <XCircle className="w-3 h-3" />
                <span>False Positive</span>
              </span>
            );
          }

          let priorityBadge = (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              LOW
            </span>
          );
          if (det.priority === 'HIGH') {
            priorityBadge = (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                HIGH PRIORITY
              </span>
            );
          } else if (det.priority === 'MEDIUM') {
            priorityBadge = (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                MED PRIORITY
              </span>
            );
          }

          let reasonsList: string[] = [];
          if (det.priority_reasons) {
            try {
              if (Array.isArray(det.priority_reasons)) {
                reasonsList = det.priority_reasons;
              } else if (typeof det.priority_reasons === 'string') {
                reasonsList = det.priority_reasons.startsWith('[') 
                  ? JSON.parse(det.priority_reasons) 
                  : [det.priority_reasons];
              }
            } catch {
              reasonsList = [det.priority_reasons];
            }
          }

          return (
            <div
              key={det.id}
              onClick={() => onSelectDetection(det)}
              className={`flex flex-col bg-slate-900/80 backdrop-blur rounded-xl border p-4 transition-all cursor-pointer ${
                isSelected 
                  ? 'border-cyan-500 ring-2 ring-cyan-500/20 shadow-lg shadow-cyan-500/10' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="font-bold text-white text-sm capitalize">
                        {det.class_name} #{det.id}
                      </h4>
                      {priorityBadge}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">ID: DET-{det.id.toString().padStart(4, '0')}</span>
                  </div>
                </div>
                {statusBadge}
              </div>

              {/* Middle Section: Crop & Multi-Signal Telemetry */}
              <div className="flex space-x-3 mb-3">
                <div className="w-28 h-28 flex-shrink-0">
                  <AnomalyCropCanvas
                    imageUrl={imageUrl}
                    bbox={{ x: det.bbox_x, y: det.bbox_y, w: det.bbox_w, h: det.bbox_h }}
                    width={112}
                    height={112}
                  />
                </div>

                <div className="flex-1 space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Anomaly Score:</span>
                    <span className={`font-bold ${det.confidence > 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {det.confidence.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Model Conf:</span>
                    <span className="text-slate-300">
                      {det.model_confidence ? `${det.model_confidence.toFixed(1)}%` : `${det.confidence.toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Shadow Height:</span>
                    <span className="text-cyan-400 font-semibold">
                      {det.est_height ? `${det.est_height.toFixed(1)} m` : 'Flat / Low Relief'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Physical Size:</span>
                    <span className="text-slate-300">
                      {det.est_length ? `${det.est_length.toFixed(1)}m × ${det.est_width?.toFixed(1)}m` : 'Unavailable'}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                    {det.latitude && det.longitude ? (
                      <div>
                        GPS: {det.latitude.toFixed(5)}°, {det.longitude.toFixed(5)}°
                        {det.geo_uncertainty_m && (
                          <span className="text-slate-500 ml-1">(±{det.geo_uncertainty_m}m)</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 italic">GPS: Unavailable</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Explainable Reasons */}
              {reasonsList.length > 0 && (
                <div className="mb-2 p-1.5 bg-slate-950/60 rounded border border-slate-800/80">
                  <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Detection Evidence:
                  </div>
                  <ul className="text-[10px] text-slate-400 space-y-0.5 list-disc list-inside">
                    {reasonsList.slice(0, 2).map((r, idx) => (
                      <li key={idx} className="truncate">{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analyst Notes Field */}
              <div className="mt-auto pt-2 border-t border-slate-800/80">
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <Edit3 className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Analyst Notes</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={analystNotes[det.id] || ''}
                    onChange={(e) => {
                      e.stopPropagation();
                      setAnalystNotes({ ...analystNotes, [det.id]: e.target.value });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Enter observation notes..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveNotes(det.id);
                    }}
                    disabled={isUpdating}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                    title="Save Notes"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriageAction(det.id, 'approved');
                  }}
                  disabled={isUpdating || det.validation_status === 'approved'}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                    det.validation_status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{det.validation_status === 'approved' ? 'Confirmed' : 'Confirm'}</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriageAction(det.id, 'rejected');
                  }}
                  disabled={isUpdating || det.validation_status === 'rejected'}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                    det.validation_status === 'rejected'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-default'
                      : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{det.validation_status === 'rejected' ? 'Rejected' : 'Reject (FP)'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

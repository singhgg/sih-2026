"use client";

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  FileCode, 
  Download, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  ArrowUpDown,
  AlertTriangle
} from 'lucide-react';
import { apiService } from '@/services/api';

interface ReportsViewProps {
  scanData: any;
}

export default function ReportsView({ scanData }: ReportsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('confidence');
  const [sortAsc, setSortAsc] = useState(false);

  if (!scanData || !scanData.detections) {
    return (
      <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
        <p className="text-slate-400">Select a mission to generate intelligence reports.</p>
      </div>
    );
  }

  const detections = scanData.detections;
  const totalCount = detections.length;
  const approvedCount = detections.filter((d: any) => d.validation_status === 'approved').length;
  const rejectedCount = detections.filter((d: any) => d.validation_status === 'rejected').length;

  const highPriority = detections.filter((d: any) => d.priority === 'HIGH').length;

  const avgConfidence = totalCount > 0 
    ? (detections.reduce((sum: number, d: any) => sum + d.confidence, 0) / totalCount).toFixed(1)
    : 0;

  // Sorting and Filtering
  const filtered = detections.filter((d: any) => {
    const term = searchTerm.toLowerCase();
    return (
      d.class_name.toLowerCase().includes(term) ||
      (d.priority && d.priority.toLowerCase().includes(term)) ||
      d.validation_status.toLowerCase().includes(term) ||
      (d.analyst_notes && d.analyst_notes.toLowerCase().includes(term)) ||
      d.id.toString().includes(term)
    );
  });

  filtered.sort((a: any, b: any) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleDownload = (format: string) => {
    if (format === 'csv') {
      const rows = [
        ["Detection ID", "Scan ID", "Class", "Priority", "Score (%)", "Latitude", "Longitude", "Status", "Notes"],
        ...detections.map((d: any) => [
          d.id,
          d.scan_id || scanData.scan_id,
          d.class_name,
          d.priority || 'MEDIUM',
          d.confidence,
          d.latitude || '',
          d.longitude || '',
          d.validation_status,
          `"${(d.analyst_notes || '').replace(/"/g, '""')}"`
        ])
      ];
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `mission_${scanData.scan_id}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (format === 'json') {
      const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scanData, null, 2));
      const link = document.createElement("a");
      link.setAttribute("href", jsonContent);
      link.setAttribute("download", `mission_${scanData.scan_id}_report.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const url = apiService.getExportUrl(scanData.scan_id, format);
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Top Mission Header & Export Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-white tracking-wide">
              Mission Intelligence Summary: {scanData.file_name}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              ID: SCAN-{scanData.scan_id}
            </span>
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
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Swath: {scanData.swath_range_m}m | Targets Detected: {totalCount} | Analyzed: {new Date(scanData.upload_timestamp).toLocaleString()}
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => handleDownload('csv')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleDownload('json')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <FileCode className="w-4 h-4" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={() => handleDownload('geojson')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export GeoJSON</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 backdrop-blur p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Targets</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Avg Score: {avgConfidence}%</div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>High Priority</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{highPriority}</div>
          <div className="text-[11px] text-slate-500 mt-1">Urgent Review</div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Confirmed Targets</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{approvedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Approved by Analyst</div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>False Positives</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{rejectedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Rejected by Analyst</div>
        </div>
      </div>

      {/* Structured Target Table */}
      <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search targets by class, status, or analyst notes..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">Showing {filtered.length} targets</span>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>
                  <div className="flex items-center space-x-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('class_name')}>
                  <div className="flex items-center space-x-1">
                    <span>Class</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('confidence')}>
                  <div className="flex items-center space-x-1">
                    <span>Score</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Dimensions (L×W×H)</th>
                <th className="py-3 px-3">Geotag & Uncertainty</th>
                <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('validation_status')}>
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Analyst Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filtered.map((d: any) => (
                <tr key={d.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-bold text-cyan-400">#{d.id}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      d.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      d.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {d.priority || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold capitalize text-white">{d.class_name}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      d.confidence >= 75 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {d.confidence.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {d.est_length ? `${d.est_length.toFixed(1)}m × ${d.est_width?.toFixed(1)}m` : 'Unavailable'}
                    {d.est_height ? <span className="text-cyan-400"> × {d.est_height.toFixed(1)}m</span> : ''}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {d.latitude && d.longitude ? (
                      <span>
                        {d.latitude.toFixed(5)}°, {d.longitude.toFixed(5)}°
                        {d.geo_uncertainty_m ? <span className="text-slate-500 ml-1">(±{d.geo_uncertainty_m}m)</span> : ''}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Unavailable</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      d.validation_status === 'approved' 
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : d.validation_status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {d.validation_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 italic max-w-xs truncate">
                    {d.analyst_notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

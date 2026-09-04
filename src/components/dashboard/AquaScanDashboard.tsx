"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { 
  Radar, 
  UploadCloud, 
  FileImage, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Database, 
  Activity, 
  Loader2, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  FileSpreadsheet, 
  Trash2, 
  Play, 
  Sliders, 
  LogOut,
  User,
  Compass
} from 'lucide-react';
import { apiService } from '@/services/api';
import { logoutUser, getAuthSession } from '@/lib/auth';
import WaterfallCanvas from './WaterfallCanvas';
import TriagePortal from './TriagePortal';
import ReportsView from './ReportsView';

// Dynamic import for Leaflet GIS Map to avoid SSR window errors
const SonarMap = dynamic(() => import('./SonarMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-800">
      <Compass className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
      <p className="text-sm text-slate-400">Loading Geospatial Sonar Map...</p>
    </div>
  )
});

export default function AquaScanDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'waterfall' | 'triage' | 'reports' | 'upload'>('waterfall');

  // Backend & Scans state
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [scans, setScans] = useState<any[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [currentScanData, setCurrentScanData] = useState<any>(null);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  // Upload Form State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: string; text: string } | null>(null);

  // Anomaly Selection & Filters
  const [selectedDetection, setSelectedDetection] = useState<any>(null);
  const [filterClass, setFilterClass] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);

  // User Profile
  const [userProfile, setUserProfile] = useState<any>(null);

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (message: string, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const session = getAuthSession();
    setUserProfile(session);
    checkHealth();
    loadScans();
  }, []);

  useEffect(() => {
    if (selectedScanId) {
      loadScanVisualization(selectedScanId);
    }
  }, [selectedScanId]);

  const checkHealth = async () => {
    try {
      await apiService.checkHealth();
      setBackendStatus('online');
    } catch {
      setBackendStatus('offline');
    }
  };

  const loadScans = async () => {
    try {
      const data = await apiService.getScans();
      setScans(data);
      if (data.length > 0 && !selectedScanId) {
        setSelectedScanId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load scans:", error);
    }
  };

  const loadScanVisualization = async (scanId: number) => {
    setIsLoadingScan(true);
    setSelectedDetection(null);
    try {
      const data = await apiService.getScanVisualization(scanId);
      setCurrentScanData(data);
    } catch (error) {
      console.error("Failed to load scan visualization:", error);
      showToast("Failed to load scan visualization details.", "error");
    } finally {
      setIsLoadingScan(false);
    }
  };

  const handleGenerateDemo = async () => {
    setIsGeneratingDemo(true);
    try {
      showToast("Synthesizing realistic Monterey Bay sonar dataset & running AI inference...", "info");
      const result = await apiService.generateDemoScan();
      await loadScans();
      setSelectedScanId(result.scan_id);
      setActiveTab('waterfall');
      showToast("Demo survey mission generated and analyzed with AI!", "success");
    } catch (error) {
      console.error("Demo generation failed:", error);
      showToast("Failed to generate demo mission.", "error");
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setUploadMessage({ type: 'error', text: 'A Side-Scan Sonar image file is required.' });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const result = await apiService.uploadScan(imageFile, metadataFile);
      setImageFile(null);
      setMetadataFile(null);
      setUploadMessage({ type: 'success', text: 'Scan uploaded and AI analysis complete!' });
      await loadScans();
      setSelectedScanId(result.scan_id);
      setActiveTab('waterfall');
      showToast("Sonar scan uploaded & analyzed successfully.", "success");
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadMessage({ type: 'error', text: error.message || 'Upload failed.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteScan = async (scanId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this sonar scan mission?")) return;

    try {
      await apiService.deleteScan(scanId);
      const remaining = scans.filter(s => s.id !== scanId);
      setScans(remaining);
      if (selectedScanId === scanId) {
        if (remaining.length > 0) {
          setSelectedScanId(remaining[0].id);
        } else {
          setSelectedScanId(null);
          setCurrentScanData(null);
        }
      }
      showToast("Mission deleted successfully.", "info");
    } catch (error) {
      console.error("Failed to delete scan:", error);
      showToast("Failed to delete scan.", "error");
    }
  };

  const handleUpdateDetection = (detectionId: number, newStatus: string, notes: string | null) => {
    if (currentScanData && currentScanData.detections) {
      const updated = currentScanData.detections.map((d: any) => {
        if (d.id === detectionId) {
          return { ...d, validation_status: newStatus, analyst_notes: notes };
        }
        return d;
      });
      setCurrentScanData({ ...currentScanData, detections: updated });
      showToast(`Target #${detectionId} updated to ${newStatus}.`, "success");
    }
  };

  const handleLogout = () => {
    logoutUser();
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border backdrop-blur shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10' :
          toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-500/40' :
          'bg-cyan-950/90 text-cyan-300 border-cyan-500/40'
        }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Tactical Navigation Bar */}
      <header className="h-14 px-4 sm:px-5 bg-slate-900/95 border-b border-slate-800 backdrop-blur z-30 flex items-center justify-between gap-3 overflow-hidden select-none">
        {/* Left: Branding */}
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 flex-shrink-0">
            <Radar className="w-4 h-4 text-slate-950 animate-spin-slow" />
            <div className="absolute inset-0 rounded-xl border border-cyan-300/40"></div>
          </div>
          <div className="flex items-center space-x-1.5">
            <h1 className="text-sm font-black tracking-wider text-white">AQUASCAN</h1>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              v2.0 PRO
            </span>
          </div>
        </div>

        {/* Center: Mission Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-xl border border-slate-800 flex-shrink-0">
          <button
            onClick={() => setActiveTab('waterfall')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'waterfall'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Waterfall &amp; GIS</span>
          </button>

          <button
            onClick={() => setActiveTab('triage')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'triage'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Target Triage</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'triage' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-800 text-cyan-400'
            }`}>
              {currentScanData?.detections?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Reports &amp; Export</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Upload Mission</span>
          </button>
        </div>

        {/* Right: Mission Selector, Quick Demo, Status & Auth User */}
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          {/* Scan Selector Dropdown */}
          {scans.length > 0 && (
            <select
              value={selectedScanId || ''}
              onChange={(e) => setSelectedScanId(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer max-w-[190px] xl:max-w-[230px] truncate"
              title="Select Active Sonar Mission"
            >
              {scans.map(s => (
                <option key={s.id} value={s.id}>
                  {s.is_synthetic ? '[DEMO] ' : '[REAL] '}{s.file_name} ({s.detection_count || 0} targets)
                </option>
              ))}
            </select>
          )}

          {/* 1-Click Generate Demo Button */}
          <button
            onClick={handleGenerateDemo}
            disabled={isGeneratingDemo}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-extrabold rounded-lg shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex-shrink-0"
          >
            {isGeneratingDemo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Demo Mission</span>
          </button>

          {/* Status Indicator */}
          <div className="flex items-center space-x-1.5 px-2 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span className="text-slate-400">{backendStatus.toUpperCase()}</span>
          </div>

          {/* User Profile & Sign Out */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800 flex-shrink-0">
            <div className="hidden 2xl:flex items-center space-x-1.5 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-[11px] truncate max-w-[90px]">{userProfile?.name || 'Operator'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-700/50 text-slate-300 text-xs font-semibold transition cursor-pointer whitespace-nowrap flex-shrink-0"
              title="Sign Out to Login"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-hidden p-4">
        {/* Tab 1: Split Screen Waterfall Canvas + GIS Map */}
        {activeTab === 'waterfall' && (
          <div className="flex flex-col h-full space-y-3">
            {/* Filter Sub-bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400">Class Filter:</span>
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono cursor-pointer"
                  >
                    <option value="all">All Anomalies</option>
                    <option value="shipwreck">Shipwrecks</option>
                    <option value="pipe">Pipelines</option>
                    <option value="debris">Debris</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Min Conf:</span>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="5"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="w-24 accent-cyan-400 cursor-pointer"
                  />
                  <span className="font-mono text-cyan-400 min-w-[30px]">{minConfidence}%</span>
                </div>
              </div>

              {currentScanData && (
                <div className="flex items-center space-x-4 text-slate-400 font-mono text-[11px]">
                  <span>Survey Width: <strong className="text-white">{currentScanData.swath_range_m}m</strong></span>
                  <span>Detected Targets: <strong className="text-cyan-400">{currentScanData.detections?.length || 0}</strong></span>
                </div>
              )}
            </div>

            {/* Split Screen Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100%-48px)]">
              {/* Left 7 Columns: Waterfall Canvas Viewer */}
              <div className="lg:col-span-7 h-full">
                {currentScanData ? (
                  <WaterfallCanvas
                    scanData={currentScanData}
                    selectedDetection={selectedDetection}
                    onSelectDetection={setSelectedDetection}
                    filterClass={filterClass}
                    minConfidence={minConfidence}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-800">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                    <p className="text-sm text-slate-400">Loading Sonar Mission...</p>
                  </div>
                )}
              </div>

              {/* Right 5 Columns: Interactive Leaflet Sonar GIS Map */}
              <div className="lg:col-span-5 h-full">
                {currentScanData ? (
                  <SonarMap
                    scanData={currentScanData}
                    selectedDetection={selectedDetection}
                    onSelectDetection={setSelectedDetection}
                    filterClass={filterClass}
                    minConfidence={minConfidence}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-800">
                    <Compass className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">Awaiting Geospatial Coordinates...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Triage Portal */}
        {activeTab === 'triage' && (
          <div className="h-full">
            <TriagePortal
              scanData={currentScanData}
              onUpdateDetection={handleUpdateDetection}
              onSelectDetection={setSelectedDetection}
              selectedDetection={selectedDetection}
            />
          </div>
        )}

        {/* Tab 3: Reports & Export */}
        {activeTab === 'reports' && (
          <div className="h-full">
            <ReportsView scanData={currentScanData} />
          </div>
        )}

        {/* Tab 4: Upload Mission & Scan Registry */}
        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-y-auto pr-2">
            {/* Upload Dropzone Form */}
            <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-800">
                  <UploadCloud className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white text-base">Upload Side-Scan Sonar Mission</h3>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                  {/* Sonar Image Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      1. Sonar Waterfall Image (Required)
                    </label>
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-950/60 cursor-pointer transition">
                      <FileImage className="w-8 h-8 text-slate-500 mb-2" />
                      <span className="text-xs text-slate-300 font-medium">
                        {imageFile ? imageFile.name : "Click or drag Sonar Strip (.png, .jpg, .tiff)"}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Max file size: 50MB</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/tiff"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setImageFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Navigation CSV Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      2. Navigation Telemetry Log (Optional CSV)
                    </label>
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-950/60 cursor-pointer transition">
                      <FileText className="w-6 h-6 text-slate-500 mb-1.5" />
                      <span className="text-xs text-slate-300 font-medium">
                        {metadataFile ? metadataFile.name : "Click or drag GPS telemetry log (.csv)"}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Columns: ping, lat, lon, heading, altitude, speed</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setMetadataFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {uploadMessage && (
                    <div className={`p-3 rounded-lg text-xs font-semibold ${
                      uploadMessage.type === 'error' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {uploadMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUploading || !imageFile}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Running AI Processing Pipeline...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Upload & Run AI Detection</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 text-center">
                <span className="text-xs text-slate-400">Don&apos;t have a sonar file handy?</span>
                <button
                  onClick={handleGenerateDemo}
                  disabled={isGeneratingDemo}
                  className="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Synthetic Demo Mission (Monterey Bay)</span>
                </button>
              </div>
            </div>

            {/* Mission Registry List */}
            <div className="lg:col-span-7 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white text-base">Mission Registry & Database</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">{scans.length} Scans Ingested</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {scans.map(s => {
                  const isSelected = selectedScanId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedScanId(s.id);
                        setActiveTab('waterfall');
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                        isSelected 
                          ? 'bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-500/10' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400">
                          <Radar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-white text-sm">{s.file_name}</h4>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                              SCAN-{s.id}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {new Date(s.upload_timestamp).toLocaleDateString()} | Targets: {s.detection_count || 0}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {s.status}
                        </span>

                        <button
                          onClick={(e) => handleDeleteScan(s.id, e)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                          title="Delete Mission"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

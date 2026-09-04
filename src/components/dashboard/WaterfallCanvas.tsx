"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Layers, 
  Target, 
  Eye, 
  EyeOff
} from 'lucide-react';
import { apiService } from '@/services/api';

interface WaterfallCanvasProps {
  scanData: any;
  selectedDetection: any;
  onSelectDetection: (det: any) => void;
  filterClass?: string;
  minConfidence?: number;
}

export default function WaterfallCanvas({ 
  scanData, 
  selectedDetection, 
  onSelectDetection,
  filterClass = 'all',
  minConfidence = 0
}: WaterfallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [useProcessed, setUseProcessed] = useState(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showNadir, setShowNadir] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredDetection, setHoveredDetection] = useState<any>(null);
  const [cursorCoord, setCursorCoord] = useState<{ x: number; y: number; slantRange: string; channel: string } | null>(null);

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load Image when URL or mode changes
  useEffect(() => {
    if (!scanData) return;
    const url = useProcessed && scanData.processed_image_url 
      ? apiService.getFullImageUrl(scanData.processed_image_url)
      : apiService.getFullImageUrl(scanData.raw_image_url);

    if (!url) {
      // Create synthetic sonar waterfall background for offline demo mode
      const dummyCanvas = document.createElement("canvas");
      dummyCanvas.width = 1024;
      dummyCanvas.height = 2048;
      const ctx = dummyCanvas.getContext("2d");
      if (ctx) {
        // Deep water acoustic backscatter gradient
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, "#081b29");
        grad.addColorStop(0.46, "#1b384f");
        grad.addColorStop(0.5, "#03080e"); // Nadir dead zone
        grad.addColorStop(0.54, "#1b384f");
        grad.addColorStop(1, "#081b29");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 2048);

        // Acoustic seafloor ripples
        ctx.fillStyle = "rgba(6, 182, 212, 0.04)";
        for (let i = 0; i < 2048; i += 8) {
          const jitter = Math.sin(i * 0.05) * 6;
          ctx.fillRect(40 + jitter, i, 944, 2);
        }
        
        // Target acoustic highlights
        if (scanData.detections) {
          scanData.detections.forEach((d: any) => {
            ctx.fillStyle = "rgba(255, 204, 0, 0.4)";
            ctx.fillRect(d.bbox_x - d.bbox_w / 2, d.bbox_y - d.bbox_h / 2, d.bbox_w, d.bbox_h);
            // Shadow
            ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
            ctx.fillRect(d.bbox_x + d.bbox_w / 2, d.bbox_y - d.bbox_h / 2, d.bbox_w * 1.2, d.bbox_h);
          });
        }
      }

      const img = new Image();
      img.src = dummyCanvas.toDataURL();
      img.onload = () => {
        setImageObj(img);
        setImageLoaded(true);
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth;
          const initialZoom = Math.min(1.0, (containerWidth - 40) / img.width);
          setZoom(initialZoom);
          setPan({ 
            x: (containerWidth - img.width * initialZoom) / 2, 
            y: 20 
          });
        }
      };
      return;
    }

    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      setImageObj(img);
      setImageLoaded(true);
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const initialZoom = Math.min(1.0, (containerWidth - 40) / img.width);
        setZoom(initialZoom);
        setPan({ 
          x: (containerWidth - img.width * initialZoom) / 2, 
          y: 20 
        });
      }
    };
    img.onerror = () => {
      console.error("Failed to load sonar image:", url);
    };
  }, [scanData, useProcessed]);

  // Center on selected detection
  useEffect(() => {
    if (selectedDetection && imageObj && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      const targetX = selectedDetection.bbox_x * zoom;
      const targetY = selectedDetection.bbox_y * zoom;

      setPan({
        x: containerWidth / 2 - targetX,
        y: containerHeight / 2 - targetY
      });
    }
  }, [selectedDetection]);

  // Main Canvas Rendering Loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj || !imageLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw Sonar Waterfall Image
    ctx.drawImage(imageObj, 0, 0);

    const imgW = imageObj.width;
    const imgH = imageObj.height;
    const centerX = imgW / 2;

    // Draw Center Nadir Trackline
    if (showNadir) {
      const nadirWidth = imgW * 0.08;
      ctx.fillStyle = "rgba(0, 240, 255, 0.06)";
      ctx.fillRect(centerX - nadirWidth / 2, 0, nadirWidth, imgH);

      ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, imgH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(0, 240, 255, 0.8)";
      ctx.font = `bold ${Math.max(14, 18 / zoom)}px monospace`;
      ctx.fillText("◀ PORT CHANNEL", 20, 35);
      ctx.fillText("STARBOARD CHANNEL ▶", imgW - 220, 35);
    }

    // Distance Grid Lines
    if (showGrid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1 / zoom;
      ctx.font = `${Math.max(10, 12 / zoom)}px monospace`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";

      for (let y = 200; y < imgH; y += 200) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(imgW, y);
        ctx.stroke();
        ctx.fillText(`Ping #${y}`, 10, y - 5);
      }

      const swath = scanData?.swath_range_m || 100;
      const quarterW = imgW / 4;
      const markers = [
        { x: quarterW, label: `-${(swath / 2).toFixed(0)}m` },
        { x: centerX + quarterW, label: `+${(swath / 2).toFixed(0)}m` }
      ];
      markers.forEach(m => {
        ctx.beginPath();
        ctx.moveTo(m.x, 0);
        ctx.lineTo(m.x, imgH);
        ctx.stroke();
        ctx.fillText(m.label, m.x + 5, 20);
      });
    }

    // Draw Anomaly Bounding Boxes
    if (showBoundingBoxes && scanData?.detections) {
      scanData.detections.forEach((det: any) => {
        if (filterClass !== 'all' && det.class_name !== filterClass) return;
        if (det.confidence < minConfidence) return;

        const isSelected = selectedDetection?.id === det.id;
        const isHovered = hoveredDetection?.id === det.id;

        const x = det.bbox_x - det.bbox_w / 2;
        const y = det.bbox_y - det.bbox_h / 2;
        const w = det.bbox_w;
        const h = det.bbox_h;

        let boxColor = '#ef4444';
        if (det.confidence >= 75) boxColor = '#10b981';
        else if (det.confidence >= 50) boxColor = '#f59e0b';

        if (det.validation_status === 'approved') boxColor = '#06b6d4';
        if (det.validation_status === 'rejected') boxColor = '#64748b';

        if (isSelected || isHovered) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 / zoom;
          ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
          ctx.fillStyle = "rgba(6, 182, 212, 0.25)";
          ctx.fillRect(x, y, w, h);
        }

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom;
        if (det.validation_status === 'pending') {
          ctx.setLineDash([4 / zoom, 2 / zoom]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        const fontSize = Math.max(11, Math.min(16, 13 / zoom));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const labelText = `${det.class_name.toUpperCase()} ${det.confidence.toFixed(0)}%`;
        const textWidth = ctx.measureText(labelText).width;
        const pillHeight = fontSize + 6 / zoom;
        const pillY = y > pillHeight + 4 ? y - pillHeight - 2 : y + h + 2;

        ctx.fillStyle = boxColor;
        ctx.fillRect(x, pillY, textWidth + 12 / zoom, pillHeight);

        ctx.fillStyle = '#000000';
        ctx.fillText(labelText, x + 6 / zoom, pillY + fontSize);

        if (det.est_length && det.est_width) {
          const dimText = `${det.est_length.toFixed(1)}m × ${det.est_width.toFixed(1)}m`;
          ctx.font = `${Math.max(9, 10 / zoom)}px monospace`;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(x, y + h + 2, ctx.measureText(dimText).width + 8, 14 / zoom);
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(dimText, x + 4, y + h + 12 / zoom);
        }
      });
    }

    ctx.restore();
  }, [
    imageObj, 
    imageLoaded, 
    pan, 
    zoom, 
    showBoundingBoxes, 
    showNadir, 
    showGrid, 
    scanData, 
    selectedDetection, 
    hoveredDetection, 
    filterClass, 
    minConfidence
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        renderCanvas();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    const imageX = (mouseCanvasX - pan.x) / zoom;
    const imageY = (mouseCanvasY - pan.y) / zoom;

    if (imageObj && imageX >= 0 && imageX <= imageObj.width && imageY >= 0 && imageY <= imageObj.height) {
      const centerX = imageObj.width / 2;
      const swath = scanData?.swath_range_m || 100;
      const slantRange = (Math.abs(imageX - centerX) / centerX) * swath;
      const channel = imageX < centerX ? 'Port' : 'Starboard';
      setCursorCoord({
        x: Math.round(imageX),
        y: Math.round(imageY),
        slantRange: slantRange.toFixed(1),
        channel
      });
    } else {
      setCursorCoord(null);
    }

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    if (scanData?.detections) {
      const found = scanData.detections.find((d: any) => {
        const x1 = d.bbox_x - d.bbox_w / 2;
        const y1 = d.bbox_y - d.bbox_h / 2;
        const x2 = d.bbox_x + d.bbox_w / 2;
        const y2 = d.bbox_y + d.bbox_h / 2;
        return imageX >= x1 && imageX <= x2 && imageY >= y1 && imageY <= y2;
      });
      setHoveredDetection(found || null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const imageX = (e.clientX - rect.left - pan.x) / zoom;
    const imageY = (e.clientY - rect.top - pan.y) / zoom;

    if (scanData?.detections) {
      const clicked = scanData.detections.find((d: any) => {
        const x1 = d.bbox_x - d.bbox_w / 2;
        const y1 = d.bbox_y - d.bbox_h / 2;
        const x2 = d.bbox_x + d.bbox_w / 2;
        const y2 = d.bbox_y + d.bbox_h / 2;
        return imageX >= x1 && imageX <= x2 && imageY >= y1 && imageY <= y2;
      });
      if (clicked) {
        onSelectDetection(clicked);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const zoomFactor = 1.15;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    const clampedZoom = Math.min(Math.max(newZoom, 0.15), 6.0);

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (clampedZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (clampedZoom / zoom);

    setZoom(clampedZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleFitView = () => {
    if (!imageObj || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const fitZoom = Math.min((containerW - 40) / imageObj.width, (containerH - 40) / imageObj.height, 1.0);
    setZoom(fitZoom);
    setPan({
      x: (containerW - imageObj.width * fitZoom) / 2,
      y: (containerH - imageObj.height * fitZoom) / 2
    });
  };

  return (
    <div className="relative flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-xs z-10">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setUseProcessed(!useProcessed)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
              useProcessed 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm shadow-cyan-500/10' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle CLAHE Contrast Enhancement"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{useProcessed ? "CLAHE Contrast: ON" : "Raw Sonar Backscatter"}</span>
          </button>

          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
              showBoundingBoxes 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
            title="Toggle Bounding Boxes"
          >
            {showBoundingBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Targets</span>
          </button>

          <button
            onClick={() => setShowNadir(!showNadir)}
            className={`px-2.5 py-1.5 rounded-lg border transition-all ${
              showNadir ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            Nadir Track
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2.5 py-1.5 rounded-lg border transition-all ${
              showGrid ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-800/40 text-slate-600 border-slate-700'
            }`}
          >
            Range Grid
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {cursorCoord && (
            <div className="hidden lg:flex items-center space-x-3 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-400 font-mono text-[11px]">
              <span className="text-cyan-400">{cursorCoord.channel}</span>
              <span>Range: <strong className="text-white">{cursorCoord.slantRange}m</strong></span>
              <span>Ping: <strong className="text-white">#{cursorCoord.y}</strong></span>
            </div>
          )}

          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setZoom(z => Math.max(0.2, z / 1.25))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-300 min-w-[40px] text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(5.0, z * 1.25))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitView}
              className="p-1 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-700"
              title="Reset Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div 
        ref={containerRef} 
        className="relative flex-1 w-full h-full overflow-hidden bg-radial from-slate-900 to-black cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          className="absolute inset-0 w-full h-full"
        />

        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur z-20">
            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-mono text-cyan-400">Loading High-Resolution Sonar Waterfall...</p>
          </div>
        )}

        {selectedDetection && (
          <div className="absolute bottom-4 left-4 p-3 bg-slate-900/95 border border-cyan-500/40 rounded-xl backdrop-blur shadow-2xl z-20 text-xs w-72">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white capitalize">{selectedDetection.class_name} Target</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedDetection.confidence > 75 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {selectedDetection.confidence.toFixed(1)}% Conf
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Dimensions</span>
                <span>{selectedDetection.est_length?.toFixed(1)}m × {selectedDetection.est_width?.toFixed(1)}m</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Shadow Height</span>
                <span>{selectedDetection.est_height ? `${selectedDetection.est_height.toFixed(1)}m` : 'Flat / Low'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Latitude</span>
                <span>{selectedDetection.latitude?.toFixed(5)}°N</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Longitude</span>
                <span>{selectedDetection.longitude?.toFixed(5)}°W</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';

interface SonarMapProps {
  scanData: any;
  selectedDetection: any;
  onSelectDetection: (det: any) => void;
  filterClass?: string;
  minConfidence?: number;
}

export default function SonarMap({ 
  scanData, 
  selectedDetection, 
  onSelectDetection,
  filterClass = 'all',
  minConfidence = 0 
}: SonarMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const tracklineLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [36.8012, -121.9475],
        zoom: 15,
        zoomControl: false
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, GEBCO, NOAA, National Geographic',
        maxZoom: 16
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      tracklineLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tracklines and Anomaly Markers when scanData changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !scanData || !markersGroupRef.current || !tracklineLayerRef.current) return;

    markersGroupRef.current.clearLayers();
    tracklineLayerRef.current.clearLayers();

    const bounds: [number, number][] = [];

    // 1. Draw Towfish Trackline Polyline
    if (scanData.trackline && scanData.trackline.length > 0) {
      const latlngs: [number, number][] = scanData.trackline.map((p: any) => [p.lat, p.lon]);
      latlngs.forEach(ll => bounds.push(ll));

      L.polyline(latlngs, {
        color: '#00f0ff',
        weight: 6,
        opacity: 0.25
      }).addTo(tracklineLayerRef.current);

      L.polyline(latlngs, {
        color: '#06b6d4',
        weight: 3,
        dashArray: '6, 4',
        opacity: 0.9
      }).addTo(tracklineLayerRef.current);

      const startPt = latlngs[0];
      const endPt = latlngs[latlngs.length - 1];

      const startIcon = L.divIcon({
        className: 'custom-sonar-pin',
        html: `<div class="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-md shadow-emerald-400/50"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const endIcon = L.divIcon({
        className: 'custom-sonar-pin',
        html: `<div class="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-900 animate-pulse shadow-md shadow-cyan-400/50"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      L.marker(startPt, { icon: startIcon }).bindTooltip("Survey Start", { direction: 'top' }).addTo(tracklineLayerRef.current);
      L.marker(endPt, { icon: endIcon }).bindTooltip("Towfish Position", { direction: 'top' }).addTo(tracklineLayerRef.current);
    }

    // 2. Draw Anomaly Detection Markers
    if (scanData.detections && scanData.detections.length > 0) {
      scanData.detections.forEach((det: any) => {
        if (!det.latitude || !det.longitude) return;
        if (filterClass !== 'all' && det.class_name !== filterClass) return;
        if (det.confidence < minConfidence) return;

        bounds.push([det.latitude, det.longitude]);

        const isSelected = selectedDetection?.id === det.id;
        
        let pinColor = '#ef4444';
        if (det.confidence >= 75) pinColor = '#10b981';
        else if (det.confidence >= 50) pinColor = '#f59e0b';

        if (det.validation_status === 'approved') pinColor = '#06b6d4';
        if (det.validation_status === 'rejected') pinColor = '#64748b';

        const customIcon = L.divIcon({
          className: 'custom-sonar-pin',
          html: `
            <div class="relative flex items-center justify-center">
              ${isSelected ? `<div class="absolute w-8 h-8 rounded-full bg-cyan-400/40 animate-ping"></div>` : ''}
              <div style="background-color: ${pinColor};" class="w-5 h-5 rounded-full border-2 border-slate-950 flex items-center justify-center shadow-lg transition-transform ${isSelected ? 'scale-125 ring-2 ring-white' : ''}">
                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([det.latitude, det.longitude], { icon: customIcon });

        const popupContent = `
          <div class="p-1 font-sans text-slate-200">
            <div class="flex items-center justify-between font-bold text-xs uppercase mb-1">
              <span class="text-cyan-400">${det.class_name}</span>
              <span class="text-emerald-400">${det.confidence.toFixed(0)}% Conf</span>
            </div>
            <div class="text-[11px] text-slate-300 space-y-0.5 font-mono">
              <div>Dim: ${det.est_length?.toFixed(1) || '?'}m × ${det.est_width?.toFixed(1) || '?'}m</div>
              <div>Height: ${det.est_height ? det.est_height.toFixed(1) + 'm' : 'Flat / Low'}</div>
              <div>Lat: ${det.latitude.toFixed(5)}°</div>
              <div>Lon: ${det.longitude.toFixed(5)}°</div>
              <div class="mt-1 text-[10px] text-slate-400">Status: <strong class="capitalize ${det.validation_status === 'approved' ? 'text-cyan-400' : 'text-amber-400'}">${det.validation_status}</strong></div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: 'sonar-dark-popup',
          closeButton: false
        });

        marker.on('click', () => {
          onSelectDetection(det);
        });

        marker.addTo(markersGroupRef.current!);
      });
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [scanData, selectedDetection, filterClass, minConfidence]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && selectedDetection && selectedDetection.latitude && selectedDetection.longitude) {
      map.panTo([selectedDetection.latitude, selectedDetection.longitude], { animate: true, duration: 0.6 });
    }
  }, [selectedDetection]);

  return (
    <div className="relative flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-xs z-10">
        <div className="flex items-center space-x-2 text-slate-300">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <span className="font-bold tracking-wide uppercase">Geospatial Target Telemetry (GIS)</span>
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
            <span>Towfish Line</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            <span>Confirmed</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            <span>Anomaly</span>
          </div>
        </div>
      </div>

      <div ref={mapContainerRef} className="flex-1 w-full h-full bg-slate-950" />
    </div>
  );
}

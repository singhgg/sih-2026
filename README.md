# AquaScan AI - Underwater Sonar Object Detection & Triage Platform

An advanced AI-powered platform for detecting, tracking, and classifying underwater hazards, shipwrecks, pipelines, and submerged anomalies using Side-Scan Sonar (SSS) imagery and synthetic aperture sonar data.

## Features
- **Real-Time Waterfall Display**: Live canvas rendering of sonar pings with intensity mapping and color palettes.
- **Deep Learning Detection Engine**: YOLOv8-based model fine-tuned on underwater sonar datasets.
- **Interactive Geospatial Map**: Tactical GIS sonar track mapping with Leaflet.
- **Automated Triage & Human-in-the-Loop Review**: Fast incident triage workflow, verification, and audit trail.
- **Comprehensive Survey Reports**: Instant analytics, hazard breakdown, and PDF export.

## Architecture & Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons, Leaflet.
- **Backend**: FastAPI, SQLAlchemy, SQLite/PostgreSQL, OpenCV, Ultralytics YOLOv8.

## Getting Started

### 1. Frontend Setup
```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python run.py
```
Backend API will be available at [http://localhost:8000](http://localhost:8000) (Docs at `/docs`).

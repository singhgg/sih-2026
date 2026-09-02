export type Prediction = {
  label: string;
  value: number;
  possibleOutcome?: string;
};

export type DetectionStatus = "Pending Review" | "Confirmed" | "Rejected";
export type ConfidenceLevel = "High" | "Medium" | "Low";

export type Detection = {
  id: string;
  surveyId: string;
  sonarImage: string;
  timestamp: string;
  frame: number;
  lat: number;
  lon: number;
  depth: number;
  status: DetectionStatus;
  confidence: ConfidenceLevel;
  highestPrediction: string;
  predictions: Prediction[];
};

export type SurveyStatus = "Completed" | "Processing" | "Pending" | "Error";

export type Survey = {
  id: string;
  name: string;
  date: string;
  time: string;
  description: string;
  area: string;
  status: SurveyStatus;
  progress: number;
  processingStages: Array<{ name: string; complete: boolean; active?: boolean }>;
  metrics: {
    totalArea: string;
    detections: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    totalSonarData: string;
    processingTime: string;
  };
  validation: {
    state: "Accepted" | "Pending" | "Error";
    message: string;
  };
  metadata: {
    gpsAvailable: boolean;
    timestampAvailable: boolean;
    depthAvailable: boolean;
    surveyId: boolean;
  };
  upload?: {
    fileName: string;
    fileType: string;
    size: string;
  };
  detections: Detection[];
  analytics: {
    totalAnomalies: number;
    debrisCount: number;
    fishingNetCount: number;
    unknownAnomalies: number;
    hotspots: number;
    surveyCoverage: string;
  };
  report: {
    generated: boolean;
    format: "PDF" | "CSV" | "JSON";
    createdAt?: string;
  };
  processingHistory: string[];
};

export type SurveyDraft = {
  surveyName: string;
  date: string;
  time: string;
  description: string;
  area: string;
  fileName: string;
  fileType: string;
  size: string;
  metadata: {
    gpsAvailable: boolean;
    timestampAvailable: boolean;
    depthAvailable: boolean;
  };
};

export function generateSurveyId() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `SSS-${yyyy}${mm}${dd}-${seq}`;
}

const detectionFactory = (surveyId: string, id: string, highestPrediction: string, predictions: Prediction[], lat: number, lon: number, depth: number, frame: number, timestamp: string, status: DetectionStatus = "Pending Review"): Detection => {
  const maxValue = Math.max(...predictions.map((item) => item.value));
  const confidence = maxValue >= 80 ? "High" : maxValue >= 60 ? "Medium" : "Low";

  return {
    id,
    surveyId,
    sonarImage: `/images/${id}.png`,
    timestamp,
    frame,
    lat,
    lon,
    depth,
    status,
    confidence,
    highestPrediction,
    predictions,
  };
};

export const demoSurveys: Survey[] = [
  {
    id: "SSS-20260829-001",
    name: "Marine Zone Survey",
    date: "29 August 2026",
    time: "10:30 AM",
    description: "Underwater debris inspection across marine zone corridor.",
    area: "North Reef Sector",
    status: "Completed",
    progress: 100,
    processingStages: [
      { name: "Raw Sonar Data", complete: true },
      { name: "Noise Reduction", complete: true },
      { name: "Contrast Enhancement", complete: true },
      { name: "Normalization", complete: true },
      { name: "Resizing / Tiling", complete: true },
      { name: "Quality Check", complete: true },
      { name: "AI Analysis", complete: true, active: false },
    ],
    metrics: {
      totalArea: "2.4 km²",
      detections: 4,
      highConfidence: 3,
      mediumConfidence: 1,
      lowConfidence: 0,
      totalSonarData: "18.7 GB",
      processingTime: "11 min 42 sec",
    },
    validation: {
      state: "Accepted",
      message: "Data accepted and reviewed by marine operations team.",
    },
    metadata: {
      gpsAvailable: true,
      timestampAvailable: true,
      depthAvailable: true,
      surveyId: true,
    },
    upload: {
      fileName: "zone-a-reef-01.sss",
      fileType: "Side Scan Sonar",
      size: "18.4 MB",
    },
    detections: [
      detectionFactory(
        "SSS-20260829-001",
        "D101",
        "Debris",
        [
          { label: "Debris", value: 80 },
          { label: "Rock", value: 15 },
          { label: "Other", value: 5, possibleOutcome: "Unknown Object" },
        ],
        18.3765,
        73.1734,
        32,
        101,
        "2026-08-29T10:32:00",
        "Confirmed",
      ),
      detectionFactory(
        "SSS-20260829-001",
        "D102",
        "Fishing Net",
        [
          { label: "Fishing Net", value: 72 },
          { label: "Debris", value: 18 },
          { label: "Other", value: 10, possibleOutcome: "Natural Seabed Formation" },
        ],
        18.3921,
        73.1812,
        41,
        102,
        "2026-08-29T10:43:00",
        "Confirmed",
      ),
      detectionFactory(
        "SSS-20260829-001",
        "D103",
        "Metal Object",
        [
          { label: "Metal Object", value: 61 },
          { label: "Container", value: 24 },
          { label: "Other", value: 15, possibleOutcome: "Possible Shipwreck Fragment" },
        ],
        18.3678,
        73.1982,
        28,
        103,
        "2026-08-29T10:51:00",
        "Pending Review",
      ),
      detectionFactory(
        "SSS-20260829-001",
        "D104",
        "Unknown Anomaly",
        [
          { label: "Unknown Anomaly", value: 55 },
          { label: "Debris", value: 30 },
          { label: "Other", value: 15, possibleOutcome: "Sonar Artifact / Noise Pattern" },
        ],
        18.3411,
        73.1645,
        36,
        104,
        "2026-08-29T11:02:00",
        "Rejected",
      ),
    ],
    analytics: {
      totalAnomalies: 4,
      debrisCount: 2,
      fishingNetCount: 1,
      unknownAnomalies: 1,
      hotspots: 3,
      surveyCoverage: "86%",
    },
    report: {
      generated: true,
      format: "PDF",
      createdAt: "2026-08-29 11:15 AM",
    },
    processingHistory: [
      "Upload accepted",
      "Noise reduction complete",
      "AI analysis finished",
      "Report generated",
    ],
  },
  {
    id: "SSS-20260829-002",
    name: "Harbor Perimeter Sweep",
    date: "29 August 2026",
    time: "08:15 AM",
    description: "Perimeter pass to inspect debris buildup near industrial channel.",
    area: "Harbor Mouth",
    status: "Processing",
    progress: 67,
    processingStages: [
      { name: "Raw Sonar Data", complete: true },
      { name: "Noise Reduction", complete: true },
      { name: "Contrast Enhancement", complete: true },
      { name: "Normalization", complete: true },
      { name: "Resizing / Tiling", complete: true },
      { name: "Quality Check", complete: true },
      { name: "AI Analysis", complete: false, active: true },
    ],
    metrics: {
      totalArea: "1.9 km²",
      detections: 3,
      highConfidence: 2,
      mediumConfidence: 1,
      lowConfidence: 0,
      totalSonarData: "9.3 GB",
      processingTime: "Pending",
    },
    validation: {
      state: "Accepted",
      message: "Files validated; processing pipeline is active.",
    },
    metadata: {
      gpsAvailable: true,
      timestampAvailable: true,
      depthAvailable: true,
      surveyId: true,
    },
    upload: {
      fileName: "harbor-mouth-pass-02.sss",
      fileType: "Side Scan Sonar",
      size: "9.1 MB",
    },
    detections: [
      detectionFactory(
        "SSS-20260829-002",
        "D201",
        "Debris",
        [
          { label: "Debris", value: 84 },
          { label: "Rock", value: 11 },
          { label: "Other", value: 5, possibleOutcome: "Unknown Object" },
        ],
        18.4243,
        73.0911,
        38,
        201,
        "2026-08-29T08:22:00",
        "Pending Review",
      ),
      detectionFactory(
        "SSS-20260829-002",
        "D202",
        "Container",
        [
          { label: "Container", value: 68 },
          { label: "Metal Object", value: 22 },
          { label: "Other", value: 10, possibleOutcome: "Natural Seabed Formation" },
        ],
        18.4338,
        73.0955,
        44,
        202,
        "2026-08-29T08:31:00",
        "Pending Review",
      ),
    ],
    analytics: {
      totalAnomalies: 2,
      debrisCount: 1,
      fishingNetCount: 0,
      unknownAnomalies: 1,
      hotspots: 2,
      surveyCoverage: "63%",
    },
    report: {
      generated: false,
      format: "PDF",
    },
    processingHistory: [
      "Upload accepted",
      "Normalization complete",
      "AI classification in progress",
    ],
  },
  {
    id: "SSS-20260829-003",
    name: "Lagoon Edge Scan",
    date: "29 August 2026",
    time: "03:05 PM",
    description: "Incomplete metadata collection near shallow lagoon boundary.",
    area: "Lagoon Edge",
    status: "Pending",
    progress: 24,
    processingStages: [
      { name: "Raw Sonar Data", complete: true },
      { name: "Noise Reduction", complete: false },
      { name: "Contrast Enhancement", complete: false },
      { name: "Normalization", complete: false },
      { name: "Resizing / Tiling", complete: false },
      { name: "Quality Check", complete: false },
      { name: "AI Analysis", complete: false },
    ],
    metrics: {
      totalArea: "0.8 km²",
      detections: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      totalSonarData: "2.1 GB",
      processingTime: "Pending",
    },
    validation: {
      state: "Pending",
      message: "Missing required depth metadata and timestamp supplement.",
    },
    metadata: {
      gpsAvailable: true,
      timestampAvailable: false,
      depthAvailable: false,
      surveyId: true,
    },
    upload: {
      fileName: "lagoon-edge-pass-04.sss",
      fileType: "Side Scan Sonar",
      size: "7.5 MB",
    },
    detections: [],
    analytics: {
      totalAnomalies: 0,
      debrisCount: 0,
      fishingNetCount: 0,
      unknownAnomalies: 0,
      hotspots: 0,
      surveyCoverage: "Pending",
    },
    report: {
      generated: false,
      format: "PDF",
    },
    processingHistory: [
      "Upload received",
      "Metadata validation pending",
      "Awaiting depth and timestamp input",
    ],
  },
];

export type SurveyDraftInput = Omit<SurveyDraft, "fileName" | "fileType" | "size">;

export function createSurveyFromDraft(draft: SurveyDraft): Survey {
  const surveyId = generateSurveyId();
  const dateLabel = draft.date || "29 August 2026";
  const baseDetection = detectionFactory(
    surveyId,
    "D101",
    "Debris",
    [
      { label: "Debris", value: 80 },
      { label: "Rock", value: 15 },
      { label: "Other", value: 5, possibleOutcome: "Unknown Object" },
    ],
    18.3864,
    73.1755,
    33,
    101,
    "2026-08-29T10:32:00",
    "Pending Review",
  );

  const survey: Survey = {
    id: surveyId,
    name: draft.surveyName || "New Sonar Survey",
    date: dateLabel,
    time: draft.time || "10:30 AM",
    description: draft.description || "Autogenerated sonar survey analyzed by AI pipeline.",
    area: draft.area || "Survey Area",
    status: draft.metadata.gpsAvailable && draft.metadata.timestampAvailable && draft.metadata.depthAvailable ? "Processing" : "Pending",
    progress: draft.metadata.gpsAvailable && draft.metadata.timestampAvailable && draft.metadata.depthAvailable ? 12 : 8,
    processingStages: [
      { name: "Raw Sonar Data", complete: true },
      { name: "Noise Reduction", complete: draft.metadata.gpsAvailable && draft.metadata.timestampAvailable && draft.metadata.depthAvailable },
      { name: "Contrast Enhancement", complete: false },
      { name: "Normalization", complete: false },
      { name: "Resizing / Tiling", complete: false },
      { name: "Quality Check", complete: false },
      { name: "AI Analysis", complete: false },
    ],
    metrics: {
      totalArea: "0.9 km²",
      detections: 1,
      highConfidence: 0,
      mediumConfidence: 1,
      lowConfidence: 0,
      totalSonarData: draft.size || "8.0 MB",
      processingTime: "Pending",
    },
    validation: {
      state: draft.metadata.gpsAvailable && draft.metadata.timestampAvailable && draft.metadata.depthAvailable ? "Accepted" : "Pending",
      message:
        draft.metadata.gpsAvailable && draft.metadata.timestampAvailable && draft.metadata.depthAvailable
          ? "Data accepted; AI pipeline is queued."
          : "Pending: complete GPS, timestamp, and depth metadata before processing.",
    },
    metadata: {
      gpsAvailable: draft.metadata.gpsAvailable,
      timestampAvailable: draft.metadata.timestampAvailable,
      depthAvailable: draft.metadata.depthAvailable,
      surveyId: true,
    },
    upload: {
      fileName: draft.fileName || "uploaded-sonar.sss",
      fileType: draft.fileType || "Side Scan Sonar",
      size: draft.size || "8.0 MB",
    },
    detections: [baseDetection],
    analytics: {
      totalAnomalies: 1,
      debrisCount: 1,
      fishingNetCount: 0,
      unknownAnomalies: 0,
      hotspots: 1,
      surveyCoverage: "36%",
    },
    report: {
      generated: false,
      format: "PDF",
    },
    processingHistory: [
      "Survey created",
      "Upload queued",
      "AI classification scheduled",
    ],
  };

  return survey;
}

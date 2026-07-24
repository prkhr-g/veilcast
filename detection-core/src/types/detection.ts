export type DetectionType =
  | "api_key"
  | "jwt"
  | "database_url"
  | "private_key"
  | "password"
  | "email"
  | "phone"
  | "credit_card"
  | "qr_code";

export type DetectionSource = "dom" | "ocr" | "context";

export type DetectionSeverity = "low" | "medium" | "high" | "critical";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScanInput = {
  source: DetectionSource;
  content: string;
  elementId?: string;
  bounds?: Bounds;
  confidence?: number;
};

export type Detection = {
  id: string;
  type: DetectionType;
  maskedValue: string;
  confidence: number;
  severity: DetectionSeverity;
  source: DetectionSource;
  elementId?: string;
  bounds?: Bounds;
  range: {
    start: number;
    end: number;
  };
  reason: string;
  detector: string;
};

export type DetectorFinding = Omit<Detection, "id" | "maskedValue" | "source" | "elementId" | "bounds"> & {
  value: string;
  bounds?: Bounds;
};

export type Detector = {
  name: string;
  detect(input: ScanInput): DetectorFinding[];
};

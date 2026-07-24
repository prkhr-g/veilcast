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
  source: "dom" | "ocr";
  content: string;
  /** RGBA pixels used by image-capable detectors such as the QR detector. */
  imageData?: Uint8ClampedArray;
  imageWidth?: number;
  imageHeight?: number;
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
  /** A detector-specific region, preferred over the input bounds when present. */
  bounds?: Bounds;
};

export type Detector = {
  name: string;
  detect(input: ScanInput): DetectorFinding[];
};

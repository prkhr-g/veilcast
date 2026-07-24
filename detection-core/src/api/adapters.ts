import { detectionEngine } from "../engine/detection-engine";
import { toApiDetectionResult, type ApiDetectionResult } from "../api-results";
import type { ScanInput } from "../types/detection";

export type TextDetectionAdapter = {
  scan(input: ScanInput): ApiDetectionResult[];
};

export type ContextDetectionAdapter = {
  scan(input: { content: string; context?: Record<string, unknown> }): ApiDetectionResult[];
};

export type ImageDetectionAdapter = {
  scan(input: { imageBase64: string; mimeType: string }): ApiDetectionResult[];
};

export const localTextDetectionAdapter: TextDetectionAdapter = {
  scan(input) {
    return detectionEngine.scan(input).map(toApiDetectionResult);
  },
};

export const placeholderContextAdapter: ContextDetectionAdapter = {
  scan(input) {
    return localTextDetectionAdapter.scan({ source: "context", content: input.content });
  },
};

export const placeholderImageAdapter: ImageDetectionAdapter = {
  scan() {
    return [];
  },
};


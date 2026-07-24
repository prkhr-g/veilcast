import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  classifyQrPayload,
  detectionRules,
  localTextDetectionAdapter,
  placeholderContextAdapter,
  placeholderImageAdapter,
  type ApiDetectionResult,
} from "@veilcast/detection-core";
import { ApiError, fail, ok, parseJson } from "./responses";
import {
  batchDetectionSchema,
  contextDetectionSchema,
  eventsSchema,
  imageDetectionSchema,
  qrDetectionSchema,
  textDetectionSchema,
  type BatchDetectionBody,
  type ContextDetectionBody,
  type ImageDetectionBody,
  type QrDetectionBody,
  type TextDetectionBody,
} from "./schemas";

const maxRequestBytes = 1_000_000;

type Variables = { requestId: string };

export const app = new Hono<{ Variables: Variables }>();

app.onError((error, c) => {
  if (error instanceof ApiError) return fail(c, error.status, error.code, error.message);
  console.error("Unhandled request error", { requestId: c.get("requestId"), path: c.req.path });
  return fail(c, 500, "internal_error", "Internal server error");
});

app.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
});

app.use("*", cors({ origin: allowedOrigin, allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["content-type", "x-request-id"] }));

app.use("*", async (c, next) => {
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > maxRequestBytes) throw new ApiError(413, "request_too_large", "Request body is too large");

  const start = performance.now();
  await next();
  console.info("request", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Math.round(performance.now() - start),
  });
});

app.get("/api/health", c => ok(c, { status: "ok", service: "veilcast-detection-api" }));

app.post("/api/detections/text", async c => {
  const body = await parseJson(c, textDetectionSchema);
  return ok(c, { detections: detectText(body) });
});

app.post("/api/detections/context", async c => {
  const body = await parseJson(c, contextDetectionSchema);
  return ok(c, { detections: detectContext(body) });
});

app.post("/api/detections/qr", async c => {
  const body = await parseJson(c, qrDetectionSchema);
  return ok(c, { detection: detectQr(body) });
});

app.post("/api/detections/image", async c => {
  const body = await parseJson(c, imageDetectionSchema);
  return ok(c, { detections: detectImage(body) });
});

app.post("/api/detections/batch", async c => {
  const body = await parseJson(c, batchDetectionSchema);
  return ok(c, { results: detectBatch(body) });
});

app.get("/api/detections/rules", c => ok(c, { rules: detectionRules }));

app.post("/api/detections/events", async c => {
  const body = await parseJson(c, eventsSchema);
  return ok(c, { accepted: body.events.length });
});

function detectText(body: TextDetectionBody): ApiDetectionResult[] {
  return localTextDetectionAdapter.scan(body);
}

function detectContext(body: ContextDetectionBody): ApiDetectionResult[] {
  return placeholderContextAdapter.scan(body);
}

function detectQr(body: QrDetectionBody): ApiDetectionResult {
  return classifyQrPayload(body.payload);
}

function detectImage(body: ImageDetectionBody): ApiDetectionResult[] {
  return placeholderImageAdapter.scan(body);
}

function detectBatch(body: BatchDetectionBody) {
  return body.requests.map(item => {
    if (item.kind === "text") return { kind: item.kind, detections: detectText(item.input) };
    if (item.kind === "context") return { kind: item.kind, detections: detectContext(item.input) };
    if (item.kind === "qr") return { kind: item.kind, detection: detectQr(item.input) };
    return { kind: item.kind, detections: detectImage(item.input) };
  });
}

function allowedOrigin(origin: string | undefined): string | undefined {
  const configured = (process.env.EXTENSION_ORIGINS ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  const devOrigins = process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:5173"];
  const allowed = new Set([...configured, ...devOrigins]);
  return origin && allowed.has(origin) ? origin : undefined;
}

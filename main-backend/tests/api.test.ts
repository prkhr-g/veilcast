import { describe, expect, test } from "bun:test";
import { app } from "../src/app";

const jsonHeaders = { "content-type": "application/json" };

async function request(path: string, body?: unknown) {
  return app.request(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : jsonHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("detection API", () => {
  test("returns health envelope", async () => {
    const response = await request("/api/health");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.service).toBe("veilcast-detection-api");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  test("classifies QR without returning the decoded payload", async () => {
    const payload = "otpauth://totp/App?secret=DO_NOT_RETURN";
    const response = await request("/api/detections/qr", { payload });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        detection: {
          type: "qr_code",
          category: "authentication",
          sensitive: true,
          severity: "high",
          confidence: 1,
          action: "mask",
          reason: "QR payload is an authentication secret URI",
        },
      },
    });
    expect(serialized).not.toContain(payload);
    expect(serialized).not.toContain("DO_NOT_RETURN");
  });

  test("rejects missing QR payload with failure envelope", async () => {
    const response = await request("/api/detections/qr", {});
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("validation_failed");
  });

  test("rejects malformed JSON with failure envelope", async () => {
    const response = await app.request("/api/detections/qr", {
      method: "POST",
      headers: jsonHeaders,
      body: "{nope",
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: { code: "malformed_json", message: "Request body must be valid JSON" } });
  });

  test("rejects oversized requests", async () => {
    const response = await app.request("/api/detections/text", {
      method: "POST",
      headers: { ...jsonHeaders, "content-length": "1000001" },
      body: JSON.stringify({ content: "small" }),
    });
    const body = await response.json();
    expect(response.status).toBe(413);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("request_too_large");
  });

  test("returns detection result contracts for text and batch routes", async () => {
    const textResponse = await request("/api/detections/text", { content: "email john@example.com" });
    const textBody = await textResponse.json();
    const result = textBody.data.detections[0];
    expect(Object.keys(result).sort()).toEqual(["action", "category", "confidence", "reason", "sensitive", "severity", "type"].sort());

    const batchResponse = await request("/api/detections/batch", {
      requests: [
        { kind: "qr", input: { payload: "upi://pay?pa=user@bank" } },
        { kind: "image", input: { imageBase64: "ZmFrZQ==", mimeType: "image/png" } },
      ],
    });
    const batchBody = await batchResponse.json();
    expect(batchResponse.status).toBe(200);
    expect(batchBody.success).toBe(true);
    expect(batchBody.data.results[0].detection.action).toBe("mask");
    expect(batchBody.data.results[1].detections).toEqual([]);
  });

  test("does not allow unrestricted production CORS", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await app.request("/api/health", { headers: { origin: "https://evil.example" } });
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

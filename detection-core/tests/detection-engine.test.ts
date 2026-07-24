import { describe, expect, test } from "bun:test";
import { DetectionEngine, detectionEngine, passesLuhn, type Detector } from "../src/index";

const jwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const scan = (content: string) => detectionEngine.scan({ source: "dom", content });

describe("detection core", () => {
  test("detects API keys and tokens", () => {
    const detections = scan([
      "openai=sk-testaaaaaaaaaaaaaaaaaaaa",
      "github=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aws=AKIAABCDEFGHIJKLMNOP",
      "stripe=sk_test_abcdefghijklmnopqrstuvwxyz",
      "Authorization: Bearer bearerTokenValue1234567890",
      "client_secret=clientSecretValue12345",
    ].join("\n"));

    expect(detections.filter(item => item.type === "api_key")).toHaveLength(6);
  });

  test("detects JWT tokens and prefers them over bearer token matches", () => {
    const [detection] = scan(`Authorization: Bearer ${jwt}`);
    expect(detection?.type).toBe("jwt");
  });

  test("detects database URLs and masks them completely", () => {
    const url = "postgresql://user:pass@example.com:5432/app";
    const [detection] = scan(`DATABASE_URL=${url}`);
    expect(detection?.type).toBe("database_url");
    expect(detection?.maskedValue).toBe("********");
    expect(JSON.stringify(detection)).not.toContain(url);
  });

  test("detects multiline private keys", () => {
    const key = "-----BEGIN PRIVATE KEY-----\nabc123fake\n-----END PRIVATE KEY-----";
    const [detection] = scan(key);
    expect(detection?.type).toBe("private_key");
    expect(detection?.maskedValue).toBe("********");
  });

  test("detects password and secret assignments", () => {
    const detections = scan("password=dragon123\nsecret: something-private");
    expect(detections.map(item => item.type)).toEqual(["password", "password"]);
  });

  test("detects email and phone PII without obvious numeric ID false positives", () => {
    const detections = scan("Email john@example.com and phone +91 9876543210, id 1234567890");
    expect(detections.map(item => item.type)).toEqual(["email", "phone"]);
  });

  test("detects only Luhn-valid credit-card candidates", () => {
    expect(passesLuhn("4111111111111111")).toBe(true);
    expect(passesLuhn("4111111111111112")).toBe(false);
    const detections = scan("valid 4111 1111 1111 1111 invalid 4111 1111 1111 1112");
    expect(detections.filter(item => item.type === "credit_card")).toHaveLength(1);
  });

  test("removes duplicate overlapping results", () => {
    const detections = scan("token=sk-testaaaaaaaaaaaaaaaaaaaa");
    expect(detections).toHaveLength(1);
    expect(detections[0]?.type).toBe("api_key");
  });

  test("handles empty, unicode, and very long input", () => {
    expect(scan("")).toEqual([]);
    expect(scan("こんにちは john@example.com مرحبا")[0]?.type).toBe("email");
    const longInput = `${"x".repeat(50_000)} sk-testaaaaaaaaaaaaaaaaaaaa`;
    expect(scan(longInput).at(-1)?.type).toBe("api_key");
  });

  test("never serializes raw secret values", () => {
    const secret = "something-private";
    const detections = scan(`secret=${secret}`);
    expect(JSON.stringify(detections)).not.toContain(secret);
  });

  test("returns stable IDs, source metadata, bounds, and sorted ranges", () => {
    const input = {
      source: "dom" as const,
      content: "john@example.com then 4111 1111 1111 1111",
      elementId: "el-1",
      bounds: { x: 1, y: 2, width: 3, height: 4 },
    };
    const first = detectionEngine.scan(input);
    const second = detectionEngine.scan(input);
    expect(first.map(item => item.id)).toEqual(second.map(item => item.id));
    expect(first.map(item => item.range.start)).toEqual([...first.map(item => item.range.start)].sort((a, b) => a - b));
    expect(first[0]?.elementId).toBe("el-1");
    expect(first[0]?.bounds).toEqual(input.bounds);
  });

  test("allows detector registration and disabling", () => {
    const customDetector: Detector = {
      name: "custom-test",
      detect() {
        return [
          {
            type: "email",
            value: "custom@example.com",
            confidence: 0.8,
            severity: "medium",
            range: { start: 0, end: 18 },
            reason: "custom detector",
            detector: "custom-test",
          },
        ];
      },
    };

    const engine = new DetectionEngine([]);
    engine.registerDetector(customDetector);
    expect(engine.scan({ source: "dom", content: "custom@example.com" })).toHaveLength(1);
    engine.disableDetector("custom-test");
    expect(engine.scan({ source: "dom", content: "custom@example.com" })).toEqual([]);
  });
});
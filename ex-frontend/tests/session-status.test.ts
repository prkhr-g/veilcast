import { describe, expect, test } from "bun:test";
import { canStartSharing, canStopSharing, statusText, type CaptureStatus } from "../src/extension/session-status";

describe("capture session status helpers", () => {
  test("allows starting only from idle or error", () => {
    const statuses: CaptureStatus[] = ["idle", "selecting", "starting", "active", "error"];
    expect(statuses.filter(canStartSharing)).toEqual(["idle", "error"]);
  });

  test("allows stopping non-idle states", () => {
    const statuses: CaptureStatus[] = ["idle", "selecting", "starting", "active", "error"];
    expect(statuses.filter(canStopSharing)).toEqual(["selecting", "starting", "active", "error"]);
  });

  test("formats status labels", () => {
    expect(statusText("starting")).toBe("Starting");
    expect(statusText("active")).toBe("Active");
  });
});

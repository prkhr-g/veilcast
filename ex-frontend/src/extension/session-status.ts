export type CaptureStatus = "idle" | "selecting" | "starting" | "active" | "error";

export function canStartSharing(status: CaptureStatus): boolean {
  return status === "idle" || status === "error";
}

export function canStopSharing(status: CaptureStatus): boolean {
  return status === "selecting" || status === "starting" || status === "active" || status === "error";
}

export function statusText(status: CaptureStatus): string {
  return {
    idle: "Idle",
    selecting: "Selecting",
    starting: "Starting",
    active: "Active",
    error: "Error",
  }[status];
}

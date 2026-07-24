export type CaptureAdapter = {
  requestWindowStreamId(): Promise<string>;
  cancelPendingPicker(): void;
};

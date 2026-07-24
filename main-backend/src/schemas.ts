import { z } from "zod";

const boundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const textDetectionSchema = z.object({
  source: z.enum(["dom", "ocr"]).default("dom"),
  content: z.string().min(1).max(100_000),
  elementId: z.string().min(1).max(256).optional(),
  bounds: boundsSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const contextDetectionSchema = z.object({
  content: z.string().min(1).max(100_000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const qrDetectionSchema = z.object({
  payload: z.string().min(1).max(4096),
});

export const imageDetectionSchema = z.object({
  imageBase64: z.string().min(1).max(1_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export const eventSchema = z.object({
  type: z.string().min(1).max(64),
  category: z.string().min(1).max(64).optional(),
  action: z.enum(["mask", "allow", "review"]).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const eventsSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

export const batchItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), input: textDetectionSchema }),
  z.object({ kind: z.literal("context"), input: contextDetectionSchema }),
  z.object({ kind: z.literal("qr"), input: qrDetectionSchema }),
  z.object({ kind: z.literal("image"), input: imageDetectionSchema }),
]);

export const batchDetectionSchema = z.object({
  requests: z.array(batchItemSchema).min(1).max(25),
});

export type TextDetectionBody = z.infer<typeof textDetectionSchema>;
export type ContextDetectionBody = z.infer<typeof contextDetectionSchema>;
export type QrDetectionBody = z.infer<typeof qrDetectionSchema>;
export type ImageDetectionBody = z.infer<typeof imageDetectionSchema>;
export type BatchDetectionBody = z.infer<typeof batchDetectionSchema>;

import type { Context } from "hono";
import { ZodError, type ZodType } from "zod";

export type SuccessEnvelope<T> = { success: true; data: T };
export type FailureEnvelope = { success: false; error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function ok<T>(c: Context, data: T, status = 200) {
  return c.json<SuccessEnvelope<T>>({ success: true, data }, status as never);
}

export function fail(c: Context, status: number, code: string, message: string) {
  return c.json<FailureEnvelope>({ success: false, error: { code, message } }, status as never);
}

export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, "malformed_json", "Request body must be valid JSON");
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(400, "validation_failed", error.issues[0]?.message ?? "Request body is invalid");
    }
    throw error;
  }
}

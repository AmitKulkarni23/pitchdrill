import { API_URL } from "@/config/env";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface Options {
  ticket?: string;
}

async function request<T>(method: "GET" | "POST", path: string, body: unknown, { ticket }: Options): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (ticket) headers["x-ticket"] = ticket;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "network", "Can't reach PitchDrill right now. Check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;
  if (data?.error?.code) {
    const { code, message, ...details } = data.error;
    throw new ApiError(res.status, code, message, details);
  }
  // API Gateway's own responses (e.g. the IAM lock) aren't in our { error } shape.
  if (res.status === 403) throw new ApiError(403, "not_open", "Booking isn't open to the public yet.");
  throw new ApiError(res.status, `http_${res.status}`, "Something went wrong. Please try again.");
}

export const api = {
  get: <T>(path: string, options: Options = {}) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body: unknown, options: Options = {}) => request<T>("POST", path, body, options),
};

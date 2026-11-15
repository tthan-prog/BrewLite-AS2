import { API_URL } from "./config";

export type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const body = payload as ApiErrorBody;
    const message = Array.isArray(body?.message)
      ? body.message.join("; ")
      : body?.message || body?.error || (typeof payload === "string" ? payload : `Yêu cầu thất bại (${response.status})`);
    throw new Error(message);
  }

  return payload as T;
}

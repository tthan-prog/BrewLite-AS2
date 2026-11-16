import { API_URL } from "./config";

export type QrStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface QrIntent {
  token: string;
  orderId: number;
  amount: number;
  status: QrStatus;
  expiresAt: string;
  qrContent: string;
  qrImage: string;
}

export interface QrPublic {
  token: string;
  orderId: number;
  amount: number;
  status: QrStatus;
  expiresAt: string;
  accounts: { identifier: string; holderName: string }[];
}

export interface QrPaymentResult {
  paymentId: number;
  orderId: number;
  amount: number;
  status: "SUCCESS" | "FAILED";
  orderStatus: string;
  failureReason: string | null;
  pointsEarned: number;
}

export class QrApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Gọi API thanh toán QR (FR-18). Lỗi HTTP ném QrApiError kèm mã trạng thái và thông báo tiếng Việt từ API. */
export async function qrRequest<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new QrApiError("Không kết nối được máy chủ. Vui lòng thử lại.", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? (body as { message: unknown }).message
        : null;
    throw new QrApiError(
      Array.isArray(message) ? message.join("; ") : typeof message === "string" ? message : `Yêu cầu thất bại (${response.status})`,
      response.status,
    );
  }
  return body as T;
}

export const formatVnd = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;

/** Số giây còn lại đến hạn, không âm. */
export function secondsLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

export const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

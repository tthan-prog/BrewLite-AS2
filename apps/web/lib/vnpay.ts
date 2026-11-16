import { API_URL } from "./config";

export interface VnpayCreated {
  orderId: number;
  txnRef: string;
  amount: number;
  expiresAt: string;
  paymentUrl: string;
}

export interface VnpayResult {
  orderId: number;
  amount: number;
  status: "SUCCESS" | "FAILED";
  orderStatus: string;
  failureReason: string | null;
  pointsEarned: number;
}

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
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
    throw Object.assign(new Error("Không kết nối được máy chủ. Vui lòng thử lại."), { status: 0 });
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body ? (body as { message: unknown }).message : null;
    throw Object.assign(
      new Error(Array.isArray(message) ? message.join("; ") : typeof message === "string" ? message : `Yêu cầu thất bại (${response.status})`),
      { status: response.status },
    );
  }
  return body as T;
}

/** VNPay đã được cấu hình trên máy chủ chưa (FR-21 là tùy chọn). */
export const vnpayEnabled = () => call<{ enabled: boolean }>("/payments/vnpay/config").then((r) => r.enabled);

/** Tạo URL thanh toán VNPay sandbox cho đơn; trang gọi rồi chuyển hướng tới paymentUrl. */
export const createVnpayPayment = (orderId: number, token: string) =>
  call<VnpayCreated>("/payments/vnpay", { method: "POST", body: JSON.stringify({ orderId }) }, token);

/** Gửi nguyên chuỗi query VNPay trả về để máy chủ kiểm tra chữ ký, số tiền và chốt đơn. */
export const confirmVnpayReturn = (search: string) =>
  call<VnpayResult>(`/payments/vnpay/return${search.startsWith("?") ? search : `?${search}`}`);

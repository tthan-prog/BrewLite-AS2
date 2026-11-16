import { API_URL } from "../../lib/config";

/** Cùng khóa với trang đăng nhập của khách (sessionStorage), để dùng chung phiên. */
export const TOKEN_KEY = "brewlite_token";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type StaffTarget = "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán lỗi",
  PREPARING: "Đang pha",
  READY: "Sẵn sàng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

/** Nút thao tác của nhân viên theo máy trạng thái FR-10 (PAID chỉ do luồng thanh toán đặt). */
export const NEXT_ACTIONS: Record<OrderStatus, { to: StaffTarget; label: string }[]> = {
  PENDING: [{ to: "CANCELLED", label: "Hủy đơn" }],
  PAYMENT_FAILED: [{ to: "CANCELLED", label: "Hủy đơn" }],
  PAID: [
    { to: "PREPARING", label: "Bắt đầu pha" },
    { to: "CANCELLED", label: "Hủy đơn" },
  ],
  PREPARING: [{ to: "READY", label: "Đã pha xong" }],
  READY: [{ to: "COMPLETED", label: "Đã giao khách" }],
  COMPLETED: [],
  CANCELLED: [],
};

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: "CUSTOMER" | "STAFF";
}

export interface StaffOrder {
  id: number;
  status: OrderStatus;
  total: number;
  discount: number;
  promotionCode: string | null;
  failureReason: string | null;
  createdAt: string;
  customerName: string;
  items: {
    id: number;
    name: string;
    quantity: number;
    size: string;
    sugar: number;
    ice: number;
    toppings: { id: number; name: string }[];
  }[];
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  lowThreshold: number;
  flag: "OUT" | "LOW" | "OK";
}

export type Size = "S" | "M" | "L";

export interface RecipeIngredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  flag: Ingredient["flag"];
  perCup: Record<Size, number>;
  sugarScaled: boolean;
  iceScaled: boolean;
}

export interface ProductRecipe {
  id: number;
  name: string;
  category: string;
  imageUrl: string;
  basePrice: number;
  ingredients: RecipeIngredient[];
  cups: Record<Size, number>;
  limiting: Record<Size, string | null>;
}

export interface ToppingRecipe {
  id: number;
  name: string;
  price: number;
  ingredients: Array<Omit<RecipeIngredient, "perCup" | "sugarScaled" | "iceScaled"> & { perServing: number }>;
  servings: number | null;
  limiting: string | null;
}

export interface RecipesResponse {
  products: ProductRecipe[];
  toppings: ToppingRecipe[];
}

export const SIZES: Size[] = ["S", "M", "L"];

/** Màu theo số ly còn làm được: 0 đỏ, ít hơn 10 vàng, còn lại xanh. */
export function cupsTone(cups: number): string {
  if (cups <= 0) return "bg-red-100 text-red-800";
  if (cups < 10) return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

export class StaffApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
  }
  return `Yêu cầu thất bại (${status})`;
}

/** Gọi API kèm JWT; lỗi HTTP ném StaffApiError có mã trạng thái. */
export async function staffRequest<T>(path: string, init: RequestInit = {}, token = readToken()): Promise<T> {
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
    throw new StaffApiError("Không kết nối được máy chủ. Vui lòng thử lại.", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new StaffApiError(messageOf(body, response.status), response.status);
  return body as T;
}

export const formatMoney = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;

export const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

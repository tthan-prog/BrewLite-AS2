import { API_URL } from "./config";

/** Khóa localStorage của giỏ hàng (dùng chung cho menu, chi tiết món, giỏ, thanh toán, header). */
export const CART_KEY = "brewlite-as2-cart";
export const MAX_TOPPINGS = 5;
export const MAX_QUANTITY_PER_LINE = 50;

export type CartItem = {
  key: string;
  productId: number;
  name: string;
  size: string;
  /** Tên topping để hiển thị, ví dụ "Trân châu đen, Thạch dừa" hoặc "Không topping". */
  topping: string;
  toppingIds: number[];
  sugar: number;
  ice: number;
  quantity: number;
  unitPrice: number;
};

const LEVELS = [0, 30, 50, 70, 100];

export function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.key === "string" &&
    typeof item.productId === "number" &&
    Number.isInteger(item.productId) &&
    typeof item.name === "string" &&
    ["S", "M", "L"].includes(item.size ?? "") &&
    Array.isArray(item.toppingIds) &&
    item.toppingIds.length <= MAX_TOPPINGS &&
    item.toppingIds.every((id) => Number.isInteger(id) && id > 0) &&
    LEVELS.includes(item.sugar ?? -1) &&
    LEVELS.includes(item.ice ?? -1) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    typeof item.unitPrice === "number" &&
    Number.isFinite(item.unitPrice)
  );
}

/** Đọc giỏ hàng, bỏ các dòng sai định dạng (dữ liệu cũ). */
export function readCart(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isValidCartItem) : [];
  } catch {
    return [];
  }
}

/** Ghi giỏ hàng và báo cho header cập nhật số món. */
export function writeCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("brewlite-cart"));
}

/** Khóa của một dòng: cùng món, size, đường, đá và cùng bộ topping thì gộp chung một dòng. */
export function lineKey(productId: number, size: string, toppingIds: number[], sugar: number, ice: number): string {
  return [productId, size, [...toppingIds].sort((a, b) => a - b).join("+") || "none", sugar, ice].join("-");
}

export type AvailabilityLine = {
  productId: number;
  requested: number;
  maxQuantity: number;
  ok: boolean;
  message: string | null;
};

type AvailabilityItem = Pick<CartItem, "productId" | "quantity" | "size" | "sugar" | "ice" | "toppingIds">;

/**
 * Hỏi máy chủ số ly tối đa từng dòng theo size, topping và các dòng khác trong giỏ (POST /products/availability).
 * Máy chủ chỉ trả số ly (tối đa 50), không trả tồn kho.
 */
export async function checkAvailability(items: AvailabilityItem[], signal?: AbortSignal): Promise<{ ok: boolean; lines: AvailabilityLine[] }> {
  const response = await fetch(`${API_URL}/products/availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      items: items.map((i) => ({
        productId: i.productId,
        quantity: Math.min(Math.max(1, i.quantity), MAX_QUANTITY_PER_LINE),
        size: i.size,
        sugar: i.sugar,
        ice: i.ice,
        toppingIds: i.toppingIds,
      })),
    }),
  });
  if (!response.ok) throw new Error(`Không kiểm tra được nguyên liệu (${response.status})`);
  return (await response.json()) as { ok: boolean; lines: AvailabilityLine[] };
}

export const formatVnd = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

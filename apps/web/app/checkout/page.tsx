"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/config";
import { QrPaymentPanel } from "../../components/qr-payment-panel";
import { VnpayButton } from "../../components/vnpay-button";

type CartItem = {
  key: string;
  productId: number;
  name: string;
  size: string;
  topping: string;
  toppingIds: number[];
  sugar: number;
  ice: number;
  quantity: number;
  unitPrice: number;
};

type Order = {
  id: number;
  total: number;
  status: string;
};

type PaymentResult = {
  orderId: number;
  status: "SUCCESS" | "FAILED";
  failureReason: string | null;
  pointsEarned?: number;
};

type PendingPayment = {
  orderId: number;
  cartSnapshot: string;
  idempotencyKey?: string;
  paymentBody?: string;
};

type Method = "WALLET" | "CARD" | "QR" | "VNPAY";

const CART_KEY = "brewlite-as2-cart";
const PENDING_KEY = "brewlite-as2-pending-payment";

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;

  return (
    typeof item.key === "string" &&
    typeof item.productId === "number" &&
    Number.isInteger(item.productId) &&
    typeof item.name === "string" &&
    ["S", "M", "L"].includes(item.size ?? "") &&
    Array.isArray(item.toppingIds) &&
    item.toppingIds.every(
      (id) => Number.isInteger(id) && id > 0
    ) &&
    [0, 30, 50, 70, 100].includes(item.sugar ?? -1) &&
    [0, 30, 50, 70, 100].includes(item.ice ?? -1) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 50 &&
    typeof item.unitPrice === "number"
  );
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter(isCartItem)
      : [];
  } catch {
    return [];
  }
}

function getErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
  }

  const value = data as { message?: unknown };
  if (typeof value.message === "string") {
    return value.message;
  }

  if (Array.isArray(value.message)) {
    return value.message
      .filter((item): item is string => typeof item === "string")
      .join(". ");
  }

  return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

async function postJson<T>(
  path: string,
  body: unknown,
  token: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const error = new Error(getErrorMessage(data)) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  return data as T;
}

function readPending(): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const value = parsed as Partial<PendingPayment>;
    if (
      !Number.isInteger(value.orderId) ||
      typeof value.cartSnapshot !== "string"
    ) {
      return null;
    }

    return value as PendingPayment;
  } catch {
    return null;
  }
}

function savePending(value: PendingPayment) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

export default function CheckoutPage() {
  const router = useRouter();
  const processingRef = useRef(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<Method>("WALLET");
  const [cardNumber, setCardNumber] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [externalOrder, setExternalOrder] = useState<{ orderId: number; method: "QR" | "VNPAY"; token: string } | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const token = sessionStorage.getItem("brewlite_token");

      if (!token) {
        router.replace("/login?next=/checkout");
        return;
      }

      setCart(readCart());
      setHasPending(Boolean(readPending()));
      setReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [router]);

  const total = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const unauthorized = useCallback(() => {
    sessionStorage.removeItem("brewlite_token");
    window.dispatchEvent(new Event("brewlite-auth"));
    router.push("/login?next=/checkout");
  }, [router]);

  function finishExternalPayment(orderId: number) {
    localStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    window.dispatchEvent(new Event("brewlite-cart"));
    setExternalOrder(null);
    setHasPending(false);
    setCart([]);
    setResult({ orderId, status: "SUCCESS", failureReason: null });
  }

  function createNewOrder() {
    if (processingRef.current || busy || externalOrder) return;
    const pending = readPending();
    if (!pending) return;

    // Một yêu cầu thanh toán mất kết nối có thể đã thành công.
    // Không bỏ khóa idempotency khi trạng thái giao dịch chưa rõ.
    if (pending.idempotencyKey) {
      setError(
        "Có giao dịch chưa xác nhận. Vui lòng thử lại thanh toán " +
          "bằng cùng phương thức trước khi tạo đơn mới."
      );
      return;
    }

    sessionStorage.removeItem(PENDING_KEY);
    setHasPending(false);
    setCart(readCart());
    setError("Đã bỏ đơn cũ. Bạn có thể thanh toán để tạo đơn mới.");
  }

  async function pay() {
    if (processingRef.current || cart.length === 0 || externalOrder) return;

    const token = sessionStorage.getItem("brewlite_token");

    if (!token) {
      router.push("/login?next=/checkout");
      return;
    }

    if (method === "CARD" && !cardNumber.trim()) {
      setError("Vui lòng nhập số thẻ thử nghiệm.");
      return;
    }

    processingRef.current = true;
    setBusy(true);
    setError("");

    try {
      const items = cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        sugar: item.sugar,
        ice: item.ice,
        toppingIds: item.toppingIds,
      }));

      // Dùng cùng đơn hàng khi thanh toán thất bại.
      const snapshot = JSON.stringify({
        items,
        promotionCode: promotionCode.trim().toUpperCase(),
      });

      let pending = readPending();

      if (pending && pending.cartSnapshot !== snapshot) {
        setHasPending(true);
        throw new Error(
          "Giỏ hàng đã thay đổi. Bấm 'Tạo đơn mới' để " +
          "bỏ đơn cũ và đặt lại bằng giỏ hàng hiện tại."
        );
      }

      if (!pending) {
        const order = await postJson<Order>(
          "/orders",
          {
            items,
            ...(promotionCode.trim()
              ? {
                  promotionCode:
                    promotionCode.trim().toUpperCase(),
                }
              : {}),
          },
          token
        );

        pending = {
          orderId: order.id,
          cartSnapshot: snapshot,
        };

        savePending(pending);
        setHasPending(true);
      }

      // QR/VNPay tạo một đơn rồi giao việc thanh toán cho component có sẵn.
      if (method === "QR" || method === "VNPAY") {
        if (pending.idempotencyKey) {
          throw new Error(
            "Có giao dịch Thẻ/Ví chưa xác nhận. Vui lòng thử lại phương thức cũ trước."
          );
        }
        setExternalOrder({ orderId: pending.orderId, method, token });
        return;
      }

      const paymentBody = JSON.stringify({
        orderId: pending.orderId,
        method,
        ...(method === "CARD"
          ? { cardNumber: cardNumber.trim() }
          : {}),
      });

      // Nếu mạng mất sau khi gửi yêu cầu, dùng lại
      // khóa cũ với chính xác cùng nội dung thanh toán.
      if (
        pending.idempotencyKey &&
        pending.paymentBody !== paymentBody
      ) {
        throw new Error(
          "Có giao dịch chưa xác nhận. " +
          "Vui lòng thử lại với cùng phương thức thanh toán."
        );
      }

      const key =
        pending.idempotencyKey ?? crypto.randomUUID();

      pending = {
        ...pending,
        idempotencyKey: key,
        paymentBody,
      };

      savePending(pending);

      const payment = await postJson<PaymentResult>(
        "/payments",
        JSON.parse(paymentBody) as unknown,
        token,
        { "Idempotency-Key": key }
      );

      if (payment.status === "SUCCESS") {
        localStorage.removeItem(CART_KEY);
        sessionStorage.removeItem(PENDING_KEY);
        window.dispatchEvent(new Event("brewlite-cart"));
        setHasPending(false);
        setCart([]);
        setResult(payment);
      } else if (payment.status === "FAILED") {
        // Thanh toán thất bại đã được backend xác nhận.
        // Lần thử tiếp theo dùng Idempotency-Key mới.
        savePending({
          orderId: pending.orderId,
          cartSnapshot: snapshot,
        });

        setError(
          payment.failureReason ??
            "Thanh toán thất bại. Vui lòng thử lại."
        );
      } else {
        throw new Error("Trạng thái thanh toán không hợp lệ.");
      }
    } catch (caught) {
      const failure = caught as Error & { status?: number };

      if (failure.status === 401) {
        unauthorized();
        return;
      }

      // Chỉ áp dụng cho thông báo cụ thể từ API thanh toán,
      // không tự suy diễn mọi lỗi HTTP 400/409.
      const message = failure.message || "";
      const pending = readPending();
      const normalized = message.toLocaleLowerCase("vi-VN");

      if (
        failure.status === 400 &&
        pending &&
        (normalized.includes("đơn đã bị hủy") ||
          normalized.includes("đơn hàng đã bị hủy") ||
          normalized.includes("đơn đã hết hạn"))
      ) {
        sessionStorage.removeItem(PENDING_KEY);
        setHasPending(false);
        setError(
          "Đơn cũ đã hết hạn hoặc bị hủy. Giỏ hàng vẫn được giữ. " +
            "Bấm Thanh toán đơn hàng để tạo đơn mới."
        );
        return;
      }

      if (
        failure.status === 409 &&
        pending &&
        normalized.includes("đã được thanh toán")
      ) {
        localStorage.removeItem(CART_KEY);
        sessionStorage.removeItem(PENDING_KEY);
        window.dispatchEvent(new Event("brewlite-cart"));
        setHasPending(false);
        setCart([]);
        setResult({
          orderId: pending.orderId,
          status: "SUCCESS",
          failureReason: null,
          // API 409 không trả số điểm đã nhận.
        });
        return;
      }

      setError(
        message || "Không thể kết nối máy chủ. Vui lòng thử lại."
      );
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  }

  if (result?.status === "SUCCESS") {
    return (
      <main className="min-h-screen bg-[#F8F5EF] p-6 text-[#30271F]">
        <section className="mx-auto mt-12 max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-green-700">
            Thanh toán thành công!
          </h1>
          <p className="mt-4">
            Đơn hàng #{result.orderId} đã được thanh toán.
          </p>
          {typeof result.pointsEarned === "number" && (
            <p className="mt-2">
              Điểm nhận được: {result.pointsEarned}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/orders/${result.orderId}`}
              className="inline-block rounded-xl bg-[#30271F] px-6 py-3 text-white"
            >
              Theo dõi đơn
            </Link>
            <Link
              href="/menu"
              className="inline-block rounded-xl border border-[#DED4C7] px-6 py-3"
            >
              Quay lại thực đơn
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-2xl">
        <Link href="/cart" className="text-sm underline">
          ← Quay lại giỏ hàng
        </Link>

        <h1 className="my-8 text-3xl font-bold">
          Thanh toán đơn hàng
        </h1>

        {!ready ? (
          <p>Đang kiểm tra đăng nhập...</p>
        ) : cart.length === 0 ? (
          <div className="rounded-2xl bg-white p-8">
            Giỏ hàng đang trống.
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-2xl bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">
                Đơn hàng của bạn
              </h2>

              {cart.map((item) => (
                <div
                  key={item.key}
                  className="flex justify-between gap-3 border-b py-3"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      Size {item.size} · {item.topping}
                      {" "}· x{item.quantity}
                    </p>
                    <p className="text-sm text-gray-500">
                      Đường {item.sugar}% · Đá {item.ice}%
                    </p>
                  </div>
                  <strong>
                    {(
                      item.unitPrice * item.quantity
                    ).toLocaleString("vi-VN")}đ
                  </strong>
                </div>
              ))}

              <div className="mt-5 flex justify-between text-xl font-bold">
                <span>Tạm tính</span>
                <span>
                  {total.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Tổng thanh toán cuối cùng được máy chủ tính
                sau khi áp dụng khuyến mãi.
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6">
              <label className="block font-bold">
                Mã giảm giá (không bắt buộc)
                <input
                  value={promotionCode}
                  onChange={(e) =>
                    setPromotionCode(e.target.value)
                  }
                  disabled={busy || Boolean(readPendingSafe()) || Boolean(externalOrder)}
                  placeholder="Ví dụ: GIAM10"
                  className="mt-2 w-full rounded-xl border p-3 font-normal"
                />
              </label>
            </section>

            <section className="rounded-2xl bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">
                Phương thức thanh toán
              </h2>

              <label className="mb-3 flex gap-3 rounded-xl border p-4">
                <input
                  type="radio"
                  name="payment-method"
                  checked={method === "WALLET"}
                  onChange={() => setMethod("WALLET")}
                  disabled={busy || Boolean(externalOrder)}
                />
                Ví điện tử (mô phỏng)
              </label>

              <label className="flex gap-3 rounded-xl border p-4">
                <input
                  type="radio"
                  name="payment-method"
                  checked={method === "CARD"}
                  onChange={() => setMethod("CARD")}
                  disabled={busy || Boolean(externalOrder)}
                />
                Thẻ ngân hàng (mô phỏng)
              </label>

              <label className="mt-3 flex gap-3 rounded-xl border p-4">
                <input type="radio" name="payment-method" checked={method === "QR"}
                  onChange={() => setMethod("QR")} disabled={busy || Boolean(externalOrder)} />
                Thanh toán QR
              </label>
              <label className="mt-3 flex gap-3 rounded-xl border p-4">
                <input type="radio" name="payment-method" checked={method === "VNPAY"}
                  onChange={() => setMethod("VNPAY")} disabled={busy || Boolean(externalOrder)} />
                Thanh toán VNPay
              </label>

              {method === "CARD" && (
                <div className="mt-4">
                  <label className="block font-semibold">
                    Số thẻ thử nghiệm
                    <input
                      value={cardNumber}
                      onChange={(e) =>
                        setCardNumber(e.target.value)
                      }
                      disabled={busy}
                      placeholder="4242 4242 4242 4242"
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    Chỉ nhập số thẻ mô phỏng do nhóm cung cấp.
                    Không nhập thẻ ngân hàng thật.
                  </p>
                </div>
              )}
            </section>

            {hasPending && (
              <button
                type="button"
                disabled={busy || Boolean(externalOrder)}
                onClick={createNewOrder}
                className="w-full rounded-xl border border-[#84552D] bg-white px-5 py-3 font-semibold text-[#84552D] disabled:opacity-50"
              >
                Tạo đơn mới
              </button>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
              >
                {error}
              </p>
            )}

            {externalOrder ? (
              <section aria-label="Thanh toán qua cổng" className="space-y-3">
                <p className="text-sm text-[#766B60]">
                  Đơn hàng #{externalOrder.orderId} đã được tạo. Hoàn tất thanh toán bên dưới.
                </p>
                {externalOrder.method === "QR" ? (
                  <QrPaymentPanel
                    orderId={externalOrder.orderId}
                    authToken={externalOrder.token}
                    onPaid={() => finishExternalPayment(externalOrder.orderId)}
                    onUnauthorized={unauthorized}
                  />
                ) : (
                  <VnpayButton
                    orderId={externalOrder.orderId}
                    authToken={externalOrder.token}
                    onUnauthorized={unauthorized}
                  />
                )}
                <p className="text-xs text-gray-500">
                  Nếu VNPay chưa được bật, nút thanh toán sẽ tự ẩn. Đơn hàng vẫn được lưu để thử lại.
                </p>
              </section>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void pay()}
                className="w-full rounded-xl bg-[#30271F] py-4 font-bold text-white disabled:opacity-50"
              >
                {busy ? "Đang xử lý..." : "Thanh toán đơn hàng"}
              </button>
            )}

            <p className="text-center text-xs text-gray-500">
              Thanh toán mô phỏng, không trừ tiền thật.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// Không truy cập sessionStorage khi render phía server.
function readPendingSafe(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(PENDING_KEY));
}

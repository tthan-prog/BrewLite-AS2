"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DrinkArt } from "../../../components/drink-art";
import { ApiError, apiRequest } from "../../../lib/api";
import { formatVnd } from "../../../lib/cart";

type OrderStatus = "PENDING" | "PAID" | "PAYMENT_FAILED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

type OrderDetail = {
  id: number;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  promotionCode: string | null;
  failureReason: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    productId: number;
    name: string;
    quantity: number;
    size: string;
    sugar: number;
    ice: number;
    unitPrice: number;
    lineTotal: number;
    toppings: Array<{ id: number; name: string; price: number }>;
  }>;
  lastPayment: { method: string; status: string; amount: number; createdAt: string } | null;
};

const STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: "PENDING", label: "Đã đặt" },
  { status: "PAID", label: "Đã thanh toán" },
  { status: "PREPARING", label: "Đang pha chế" },
  { status: "READY", label: "Sẵn sàng nhận" },
  { status: "COMPLETED", label: "Hoàn tất" },
];

const METHOD: Record<string, string> = { WALLET: "Ví (mô phỏng)", CARD: "Thẻ (mô phỏng)", QR: "QR (mô phỏng)", VNPAY: "VNPay sandbox" };
const FINAL: OrderStatus[] = ["COMPLETED", "CANCELLED"];

/** /orders/[id]: chi tiết và tiến trình đơn của khách (FR-10, FR-11); tự cập nhật khi đơn chưa xong. */
export default function OrderDetailPage() {
  const id = String(useParams().id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const load = useCallback(async () => {
    const token = sessionStorage.getItem("brewlite_token");
    if (!token) {
      setNeedsLogin(true);
      setError("Bạn cần đăng nhập để xem đơn hàng.");
      return;
    }
    try {
      setOrder(await apiRequest<OrderDetail>(`/orders/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }));
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        sessionStorage.removeItem("brewlite_token");
        window.dispatchEvent(new Event("brewlite-auth"));
        setNeedsLogin(true);
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
        setError("Không tìm thấy đơn hàng này trong tài khoản của bạn.");
      } else {
        setError(e instanceof Error ? e.message : "Không tải được đơn hàng.");
      }
    }
  }, [id]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  // Đơn chưa xong thì hỏi lại mỗi 15 giây để thấy nhân viên đổi trạng thái
  useEffect(() => {
    if (!order || FINAL.includes(order.status)) return;
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [order, load]);

  const reached = order ? (order.status === "PAYMENT_FAILED" ? 0 : STEPS.findIndex((s) => s.status === order.status)) : -1;

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-3xl">
        <Link href="/orders/history" className="text-sm font-semibold text-[#84552D] hover:underline">← Lịch sử đơn</Link>

        {error && (
          <div role="alert" className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-red-700">{error}</p>
            {needsLogin && (
              <Link href={`/login?next=/orders/${encodeURIComponent(id)}`} className="mt-4 inline-flex rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</Link>
            )}
          </div>
        )}

        {!error && !order && <p role="status" className="mt-8 text-[#766B60]">Đang tải đơn hàng...</p>}

        {order && (
          <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#98734D]">Đơn hàng</p>
                <h1 className="text-3xl font-bold">#{order.id}</h1>
                <p className="text-sm text-[#766B60]">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
              </div>
              <strong className="text-2xl text-[#84552D]">{formatVnd(order.total)}</strong>
            </div>

            <section aria-label="Tiến trình đơn" className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
              {order.status === "CANCELLED" ? (
                <p className="font-semibold text-red-700">Đơn đã bị hủy.{order.failureReason ? ` ${order.failureReason}` : ""}</p>
              ) : (
                <>
                  <ol className="grid grid-cols-5 gap-1">
                    {STEPS.map((step, i) => (
                      <li key={step.status} className="text-center" aria-current={i === reached ? "step" : undefined}>
                        <span className={`mx-auto block h-2 rounded-full ${i <= reached ? "bg-[#84552D]" : "bg-[#EDE4D6]"}`} />
                        <span className={`mt-2 block text-xs ${i === reached ? "font-bold" : "text-[#766B60]"}`}>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                  {order.status === "PAYMENT_FAILED" && (
                    <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      Thanh toán chưa thành công{order.failureReason ? `: ${order.failureReason}` : ""}. Bạn có thể thanh toán lại ở trang thanh toán.
                    </p>
                  )}
                  {order.status === "PENDING" && (
                    <p className="mt-4 text-sm text-[#766B60]">Đơn chưa thanh toán sẽ tự hủy sau 15 phút.</p>
                  )}
                  {order.status === "READY" && <p className="mt-4 font-semibold text-green-800">Đồ uống đã sẵn sàng, mời bạn nhận tại quầy.</p>}
                </>
              )}
            </section>

            <section className="mt-5 space-y-3 rounded-2xl bg-white p-5 shadow-sm">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b border-[#F0EAE2] pb-3 last:border-0 last:pb-0">
                  <DrinkArt name={item.name} className="h-16 w-16 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {item.quantity} × {item.name}
                    </p>
                    <p className="text-sm text-[#766B60]">
                      Size {item.size} · Đường {item.sugar}% · Đá {item.ice}%
                      {item.toppings.length > 0 && ` · ${item.toppings.map((t) => t.name).join(", ")}`}
                    </p>
                  </div>
                  <p className="font-semibold">{formatVnd(item.lineTotal)}</p>
                </div>
              ))}
              <dl className="space-y-1 border-t border-[#EFE7DC] pt-3 text-sm">
                <div className="flex justify-between"><dt>Tạm tính</dt><dd>{formatVnd(order.subtotal)}</dd></div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-800"><dt>Giảm giá {order.promotionCode ? `(${order.promotionCode})` : ""}</dt><dd>−{formatVnd(order.discount)}</dd></div>
                )}
                <div className="flex justify-between text-base font-bold"><dt>Tổng cộng</dt><dd>{formatVnd(order.total)}</dd></div>
                {order.lastPayment && (
                  <div className="flex justify-between text-[#766B60]">
                    <dt>Thanh toán</dt>
                    <dd>{METHOD[order.lastPayment.method] ?? order.lastPayment.method} · {order.lastPayment.status === "SUCCESS" ? "thành công" : "không thành công"}</dd>
                  </div>
                )}
              </dl>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

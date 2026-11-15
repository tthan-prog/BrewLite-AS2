"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

type Order = {
  id?: string | number;
  orderCode?: string;
  orderNumber?: string;
  code?: string;
  status?: string;
  total?: number;
  totalAmount?: number;
  createdAt?: string;
  created_at?: string;
};

type OrdersResponse = Order[] | { data?: Order[]; items?: Order[] };

function getOrders(payload: OrdersResponse): Order[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
}

function formatMoney(value?: number) {
  return typeof value === "number" ? `${value.toLocaleString("vi-VN")} ₫` : "—";
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [needsLogin, setNeedsLogin] = useState(false);

  const loadOrders = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    const token = sessionStorage.getItem("brewlite_token");
    if (!token) {
      setNeedsLogin(true);
      setError("Bạn cần đăng nhập trước khi xem lịch sử đơn hàng.");
      setOrders([]);
      setLoading(false);
      return;
    }

    setNeedsLogin(false);
    try {
      const result = await apiRequest<OrdersResponse>("/orders/me", {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!signal.aborted) setOrders(getOrders(result));
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "Không thể tải lịch sử đơn hàng.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders, retryKey]);

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-10 text-[#30271F] sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/menu" className="text-sm font-semibold text-[#84552D] hover:underline">← Quay lại thực đơn</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#98734D]">Tài khoản BrewLite</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Lịch sử đơn hàng</h1>
        <p className="mt-2 text-[#766B60]">Theo dõi trạng thái những đơn hàng của bạn.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="min-w-0 rounded-2xl border border-[#E8DFD3] bg-white p-5 shadow-sm sm:p-7">
            {loading ? (
              <div role="status" className="py-16 text-center">
                <p className="font-semibold">Đang tải đơn hàng...</p>
                <p className="mt-2 text-sm text-[#766B60]">Đang lấy dữ liệu từ hệ thống.</p>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <h2 className="text-xl font-bold">Chưa thể tải lịch sử</h2>
                <p role="alert" className="mx-auto mt-3 max-w-lg text-sm leading-6 text-red-700">{error}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {needsLogin && <Link href="/login" className="rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Đăng nhập</Link>}
                  <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="rounded-xl border border-[#DED4C7] px-5 py-3 text-sm font-semibold">Thử lại</button>
                </div>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center">
                <h2 className="text-xl font-bold">Bạn chưa có đơn hàng</h2>
                <p className="mt-3 text-sm text-[#766B60]">Khi bạn hoàn tất đơn đầu tiên, thông tin sẽ được hiển thị ở đây.</p>
                <Link href="/menu" className="mt-6 inline-flex rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Đặt đồ uống</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-[#E8DFD3] text-xs uppercase tracking-wider text-[#766B60]"><th className="px-3 py-4">Mã đơn</th><th className="px-3 py-4">Ngày đặt</th><th className="px-3 py-4">Trạng thái</th><th className="px-3 py-4 text-right">Tổng tiền</th></tr></thead>
                  <tbody>{orders.map((order, index) => <tr key={order.id ?? order.orderCode ?? index} className="border-b border-[#F0EAE2] last:border-0"><td className="px-3 py-4 font-semibold">{order.orderCode ?? order.orderNumber ?? order.code ?? `#${order.id ?? index + 1}`}</td><td className="px-3 py-4">{formatDate(order.createdAt ?? order.created_at)}</td><td className="px-3 py-4"><span className="inline-flex rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#76502F]">{order.status ?? "PENDING"}</span></td><td className="px-3 py-4 text-right font-semibold">{formatMoney(order.total ?? order.totalAmount)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="h-fit rounded-2xl border border-[#E8DFD3] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Thông tin riêng tư</h2>
            <p className="mt-3 text-sm leading-6 text-[#766B60]">Lịch sử chỉ hiển thị đơn hàng thuộc tài khoản đang đăng nhập.</p>
            <Link href="/menu" className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Đặt đồ uống</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

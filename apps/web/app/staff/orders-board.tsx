"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatMoney,
  formatTime,
  NEXT_ACTIONS,
  STATUS_LABEL,
  StaffApiError,
  staffRequest,
  type OrderStatus,
  type StaffOrder,
  type StaffTarget,
} from "./staff-api";

const FILTERS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "PAID", label: "Chờ pha" },
  { value: "PREPARING", label: "Đang pha" },
  { value: "READY", label: "Sẵn sàng" },
  { value: "PENDING", label: "Chờ thanh toán" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "ALL", label: "Tất cả" },
];

/** Danh sách đơn theo trạng thái và nút chuyển trạng thái (FR-10, FR-15). Tự làm mới mỗi 20 giây. */
export function OrdersBoard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [filter, setFilter] = useState<OrderStatus | "ALL">("PAID");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const data = await staffRequest<StaffOrder[]>(`/orders${query}`);
      setOrders(data);
      setError("");
    } catch (e) {
      if (e instanceof StaffApiError && (e.status === 401 || e.status === 403)) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Không tải được đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [filter, onUnauthorized]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function change(order: StaffOrder, to: StaffTarget) {
    if (to === "CANCELLED" && !window.confirm(`Hủy đơn #${order.id}?`)) return;
    setUpdating(order.id);
    setNotice("");
    try {
      await staffRequest(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: to }) });
      setNotice(`Đơn #${order.id}: ${STATUS_LABEL[to]}`);
      await load();
    } catch (e) {
      if (e instanceof StaffApiError && (e.status === 401 || e.status === 403)) return onUnauthorized();
      // Tải lại trước rồi mới hiện lỗi, để lần tải lại thành công không xóa mất thông báo
      await load();
      setError(e instanceof Error ? e.message : "Không cập nhật được đơn.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo trạng thái">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value}
            onClick={() => {
              setLoading(true);
              setFilter(f.value);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filter === f.value ? "bg-[#98734D] text-white" : "border border-[#DED4C7] bg-white"
            }`}>
            {f.label}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto text-sm font-semibold text-[#84552D] hover:underline">
          Làm mới
        </button>
      </div>

      {notice && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p role="status" className="py-12 text-center text-[#766B60]">Đang tải đơn hàng...</p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl bg-white py-12 text-center text-[#766B60]">Không có đơn nào ở trạng thái này.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-[#E8DFD3] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">#{order.id}</p>
                  <p className="text-sm text-[#766B60]">{order.customerName} · {formatTime(order.createdAt)}</p>
                </div>
                <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#76502F]">
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span className="font-semibold">{item.quantity} × {item.name}</span>{" "}
                    <span className="text-[#766B60]">
                      size {item.size}, đường {item.sugar}%, đá {item.ice}%
                      {item.toppings.length > 0 && `, + ${item.toppings.map((t) => t.name).join(", ")}`}
                    </span>
                  </li>
                ))}
              </ul>
              {order.failureReason && <p className="mt-2 text-xs text-red-700">{order.failureReason}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{formatMoney(order.total)}</span>
                <div className="flex gap-2">
                  {NEXT_ACTIONS[order.status].map((action) => (
                    <button key={action.to} type="button" disabled={updating === order.id}
                      onClick={() => void change(order, action.to)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                        action.to === "CANCELLED" ? "border border-red-200 text-red-700" : "bg-[#30271F] text-white"
                      }`}>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

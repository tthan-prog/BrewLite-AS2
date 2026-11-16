"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { confirmVnpayReturn, type VnpayResult } from "../../../lib/vnpay";

type State = { kind: "loading" } | { kind: "done"; result: VnpayResult } | { kind: "error"; message: string };

/**
 * VNPay sandbox chuyển khách về đây (VNPAY_RETURN_URL) kèm kết quả trong query.
 * Trang không tự tin kết quả trên URL: gửi nguyên query về API để kiểm tra chữ ký HMAC
 * và số tiền rồi mới hiển thị (FR-21).
 */
export default function VnpayReturnPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const search = window.location.search;
    const timer = setTimeout(async () => {
      if (!search.includes("vnp_")) {
        setState({ kind: "error", message: "Không có thông tin giao dịch VNPay." });
        return;
      }
      try {
        const result = await confirmVnpayReturn(search);
        if (result.status === "SUCCESS") {
          localStorage.removeItem("brewlite-as2-cart");
          sessionStorage.removeItem("brewlite-as2-pending-payment");
          window.dispatchEvent(new Event("brewlite-cart"));
        }
        setState({ kind: "done", result });
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : "Không xác nhận được giao dịch." });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-10 text-[#30271F]">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#98734D]">VNPay sandbox</p>
        {state.kind === "loading" && (
          <p role="status" className="mt-6 text-[#766B60]">Đang xác nhận giao dịch với máy chủ...</p>
        )}
        {state.kind === "error" && (
          <div role="alert" className="mt-6">
            <h1 className="text-2xl font-bold">Không xác nhận được giao dịch</h1>
            <p className="mt-3 text-sm text-red-700">{state.message}</p>
          </div>
        )}
        {state.kind === "done" && state.result.status === "SUCCESS" && (
          <div role="status" className="mt-6">
            <h1 className="text-2xl font-bold text-green-800">Thanh toán thành công</h1>
            <p className="mt-3 text-sm text-[#766B60]">
              Đơn #{state.result.orderId} · {state.result.amount.toLocaleString("vi-VN")} ₫
              {state.result.pointsEarned > 0 && ` · +${state.result.pointsEarned} điểm`}
            </p>
          </div>
        )}
        {state.kind === "done" && state.result.status === "FAILED" && (
          <div role="alert" className="mt-6">
            <h1 className="text-2xl font-bold">Thanh toán không thành công</h1>
            <p className="mt-3 text-sm text-red-700">{state.result.failureReason ?? "Giao dịch không thành công."}</p>
            <p className="mt-1 text-sm text-[#766B60]">Giỏ hàng vẫn được giữ, bạn có thể thanh toán lại.</p>
          </div>
        )}
        <div className="mt-8 flex justify-center gap-3">
          {state.kind === "done" ? (
            <Link href={`/orders/${state.result.orderId}`} className="rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Theo dõi đơn</Link>
          ) : (
            <Link href="/orders/history" className="rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Lịch sử đơn</Link>
          )}
          <Link href="/menu" className="rounded-xl border border-[#DED4C7] px-5 py-3 text-sm font-semibold">Thực đơn</Link>
        </div>
      </div>
    </main>
  );
}

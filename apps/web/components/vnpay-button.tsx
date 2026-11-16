"use client";

import { useEffect, useState } from "react";
import { createVnpayPayment, vnpayEnabled } from "../lib/vnpay";

interface Props {
  orderId: number;
  authToken: string;
  onUnauthorized?: () => void;
}

/**
 * Nút "Thanh toán qua VNPay" (FR-21): tạo URL đã ký ở máy chủ rồi chuyển khách sang cổng VNPay sandbox.
 * Tự ẩn khi máy chủ chưa cấu hình VNPay. Dùng trong trang thanh toán: <VnpayButton orderId={id} authToken={token} />
 */
export function VnpayButton({ orderId, authToken, onUnauthorized }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    vnpayEnabled().then(setEnabled, () => setEnabled(false));
  }, []);

  if (!enabled) return null;

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const { paymentUrl } = await createVnpayPayment(orderId, authToken);
      window.location.assign(paymentUrl);
    } catch (e) {
      if ((e as { status?: number }).status === 401) return onUnauthorized?.();
      setError(e instanceof Error ? e.message : "Không tạo được giao dịch VNPay.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void pay()} disabled={busy}
        className="w-full rounded-xl border-2 border-[#005BAA] px-5 py-3 font-semibold text-[#005BAA] disabled:opacity-60">
        {busy ? "Đang chuyển sang VNPay..." : "Thanh toán qua VNPay (sandbox)"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

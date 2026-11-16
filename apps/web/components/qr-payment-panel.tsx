"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatCountdown,
  formatVnd,
  QrApiError,
  qrRequest,
  secondsLeft,
  type QrIntent,
  type QrStatus,
} from "../lib/qr-payment";

interface Props {
  orderId: number;
  /** JWT của khách (sessionStorage "brewlite_token"). */
  authToken: string;
  /** Gọi một lần khi điện thoại xác nhận thành công. */
  onPaid: () => void;
  /** API trả 401: phiên đăng nhập hết hạn. */
  onUnauthorized?: () => void;
  /** Chu kỳ hỏi trạng thái (ms), mặc định 3 giây. */
  pollMs?: number;
}

/**
 * Hiển thị mã QR cho đơn (FR-18) và tự hỏi trạng thái; khi điện thoại xác nhận xong thì gọi onPaid
 * để trang đặt hàng chuyển sang màn hình xác nhận. Mã thất bại hoặc hết hạn thì cho tạo mã mới.
 * Dùng trong trang thanh toán: <QrPaymentPanel orderId={id} authToken={token} onPaid={...} />
 */
export function QrPaymentPanel({ orderId, authToken, onPaid, onUnauthorized, pollMs = 3000 }: Props) {
  const [intent, setIntent] = useState<QrIntent | null>(null);
  const [status, setStatus] = useState<QrStatus>("PENDING");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const paidRef = useRef(false);

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof QrApiError && e.status === 401) return onUnauthorized?.();
      setError(e instanceof Error ? e.message : "Không tạo được mã QR.");
    },
    [onUnauthorized],
  );

  const create = useCallback(async () => {
    setError("");
    try {
      const created = await qrRequest<QrIntent>("/payments/qr", { method: "POST", body: JSON.stringify({ orderId }) }, authToken);
      setIntent(created);
      setStatus(created.status);
    } catch (e) {
      handleError(e);
    }
  }, [orderId, authToken, handleError]);

  useEffect(() => {
    const timer = setTimeout(() => void create(), 0);
    return () => clearTimeout(timer);
  }, [create]);

  useEffect(() => {
    if (!intent || status !== "PENDING") return;
    const poll = setInterval(async () => {
      try {
        const res = await qrRequest<{ status: QrStatus }>(`/payments/qr/${intent.token}/status`, {}, authToken);
        setStatus(res.status);
        if (res.status === "PAID" && !paidRef.current) {
          paidRef.current = true;
          onPaid();
        }
      } catch (e) {
        handleError(e);
      }
    }, pollMs);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [intent, status, authToken, pollMs, onPaid, handleError]);

  if (error && !intent) {
    return (
      <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
        {error}{" "}
        <button type="button" onClick={() => void create()} className="font-semibold underline">Thử lại</button>
      </div>
    );
  }
  if (!intent) return <p role="status" className="text-sm text-[#766B60]">Đang tạo mã QR...</p>;

  const left = secondsLeft(intent.expiresAt, now);
  const unusable = status === "FAILED" || status === "EXPIRED" || (status === "PENDING" && left === 0);

  return (
    <div className="rounded-2xl border border-[#E8DFD3] bg-white p-5 text-center">
      {status === "PAID" ? (
        <p role="status" className="font-semibold text-green-800">Đã thanh toán. Đang chuyển sang xác nhận đơn...</p>
      ) : unusable ? (
        <div role="alert">
          <p className="font-semibold text-red-800">
            {status === "FAILED" ? "Thanh toán bằng mã này không thành công." : "Mã QR đã hết hạn."}
          </p>
          <button type="button" onClick={() => void create()}
            className="mt-3 rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">
            Tạo mã QR mới
          </button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh data URL do API tạo */}
          <img src={intent.qrImage} alt={`Mã QR thanh toán đơn #${intent.orderId}`} width={220} height={220} className="mx-auto" />
          <p className="mt-3 text-lg font-bold">{formatVnd(intent.amount)}</p>
          <p className="text-sm text-[#766B60]">Quét bằng điện thoại để thanh toán · còn {formatCountdown(left)}</p>
          <a href={intent.qrContent} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#84552D] underline">
            Mở trang xác nhận trên máy này
          </a>
        </>
      )}
    </div>
  );
}

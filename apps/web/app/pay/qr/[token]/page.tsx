"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  formatCountdown,
  formatVnd,
  QrApiError,
  qrRequest,
  secondsLeft,
  type QrPaymentResult,
  type QrPublic,
} from "../../../../lib/qr-payment";

/**
 * Trang mở trên điện thoại sau khi quét mã QR (FR-18). Không cần đăng nhập:
 * chọn tài khoản thử nghiệm, nhập PIN 6 số để xác nhận thanh toán.
 */
export default function QrConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [intent, setIntent] = useState<QrPublic | null>(null);
  const [loadError, setLoadError] = useState("");
  const [account, setAccount] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QrPaymentResult | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const data = await qrRequest<QrPublic>(`/payments/qr/${encodeURIComponent(token)}`);
      setIntent(data);
      setAccount((current) => current || data.accounts[0]?.identifier || "");
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof QrApiError && e.status === 404 ? "Mã QR không tồn tại." : e instanceof Error ? e.message : "Không tải được mã QR.");
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN gồm 6 chữ số.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const paid = await qrRequest<QrPaymentResult>(`/payments/qr/${encodeURIComponent(token)}/confirm`, {
        method: "POST",
        body: JSON.stringify({ accountIdentifier: account, pin }),
      });
      setResult(paid);
      setPin("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xác nhận được thanh toán.");
      setPin("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const left = intent ? secondsLeft(intent.expiresAt, now) : 0;
  const expired = intent?.status === "EXPIRED" || (intent?.status === "PENDING" && left === 0);

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#98734D]">Cổng thanh toán thử nghiệm</p>
        <h1 className="mt-2 text-2xl font-bold">Xác nhận thanh toán</h1>

        {loadError ? (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
        ) : !intent ? (
          <p role="status" className="mt-6 text-[#766B60]">Đang tải thông tin thanh toán...</p>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-[#F3EBDD] p-4 text-center">
              <p className="text-sm text-[#766B60]">Đơn #{intent.orderId} – BrewLite</p>
              <p className="mt-1 text-3xl font-bold">{formatVnd(intent.amount)}</p>
              {intent.status === "PENDING" && !expired && (
                <p className="mt-2 text-sm text-[#766B60]">Mã hết hạn sau {formatCountdown(left)}</p>
              )}
            </div>

            {result?.status === "SUCCESS" || intent.status === "PAID" ? (
              <div role="status" className="mt-6 rounded-2xl bg-green-50 p-5 text-center text-green-900">
                <p className="text-lg font-bold">Thanh toán thành công</p>
                <p className="mt-1 text-sm">Bạn có thể quay lại màn hình đặt hàng.</p>
              </div>
            ) : result?.status === "FAILED" || intent.status === "FAILED" ? (
              <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-center text-red-800">
                <p className="text-lg font-bold">Thanh toán không thành công</p>
                <p className="mt-1 text-sm">{result?.failureReason ?? "Mã QR này không còn dùng được."} Vui lòng tạo mã mới ở màn hình đặt hàng.</p>
              </div>
            ) : expired ? (
              <p role="alert" className="mt-6 rounded-2xl bg-amber-50 p-5 text-center text-amber-900">
                Mã QR đã hết hạn. Vui lòng tạo mã mới ở màn hình đặt hàng.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Tài khoản thanh toán</legend>
                  <div className="space-y-2">
                    {intent.accounts.map((a) => (
                      <label key={a.identifier}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${account === a.identifier ? "border-[#98734D] bg-[#FBF7F1]" : "border-[#DED4C7]"}`}>
                        <input type="radio" name="account" value={a.identifier} checked={account === a.identifier}
                          onChange={() => setAccount(a.identifier)} />
                        <span>
                          <span className="block font-semibold">{a.identifier}</span>
                          <span className="block text-xs text-[#766B60]">{a.holderName}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="qr-pin" className="mb-1 block text-sm font-semibold">PIN (6 số)</label>
                  <input id="qr-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-[#98734D]" />
                </div>
                {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={busy || !account}
                  className="w-full rounded-xl bg-[#30271F] px-5 py-3.5 font-semibold text-white disabled:opacity-60">
                  {busy ? "Đang xác nhận..." : `Thanh toán ${formatVnd(intent.amount)}`}
                </button>
              </form>
            )}
          </>
        )}
        <p className="mt-6 text-center text-xs text-[#766B60]">Môi trường thử nghiệm, không dùng tiền thật.</p>
      </div>
    </main>
  );
}

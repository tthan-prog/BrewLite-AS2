"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DrinkArt } from "../../components/drink-art";
import { checkAvailability, formatVnd, MAX_QUANTITY_PER_LINE, readCart, writeCart, type AvailabilityLine, type CartItem } from "../../lib/cart";

type Check = { state: "idle" | "checking" | "done" | "error"; lines: Record<string, AvailabilityLine> };

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle", lines: {} });

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setCart(readCart());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Kiểm tra nguyên liệu cho cả giỏ mỗi khi giỏ đổi: hai món dùng chung nguyên liệu thì tranh nhau phần còn lại.
  useEffect(() => {
    if (!ready || cart.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCheck((c) => ({ ...c, state: "checking" }));
      try {
        const result = await checkAvailability(cart, controller.signal);
        const lines: Record<string, AvailabilityLine> = {};
        cart.forEach((item, i) => (lines[item.key] = result.lines[i]));
        setCheck({ state: "done", lines });
      } catch {
        if (!controller.signal.aborted) setCheck({ state: "error", lines: {} });
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [cart, ready]);

  function updateCart(next: CartItem[]) {
    setCart(next);
    writeCart(next);
  }

  function changeQuantity(key: string, amount: number) {
    updateCart(
      cart
        .map((item) => (item.key === key ? { ...item, quantity: Math.min(MAX_QUANTITY_PER_LINE, item.quantity + amount) } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cups = cart.reduce((sum, item) => sum + item.quantity, 0);
  const problems = cart.filter((item) => check.lines[item.key] && !check.lines[item.key].ok);
  const blocked = check.state === "checking" || problems.length > 0;

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-3xl">
        <Link href="/menu" className="text-sm font-semibold text-[#84552D] hover:underline">← Tiếp tục chọn món</Link>
        <h1 className="my-6 text-3xl font-bold">Giỏ hàng của bạn</h1>

        {!ready ? (
          <p role="status">Đang tải giỏ hàng...</p>
        ) : cart.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <p className="text-4xl" aria-hidden>🛒</p>
            <p className="mt-3">Giỏ hàng hiện đang trống.</p>
            <Link href="/menu" className="mt-5 inline-block rounded-xl bg-[#30271F] px-5 py-3 font-semibold text-white">Xem thực đơn</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item) => {
              const line = check.lines[item.key];
              const atMax = item.quantity >= Math.min(MAX_QUANTITY_PER_LINE, line ? line.maxQuantity : MAX_QUANTITY_PER_LINE);
              return (
                <article key={item.key} className={`rounded-2xl bg-white p-4 shadow-sm sm:p-5 ${line && !line.ok ? "ring-2 ring-red-300" : ""}`}>
                  <div className="flex gap-4">
                    <Link href={`/product/${item.productId}`} className="shrink-0 overflow-hidden rounded-xl">
                      <DrinkArt name={item.name} className="h-20 w-20" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold">{item.name}</h2>
                          <p className="mt-1 text-sm text-[#766B60]">Size {item.size} · {item.topping}</p>
                          <p className="text-sm text-[#766B60]">Đường {item.sugar}% · Đá {item.ice}%</p>
                          <p className="mt-1 text-sm font-semibold">{formatVnd(item.unitPrice)} / ly</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" title="Giảm" onClick={() => changeQuantity(item.key, -1)} className="h-9 w-9 rounded-lg bg-[#F1EBE2]">−</button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <button type="button" title="Tăng" onClick={() => changeQuantity(item.key, 1)} disabled={atMax} className="h-9 w-9 rounded-lg bg-[#F1EBE2] disabled:opacity-40">+</button>
                        </div>
                      </div>
                      {line && !line.ok && (
                        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                          {line.message}
                          {line.maxQuantity > 0 && " Hãy giảm số lượng hoặc đổi lựa chọn."}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-[#EFE7DC] pt-3">
                        <strong>{formatVnd(item.unitPrice * item.quantity)}</strong>
                        <button type="button" onClick={() => updateCart(cart.filter((x) => x.key !== item.key))} className="text-sm text-red-700 underline">Xóa món</button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex justify-between text-sm text-[#766B60]">
                <span>{cups} ly</span>
                <span>Khuyến mãi nhập ở bước thanh toán</span>
              </div>
              <div className="mt-2 flex justify-between text-xl font-bold">
                <span>Tổng cộng</span>
                <span className="text-[#84552D]">{formatVnd(total)}</span>
              </div>
              {check.state === "error" && (
                <p className="mt-3 text-xs text-[#766B60]">Chưa kiểm tra được nguyên liệu; hệ thống sẽ kiểm tra lại khi đặt đơn.</p>
              )}
              {blocked ? (
                <button type="button" disabled className="mt-5 block w-full rounded-xl bg-[#30271F] px-5 py-4 text-center font-bold text-white opacity-40">
                  {check.state === "checking" ? "Đang kiểm tra nguyên liệu..." : "Điều chỉnh giỏ hàng để tiếp tục"}
                </button>
              ) : (
                <Link href="/checkout" className="mt-5 block rounded-xl bg-[#30271F] px-5 py-4 text-center font-bold text-white hover:bg-[#4A392B]">
                  Tiếp tục thanh toán
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

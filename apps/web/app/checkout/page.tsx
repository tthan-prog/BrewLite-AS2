
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CartItem = {
  key: string;
  name: string;
  size: string;
  topping: string;
  quantity: number;
  unitPrice: number;
};


function readCart(): CartItem[] {
  try {
    const saved = localStorage.getItem("brewlite-as2-cart");
    const parsed: unknown = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}


type Method = "wallet" | "card";

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<Method>("wallet");

  
useEffect(() => {
  const id = window.requestAnimationFrame(() => {
    setCart(readCart());
    setReady(true);
  });

  return () => window.cancelAnimationFrame(id);
}, []);


  const total = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

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
          <p>Đang tải đơn hàng...</p>
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
                      Size {item.size} · {item.topping} · x{item.quantity}
                    </p>
                  </div>
                  <strong>
                    {(item.unitPrice * item.quantity).toLocaleString("vi-VN")}đ
                  </strong>
                </div>
              ))}

              <div className="mt-5 flex justify-between text-xl font-bold">
                <span>Tổng tiền</span>
                <span className="text-[#84552D]">
                  {total.toLocaleString("vi-VN")}đ
                </span>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">
                Phương thức thanh toán
              </h2>

              <div className="space-y-3">
                <label className="flex cursor-pointer gap-3 rounded-xl border p-4">
                  <input
                    type="radio"
                    checked={method === "wallet"}
                    onChange={() => setMethod("wallet")}
                  />
                  Ví điện tử (mô phỏng)
                </label>

                <label className="flex cursor-pointer gap-3 rounded-xl border p-4">
                  <input
                    type="radio"
                    checked={method === "card"}
                    onChange={() => setMethod("card")}
                  />
                  Thẻ ngân hàng (mô phỏng)
                </label>
              </div>
            </section>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Đây là giao diện thử nghiệm.
              Chưa kết nối API tạo đơn và thanh toán NestJS.
              Không có giao dịch tiền thật nào được thực hiện.
            </div>

            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl bg-gray-400 py-4 font-bold text-white"
            >
              Thanh toán {total.toLocaleString("vi-VN")}đ
              {" "}– Chờ kết nối API
            </button>
          </div>
        )}
      </div>
    </main>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CartItem = {
  key: string;
  productId: string;
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


export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  
useEffect(() => {
  const id = window.requestAnimationFrame(() => {
    setCart(readCart());
    setReady(true);
  });

  return () => window.cancelAnimationFrame(id);
}, []);


  function updateCart(next: CartItem[]) {
    setCart(next);
    localStorage.setItem("brewlite-as2-cart", JSON.stringify(next));
  }

  function changeQuantity(key: string, amount: number) {
    const next = cart
      .map((item) =>
        item.key === key
          ? { ...item, quantity: item.quantity + amount }
          : item
      )
      .filter((item) => item.quantity > 0);

    updateCart(next);
  }

  function removeItem(key: string) {
    updateCart(cart.filter((item) => item.key !== key));
  }

  const total = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-3xl">
        <Link href="/menu" className="text-sm underline">
          ← Tiếp tục chọn món
        </Link>

        <h1 className="my-8 text-3xl font-bold">Giỏ hàng của bạn</h1>

        {!ready ? (
          <p>Đang tải giỏ hàng...</p>
        ) : cart.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center">
            <p>Giỏ hàng hiện đang trống.</p>
            <Link
              href="/menu"
              className="mt-4 inline-block rounded-xl bg-[#30271F] px-5 py-3 text-white"
            >
              Xem thực đơn
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item) => (
              <article
                key={item.key}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">{item.name}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Size {item.size} · {item.topping}
                    </p>
                    <p className="mt-2 font-semibold">
                      {item.unitPrice.toLocaleString("vi-VN")}đ / ly
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => changeQuantity(item.key, -1)}
                      className="rounded-lg bg-gray-100 px-3 py-2"
                    >−</button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => changeQuantity(item.key, 1)}
                      className="rounded-lg bg-gray-100 px-3 py-2"
                    >+</button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <strong>
                    {(item.unitPrice * item.quantity).toLocaleString("vi-VN")}đ
                  </strong>
                  <button
                    onClick={() => removeItem(item.key)}
                    className="text-sm text-red-600 underline"
                  >
                    Xóa món
                  </button>
                </div>
              </article>
            ))}

            <div className="rounded-2xl bg-white p-6">
              <div className="flex justify-between text-xl font-bold">
                <span>Tổng cộng</span>
                <span className="text-[#84552D]">
                  {total.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <Link
                href="/checkout"
                className="mt-5 block rounded-xl bg-[#30271F] px-5 py-4 text-center font-bold text-white"
                >
                    Tiếp tục thanh toán
                </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DrinkArt } from "../components/drink-art";
import { formatVnd } from "../lib/cart";
import { API_URL } from "../lib/config";

type Product = { id: number; name: string; description: string; price: number; category: string; available: boolean };

const STEPS = [
  { title: "Chọn món", text: "Size, topping, mức đường và đá theo ý bạn." },
  { title: "Thanh toán", text: "Ví, thẻ, QR hoặc VNPay ngay trên điện thoại." },
  { title: "Nhận đồ uống", text: "Theo dõi đơn đến khi sẵn sàng tại quầy." },
];

/** Trang chủ: giới thiệu, món nổi bật lấy từ API, các bước đặt món. */
export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/products`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Product[]>) : []))
      .then((list) => setFeatured(list.filter((p) => p.available).slice(0, 3)))
      .catch(() => undefined); // Trang chủ vẫn hiển thị khi API đang khởi động
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F5EF] text-[#30271F]">
      <section className="bg-[#EDE4D6] px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#98734D]">BrewLite Coffee House</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Đặt đồ uống nhanh, không cần xếp hàng.</h1>
            <p className="mt-5 max-w-md text-[#685B4B]">Chọn món trên điện thoại, thanh toán không tiền mặt và nhận đồ uống khi quầy báo sẵn sàng.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className="rounded-xl bg-[#30271F] px-6 py-3.5 font-semibold text-white hover:bg-[#4A392B]">Xem thực đơn</Link>
              <Link href="/orders/history" className="rounded-xl border border-[#30271F]/20 bg-white/60 px-6 py-3.5 font-semibold hover:bg-white">Đơn của tôi</Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3" aria-hidden>
            {["Cà phê sữa đá", "Matcha latte", "Trà sữa trân châu"].map((name, i) => (
              <DrinkArt key={name} name={name} className={`w-full rounded-2xl shadow-sm ${i === 1 ? "translate-y-6" : ""}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-2xl font-bold">Cách đặt món</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-[#E8DFD3] bg-white p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#30271F] font-bold text-white">{i + 1}</span>
              <h3 className="mt-3 font-bold">{step.title}</h3>
              <p className="mt-1 text-sm text-[#766B60]">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-14">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold">Món nổi bật</h2>
            <Link href="/menu" className="text-sm font-semibold text-[#84552D] hover:underline">Xem tất cả →</Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {featured.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} className="overflow-hidden rounded-2xl border border-[#E8DFD3] bg-white shadow-sm transition hover:shadow-md">
                <DrinkArt name={p.name} category={p.category} className="h-36 w-full" />
                <div className="p-4">
                  <h3 className="font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-[#766B60]">{p.description}</p>
                  <p className="mt-2 font-semibold text-[#84552D]">{formatVnd(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="bg-[#30271F] px-5 py-8 text-center text-sm text-[#D9CFC2]">BrewLite Coffee House · Đồ án Công nghệ phần mềm</footer>
    </main>
  );
}

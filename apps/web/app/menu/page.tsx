"use client";

import Link from "next/link";
import { API_URL } from "../../lib/config";
import { useEffect, useState } from "react";

type Product = {
  id: string | number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  available: boolean;
  maxQuantity: number;
};

async function fetchProducts(signal: AbortSignal): Promise<Product[]> {
  const response = await fetch(`${API_URL}/products`, { signal });

  if (!response.ok) {
    throw new Error("Không thể tải thực đơn");
  }

  const data: unknown = await response.json();

  // Hỗ trợ cả dạng mảng và dạng { value: [...] }.
  let products: unknown;
  if (Array.isArray(data)) {
    products = data;
  } else if (typeof data === "object" && data !== null && "value" in data) {
    products = data.value;
  }

  if (!Array.isArray(products)) {
    throw new Error("Dữ liệu sản phẩm không hợp lệ");
  }

  // Chuẩn hóa dữ liệu API, đặc biệt là trạng thái tồn kho.
  return products.map((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Dữ liệu sản phẩm không hợp lệ");
    }
    const product = item as Record<string, unknown>;
    if (
      (typeof product.id !== "number" && typeof product.id !== "string") ||
      typeof product.name !== "string" ||
      typeof product.price !== "number"
    ) {
      throw new Error("Dữ liệu sản phẩm không hợp lệ");
    }
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      description: typeof product.description === "string" ? product.description : undefined,
      category: typeof product.category === "string" ? product.category : undefined,
      // Thiếu trạng thái tồn kho => không cho chọn món, tránh đặt nhầm hàng hết.
      available: product.available === true,
      maxQuantity: typeof product.maxQuantity === "number" && Number.isFinite(product.maxQuantity)
        ? product.maxQuantity
        : 0,
    };
  });
}

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setProducts(data);
        setError("");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Không thể tải thực đơn. Vui lòng thử lại.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retryKey]);

  function handleRetry() {
    setLoading(true);
    setError("");
    setRetryKey((previous) => previous + 1);
  }

  const categories = [
    "Tất cả",
    ...Array.from(new Set(products.map((p) => p.category || "Đồ uống"))),
  ];

  const filteredProducts = products.filter((product) => {
    const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      category === "Tất cả" || (product.category || "Đồ uống") === category;
    return matchSearch && matchCategory;
  });

  return (
    <main className="min-h-screen bg-[#F8F5EF] text-[#30271F]">

      <section className="bg-[#EDE4D6] px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#98734D]">
            BrewLite Coffee House
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-5xl">
            Một chút cà phê,
            <br />
            một ngày thật vui.
          </h1>
          <p className="mt-5 max-w-lg text-[#685B4B]">
            Khám phá thực đơn đồ uống được chuẩn bị dành riêng cho bạn.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-7">
          <h2 className="text-2xl font-bold">Thực đơn hôm nay</h2>
          <p className="mt-1 text-sm text-[#766B60]">Chọn hương vị bạn yêu thích</p>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm cà phê, trà, matcha..."
          aria-label="Tìm kiếm sản phẩm"
          className="mb-5 w-full rounded-2xl border border-[#DED4C7] bg-white px-5 py-4 outline-none focus:border-[#98734D]"
        />

        <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition ${
                category === item
                  ? "bg-[#30271F] text-white"
                  : "bg-white text-[#66584A] hover:bg-[#E8DED0]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading && (
          <div role="status" className="py-16 text-center">Đang tải thực đơn...</div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-2xl bg-red-50 p-8 text-center">
            <p className="mb-5 text-red-700">{error}</p>
            <button
              onClick={handleRetry}
              className="rounded-xl bg-[#30271F] px-6 py-3 text-white"
            >
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center">
            <p className="font-medium">Không tìm thấy sản phẩm phù hợp.</p>
            <p className="mt-2 text-sm text-gray-500">
              Hãy thử từ khóa hoặc danh mục khác nhé.
            </p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border border-[#E8DFD3] bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-36 items-center justify-center bg-[#EFE6DA]">
                  <span className="text-5xl" aria-hidden="true">☕</span>
                </div>

                <div className="p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9A7853]">
                    {product.category || "Đồ uống"}
                  </p>
                  <h3 className="text-xl font-bold">{product.name}</h3>
                  <p className="mt-2 min-h-10 text-sm text-[#766B60]">
                    {product.description || "Hương vị đặc biệt từ BrewLite."}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-lg font-bold text-[#84552D]">
                      {product.price.toLocaleString("vi-VN")}đ
                    </span>
                    {product.available && product.maxQuantity > 0 ? (
                      <Link
                        href={`/product/${product.id}`}
                        className="rounded-xl bg-[#F3E8DA] px-3 py-2 text-xs font-semibold text-[#74502F] hover:bg-[#E9D5BC]"
                      >
                        Chọn món
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="cursor-not-allowed rounded-xl bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-500"
                      >
                        Hết hàng
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 bg-[#30271F] px-5 py-8 text-center text-sm text-[#D9CFC2]">
        BrewLite Coffee House · Assignment 2
      </footer>
    </main>
  );
}


"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Product = {
  id: number | string;
  name: string;
  price: number;
  description?: string;
  category?: string;
};

type CartItem = {
  key: string;
  productId: string;
  name: string;
  size: string;
  topping: string;
  quantity: number;
  unitPrice: number;
};

const sizes = [
  { name: "S", extra: 0 },
  { name: "M", extra: 5000 },
  { name: "L", extra: 10000 },
];

const toppings = [
  { name: "Không topping", extra: 0 },
  { name: "Trân châu", extra: 5000 },
  { name: "Kem cheese", extra: 8000 },
];

function ProductDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [size, setSize] = useState("M");
  const [topping, setTopping] = useState("Không topping");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error();

        const data: Product[] = await res.json();
        const found = data.find((p) => String(p.id) === id);

        if (!found) throw new Error();
        if (active) setProduct(found);
      } catch {
        if (active) setError("Không tìm thấy sản phẩm.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [id]);

  const sizeExtra = sizes.find((s) => s.name === size)?.extra ?? 0;
  const toppingExtra =
    toppings.find((t) => t.name === topping)?.extra ?? 0;

  const unitPrice = (product?.price ?? 0) + sizeExtra + toppingExtra;
  const total = unitPrice * quantity;

  function addToCart() {
    if (!product) return;

    const key = `${product.id}-${size}-${topping}`;

    let cart: CartItem[] = [];

    try {
      const saved = localStorage.getItem("brewlite-as2-cart");
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) cart = parsed as CartItem[];
    } catch {
      cart = [];
    }

    const existing = cart.find((item) => item.key === key);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        key,
        productId: String(product.id),
        name: product.name,
        size,
        topping,
        quantity,
        unitPrice,
      });
    }

    localStorage.setItem("brewlite-as2-cart", JSON.stringify(cart));
    router.push("/cart");
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-2xl">
        <Link href="/menu" className="text-sm underline">
          ← Quay về thực đơn
        </Link>

        {loading && <p className="mt-8">Đang tải sản phẩm...</p>}
        {error && <p role="alert" className="mt-8 text-red-600">{error}</p>}

        {product && !loading && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex h-48 items-center justify-center bg-[#EDE4D6] text-7xl">
              ☕
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h1 className="text-3xl font-bold">{product.name}</h1>
                <p className="mt-2 text-gray-600">
                  {product.description}
                </p>
                <p className="mt-3 font-semibold">
                  Giá gốc: {product.price.toLocaleString("vi-VN")}đ
                </p>
              </div>

              <fieldset>
                <legend className="mb-3 font-bold">Chọn kích cỡ</legend>
                <div className="flex flex-wrap gap-3">
                  {sizes.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setSize(item.name)}
                      aria-pressed={size === item.name}
                      className={`rounded-xl border px-5 py-3 ${
                        size === item.name
                          ? "bg-[#30271F] text-white"
                          : "bg-[#F8F5EF]"
                      }`}
                    >
                      {item.name} (+{item.extra.toLocaleString("vi-VN")}đ)
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 font-bold">Chọn topping</legend>
                <div className="flex flex-wrap gap-3">
                  {toppings.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setTopping(item.name)}
                      aria-pressed={topping === item.name}
                      className={`rounded-xl border px-4 py-3 ${
                        topping === item.name
                          ? "bg-[#30271F] text-white"
                          : "bg-[#F8F5EF]"
                      }`}
                    >
                      {item.name} (+{item.extra.toLocaleString("vi-VN")}đ)
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-center justify-between">
                <span className="font-bold">Số lượng</span>
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="rounded-lg bg-gray-100 px-4 py-2"
                  >−</button>
                  <span>{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="rounded-lg bg-gray-100 px-4 py-2"
                  >+</button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-5">
                <span className="font-bold">Tổng tiền</span>
                <strong className="text-2xl text-[#84552D]">
                  {total.toLocaleString("vi-VN")}đ
                </strong>
              </div>

              <button
                onClick={addToCart}
                className="w-full rounded-xl bg-[#30271F] py-4 font-bold text-white"
              >
                Thêm vào giỏ hàng
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F8F5EF] p-8 text-center text-[#30271F]">
          Đang tải chi tiết sản phẩm...
        </main>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}

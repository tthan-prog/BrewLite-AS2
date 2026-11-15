
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../../lib/config";

type SizeOption = {
  size: string;
  surcharge: number;
};

type ToppingOption = {
  id: number;
  name: string;
  price: number;
  available: boolean;
};

type Product = {
  id: number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  available: boolean;
  maxQuantity: number;
  sizes: SizeOption[];
  toppings: ToppingOption[];
  sugarLevels: number[];
  iceLevels: number[];
};

type CartItem = {
  key: string;
  productId: string;
  name: string;
  size: string;
  topping: string;
  quantity: number;
  unitPrice: number;
  sugar?: number;
  ice?: number;
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [size, setSize] = useState("S");
  const [toppingId, setToppingId] = useState("none");
  const [sugar, setSugar] = useState(100);
  const [ice, setIce] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      try {
        const response = await fetch(
          `${API_URL}/products/${encodeURIComponent(id)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Không thể tải sản phẩm");
        }

        const data: Product = await response.json();

        if (!controller.signal.aborted) {
          setProduct(data);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Không thể tải chi tiết sản phẩm.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchProduct();

    return () => controller.abort();
  }, [id]);

  const selectedSize = product?.sizes.find(
    (item) => item.size === size
  );

  const selectedTopping = product?.toppings.find(
    (item) => String(item.id) === toppingId
  );

  const unitPrice =
    (product?.price ?? 0) +
    (selectedSize?.surcharge ?? 0) +
    (selectedTopping?.price ?? 0);

  const total = unitPrice * quantity;

  function addToCart() {
    if (!product || !product.available || !selectedSize) return;

    setCartError("");

    const toppingName = selectedTopping?.name ?? "Không topping";

    const key = [
      product.id,
      size,
      toppingId,
      sugar,
      ice,
    ].join("-");

    const cart = readCart();

    const existing = cart.find((item) => item.key === key);

    // Đếm tổng số ly cùng sản phẩm trong giỏ.
    const currentQuantity = cart
      .filter((item) => item.productId === String(product.id))
      .reduce((sum, item) => sum + item.quantity, 0);

    if (currentQuantity + quantity > product.maxQuantity) {
      setCartError(
        `Sản phẩm này chỉ cho phép tối đa ${product.maxQuantity} ly trong giỏ hàng.`
      );
      return;
    }

    const next: CartItem[] = existing
      ? cart.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      : [
          ...cart,
          {
            key,
            productId: String(product.id),
            name: product.name,
            size,
            topping: toppingName,
            sugar,
            ice,
            quantity,
            unitPrice,
          },
        ];

    try {
      localStorage.setItem(
        "brewlite-as2-cart",
        JSON.stringify(next)
      );
      router.push("/cart");
    } catch {
      setCartError("Không lưu được giỏ hàng. Vui lòng thử lại.");
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-2xl">
        <Link href="/menu" className="text-sm underline">
          ← Quay về thực đơn
        </Link>

        {loading && (
          <p className="mt-8">Đang tải sản phẩm...</p>
        )}

        {error && (
          <p role="alert" className="mt-8 text-red-600">
            {error}
          </p>
        )}

        {!loading && product && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex h-48 items-center justify-center bg-[#EDE4D6] text-7xl">
              ☕
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h1 className="text-3xl font-bold">
                  {product.name}
                </h1>

                <p className="mt-2 text-gray-600">
                  {product.description}
                </p>

                <p className="mt-3 font-semibold">
                  Giá gốc:{" "}
                  {product.price.toLocaleString("vi-VN")}đ
                </p>

                {!product.available && (
                  <p className="mt-3 font-bold text-red-600">
                    Sản phẩm hiện đã hết hàng.
                  </p>
                )}
              </div>

              <fieldset>
                <legend className="mb-3 font-bold">
                  Chọn kích cỡ
                </legend>

                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((item) => (
                    <button
                      key={item.size}
                      type="button"
                      onClick={() => setSize(item.size)}
                      aria-pressed={size === item.size}
                      className={`rounded-xl border px-5 py-3 ${
                        size === item.size
                          ? "bg-[#30271F] text-white"
                          : "bg-[#F8F5EF]"
                      }`}
                    >
                      {item.size} (+
                      {item.surcharge.toLocaleString("vi-VN")}đ)
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 font-bold">
                  Chọn topping
                </legend>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setToppingId("none")}
                    aria-pressed={toppingId === "none"}
                    className={`rounded-xl border px-4 py-3 ${
                      toppingId === "none"
                        ? "bg-[#30271F] text-white"
                        : "bg-[#F8F5EF]"
                    }`}
                  >
                    Không topping
                  </button>

                  {product.toppings.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.available}
                      onClick={() =>
                        setToppingId(String(item.id))
                      }
                      aria-pressed={
                        toppingId === String(item.id)
                      }
                      className={`rounded-xl border px-4 py-3 ${
                        toppingId === String(item.id)
                          ? "bg-[#30271F] text-white"
                          : "bg-[#F8F5EF]"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {item.name} (+
                      {item.price.toLocaleString("vi-VN")}đ)
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="font-semibold">
                  Mức đường
                  <select
                    value={sugar}
                    onChange={(e) =>
                      setSugar(Number(e.target.value))
                    }
                    className="mt-2 w-full rounded-xl border p-3"
                  >
                    {product.sugarLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}%
                      </option>
                    ))}
                  </select>
                </label>

                <label className="font-semibold">
                  Mức đá
                  <select
                    value={ice}
                    onChange={(e) =>
                      setIce(Number(e.target.value))
                    }
                    className="mt-2 w-full rounded-xl border p-3"
                  >
                    {product.iceLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold">
                  Số lượng
                </span>

                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.max(1, q - 1))
                    }
                    className="rounded-lg bg-gray-100 px-4 py-2"
                  >
                    −
                  </button>

                  <span>{quantity}</span>

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(product.maxQuantity, q + 1)
                      )
                    }
                    className="rounded-lg bg-gray-100 px-4 py-2"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-5">
                <span className="font-bold">
                  Tổng tiền
                </span>

                <strong className="text-2xl text-[#84552D]">
                  {total.toLocaleString("vi-VN")}đ
                </strong>
              </div>

              {cartError && (
                <p role="alert" className="text-sm text-red-600">
                  {cartError}
                </p>
              )}

              <button
                type="button"
                onClick={addToCart}
                disabled={!product.available || !selectedSize}
                className="w-full rounded-xl bg-[#30271F] py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
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

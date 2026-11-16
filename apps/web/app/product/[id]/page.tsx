"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DrinkArt } from "../../../components/drink-art";
import { API_URL } from "../../../lib/config";
import { checkAvailability, formatVnd, lineKey, MAX_QUANTITY_PER_LINE, MAX_TOPPINGS, readCart, writeCart, type CartItem } from "../../../lib/cart";

type Product = {
  id: number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  available: boolean;
  maxQuantity: number;
  sizes: Array<{ size: string; surcharge: number }>;
  toppings: Array<{ id: number; name: string; price: number; available: boolean }>;
  sugarLevels: number[];
  iceLevels: number[];
};

const SIZE_LABEL: Record<string, string> = { S: "Nhỏ", M: "Vừa", L: "Lớn" };

const chip = (active: boolean) =>
  `rounded-xl border px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84552D] disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? "border-[#30271F] bg-[#30271F] text-white" : "border-[#DED4C7] bg-white hover:border-[#98734D]"
  }`;

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [size, setSize] = useState("M");
  const [toppingIds, setToppingIds] = useState<number[]>([]);
  const [sugar, setSugar] = useState(100);
  const [ice, setIce] = useState(100);
  const [quantity, setQuantity] = useState(1);
  /** Số ly còn thêm được với lựa chọn hiện tại (đã trừ phần đang có trong giỏ). null: chưa biết. */
  const [canAdd, setCanAdd] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [cartError, setCartError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) throw new Error("Món này không tồn tại hoặc đã ngừng bán.");
        if (!response.ok) throw new Error("Không tải được chi tiết món. Vui lòng thử lại.");
        const data = (await response.json()) as Product;
        setProduct(data);
        if (!data.sizes.some((s) => s.size === "M")) setSize(data.sizes[0]?.size ?? "S");
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được chi tiết món.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  const key = product ? lineKey(product.id, size, toppingIds, sugar, ice) : "";

  // Hỏi máy chủ số ly còn làm được với lựa chọn hiện tại, tính cả các món đang có trong giỏ.
  useEffect(() => {
    if (!product?.available) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      const cart = readCart();
      const inCart = cart.find((item) => item.key === key)?.quantity ?? 0;
      const others = cart.filter((item) => item.key !== key);
      try {
        const result = await checkAvailability(
          [...others, { productId: product.id, quantity: inCart + 1, size, sugar, ice, toppingIds }],
          controller.signal,
        );
        const room = Math.max(0, result.lines[result.lines.length - 1].maxQuantity - inCart);
        setCanAdd(room);
        setQuantity((q) => Math.max(1, Math.min(q, room || 1)));
      } catch {
        if (!controller.signal.aborted) setCanAdd(null); // không kiểm tra được: máy chủ sẽ kiểm tra lại khi đặt đơn
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [product, key, size, sugar, ice, toppingIds]);

  const selectedToppings = useMemo(
    () => (product?.toppings ?? []).filter((t) => toppingIds.includes(t.id)),
    [product, toppingIds],
  );
  const surcharge = product?.sizes.find((s) => s.size === size)?.surcharge ?? 0;
  const unitPrice = (product?.price ?? 0) + surcharge + selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const limit = Math.min(MAX_QUANTITY_PER_LINE, canAdd ?? product?.maxQuantity ?? MAX_QUANTITY_PER_LINE);
  const soldOutForChoice = canAdd === 0;

  function toggleTopping(toppingId: number) {
    setCartError("");
    setToppingIds((current) => {
      if (current.includes(toppingId)) return current.filter((x) => x !== toppingId);
      if (current.length >= MAX_TOPPINGS) {
        setCartError(`Mỗi ly chọn tối đa ${MAX_TOPPINGS} topping.`);
        return current;
      }
      return [...current, toppingId];
    });
  }

  function addToCart() {
    if (!product || !product.available || soldOutForChoice) return;
    if (quantity > limit) {
      setCartError(`Với lựa chọn này chỉ còn thêm được ${limit} ly.`);
      return;
    }
    const cart = readCart();
    const existing = cart.find((item) => item.key === key);
    const next: CartItem[] = existing
      ? cart.map((item) => (item.key === key ? { ...item, quantity: item.quantity + quantity } : item))
      : [
          ...cart,
          {
            key,
            productId: product.id,
            name: product.name,
            size,
            topping: selectedToppings.map((t) => t.name).join(", ") || "Không topping",
            toppingIds: [...toppingIds].sort((a, b) => a - b),
            sugar,
            ice,
            quantity,
            unitPrice,
          },
        ];
    try {
      writeCart(next);
      router.push("/cart");
    } catch {
      setCartError("Không lưu được giỏ hàng. Vui lòng thử lại.");
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-5xl">
        <Link href="/menu" className="text-sm font-semibold text-[#84552D] hover:underline">← Quay về thực đơn</Link>

        {loading && <p role="status" className="mt-8 text-[#766B60]">Đang tải món...</p>}
        {error && (
          <div role="alert" className="mt-8 rounded-2xl bg-white p-8 text-center">
            <p className="text-red-700">{error}</p>
            <Link href="/menu" className="mt-4 inline-flex rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">Xem thực đơn</Link>
          </div>
        )}

        {!loading && product && (
          <div className="mt-6 grid overflow-hidden rounded-3xl bg-white shadow-sm md:grid-cols-[5fr_6fr]">
            <div className="relative">
              <DrinkArt name={product.name} category={product.category} className="h-64 w-full md:h-full" />
              {product.category && (
                <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-[#84552D]">{product.category}</span>
              )}
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div>
                <h1 className="text-3xl font-bold">{product.name}</h1>
                {product.description && <p className="mt-2 text-[#766B60]">{product.description}</p>}
                <p className="mt-3 text-lg font-semibold text-[#84552D]">Từ {formatVnd(product.price)}</p>
                {!product.available && (
                  <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700">Món này tạm hết nguyên liệu.</p>
                )}
              </div>

              <fieldset>
                <legend className="mb-3 font-bold">Kích cỡ</legend>
                <div className="grid grid-cols-3 gap-2">
                  {product.sizes.map((item) => (
                    <button key={item.size} type="button" onClick={() => setSize(item.size)} aria-pressed={size === item.size} className={`${chip(size === item.size)} px-2`}>
                      {item.size} · {SIZE_LABEL[item.size] ?? item.size}
                      <span className="block text-xs opacity-70">{item.surcharge > 0 ? `+${formatVnd(item.surcharge)}` : "Giá gốc"}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1 font-bold">Topping</legend>
                <p className="mb-3 text-sm text-[#766B60]">Chọn nhiều, tối đa {MAX_TOPPINGS} loại · đã chọn {toppingIds.length}</p>
                <div className="flex flex-wrap gap-2">
                  {product.toppings.map((item) => {
                    const active = toppingIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!item.available && !active}
                        onClick={() => toggleTopping(item.id)}
                        aria-pressed={active}
                        className={chip(active)}
                      >
                        {active ? "✓ " : "+ "}
                        {item.name} <span className="opacity-70">{formatVnd(item.price)}</span>
                        {!item.available && <span className="ml-1 text-xs">(hết)</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-3 font-bold">Mức đường</legend>
                  <div className="grid grid-cols-5 gap-1.5">
                    {product.sugarLevels.map((level) => (
                      <button key={level} type="button" onClick={() => setSugar(level)} aria-pressed={sugar === level} className={`${chip(sugar === level)} px-0`}>
                        {level}%
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-3 font-bold">Mức đá</legend>
                  <div className="grid grid-cols-5 gap-1.5">
                    {product.iceLevels.map((level) => (
                      <button key={level} type="button" onClick={() => setIce(level)} aria-pressed={ice === level} className={`${chip(ice === level)} px-0`}>
                        {level}%
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold">Số lượng</span>
                  <p className="text-xs text-[#766B60]" aria-live="polite">
                    {checking
                      ? "Đang kiểm tra nguyên liệu..."
                      : soldOutForChoice
                        ? "Lựa chọn này tạm hết nguyên liệu, hãy đổi size hoặc topping."
                        : canAdd !== null && canAdd < MAX_QUANTITY_PER_LINE
                          ? `Còn thêm được tối đa ${canAdd} ly với lựa chọn này`
                          : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="h-10 w-10 rounded-xl bg-[#F1EBE2] text-lg disabled:opacity-40">−</button>
                  <span className="w-8 text-center text-lg font-semibold" aria-label="Số lượng đã chọn">{quantity}</span>
                  <button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity((q) => Math.min(limit, q + 1))} disabled={quantity >= limit} className="h-10 w-10 rounded-xl bg-[#F1EBE2] text-lg disabled:opacity-40">+</button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#EFE7DC] pt-5">
                <div>
                  <span className="font-bold">Tạm tính</span>
                  <p className="text-xs text-[#766B60]">{formatVnd(unitPrice)} / ly</p>
                </div>
                <strong className="text-2xl text-[#84552D]">{formatVnd(unitPrice * quantity)}</strong>
              </div>

              {cartError && <p role="alert" className="text-sm text-red-700">{cartError}</p>}

              <button
                type="button"
                onClick={addToCart}
                disabled={!product.available || soldOutForChoice}
                className="w-full rounded-xl bg-[#30271F] py-4 font-bold text-white transition hover:bg-[#4A392B] disabled:cursor-not-allowed disabled:opacity-40"
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

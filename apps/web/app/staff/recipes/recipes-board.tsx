"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DrinkArt } from "../../../components/drink-art";
import { cupsTone, formatMoney, SIZES, StaffApiError, staffRequest, type Ingredient, type ProductRecipe, type RecipesResponse } from "../staff-api";

type Sort = "menu" | "low";

/** Bảng công thức và số ly S/M/L; nhập thêm nguyên liệu đang giới hạn ngay tại chỗ. */
export function RecipesBoard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [data, setData] = useState<RecipesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("menu");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const fail = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof StaffApiError && (e.status === 401 || e.status === 403)) return onUnauthorized();
      setError(e instanceof Error ? e.message : fallback);
    },
    [onUnauthorized],
  );

  const load = useCallback(async () => {
    try {
      setData(await staffRequest<RecipesResponse>("/ingredients/recipes"));
      setError("");
    } catch (e) {
      fail(e, "Không tải được bảng công thức.");
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 30_000); // đơn mới thanh toán làm giảm số ly
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  async function restock(ingredientId: number, name: string) {
    const quantity = Number(amounts[ingredientId]);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Số lượng nhập phải là số nguyên dương.");
      return;
    }
    setSaving(ingredientId);
    setError("");
    setNotice("");
    try {
      const updated = await staffRequest<Ingredient>(`/ingredients/${ingredientId}/restock`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
      setAmounts((a) => ({ ...a, [ingredientId]: "" }));
      await load();
      setNotice(`Đã nhập thêm ${quantity} ${updated.unit} ${name}. Số ly đã cập nhật theo tồn kho mới.`);
    } catch (e) {
      fail(e, "Không nhập kho được.");
    } finally {
      setSaving(null);
    }
  }

  const products = useMemo(() => {
    const list = (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
    return sort === "low" ? [...list].sort((a, b) => a.cups.S - b.cups.S) : list;
  }, [data, query, sort]);

  if (loading) return <p role="status" className="py-12 text-center text-[#766B60]">Đang tải bảng công thức...</p>;
  if (!data) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Không tải được bảng công thức."}</p>;

  const soldOut = data.products.filter((p) => p.cups.S === 0).length;
  const low = data.products.filter((p) => p.cups.S > 0 && p.cups.S < 10).length;

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Món đang bán" value={data.products.length - soldOut} />
        <Stat label="Món còn dưới 10 ly (size S)" value={low} tone={low > 0 ? "text-amber-700" : undefined} />
        <Stat label="Món hết nguyên liệu" value={soldOut} tone={soldOut > 0 ? "text-red-700" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm món..."
          aria-label="Tìm món"
          className="min-w-56 flex-1 rounded-xl border border-[#DED4C7] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#98734D]"
        />
        <div className="flex gap-2" role="group" aria-label="Sắp xếp">
          <button type="button" aria-pressed={sort === "menu"} onClick={() => setSort("menu")} className={toggle(sort === "menu")}>Theo thực đơn</button>
          <button type="button" aria-pressed={sort === "low"} onClick={() => setSort("low")} className={toggle(sort === "low")}>Ít ly nhất trước</button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} amounts={amounts} setAmounts={setAmounts} saving={saving} onRestock={restock} />
        ))}
        {products.length === 0 && <p className="text-sm text-[#766B60]">Không có món phù hợp.</p>}
      </div>

      <div>
        <h2 className="mb-3 mt-4 text-xl font-bold">Topping</h2>
        <div className="overflow-x-auto rounded-2xl border border-[#E8DFD3] bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E8DFD3] text-xs uppercase tracking-wider text-[#766B60]">
                <th className="px-4 py-3">Topping</th>
                <th className="px-4 py-3">Công thức 1 phần</th>
                <th className="px-4 py-3 text-right">Số phần làm được</th>
              </tr>
            </thead>
            <tbody>
              {data.toppings.map((t) => (
                <tr key={t.id} className="border-b border-[#F0EAE2] last:border-0">
                  <td className="px-4 py-3 font-semibold">
                    {t.name}
                    <span className="block text-xs font-normal text-[#766B60]">{formatMoney(t.price)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.ingredients.length === 0
                      ? "Không dùng nguyên liệu trong kho"
                      : t.ingredients.map((i) => `${i.name} ${i.perServing} ${i.unit} (kho ${i.stock.toLocaleString("vi-VN")})`).join(" · ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.servings === null ? "—" : <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cupsTone(t.servings)}`}>{t.servings.toLocaleString("vi-VN")} phần</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  product: p,
  amounts,
  setAmounts,
  saving,
  onRestock,
}: {
  product: ProductRecipe;
  amounts: Record<number, string>;
  setAmounts: (fn: (a: Record<number, string>) => Record<number, string>) => void;
  saving: number | null;
  onRestock: (id: number, name: string) => void;
}) {
  const limiting = p.ingredients.find((i) => i.name === p.limiting.S);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#E8DFD3] bg-white shadow-sm" aria-label={p.name}>
      <div className="flex items-center gap-4 p-4">
        <DrinkArt name={p.name} category={p.category} className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{p.name}</h3>
          <p className="text-xs text-[#766B60]">{p.category} · {formatMoney(p.basePrice)}</p>
        </div>
        <div className="flex gap-1.5" aria-label={`Số ly làm được của ${p.name}`}>
          {SIZES.map((size) => (
            <span key={size} className={`rounded-lg px-2.5 py-1 text-center text-xs font-semibold ${cupsTone(p.cups[size])}`}>
              {size}
              <span className="block text-base leading-tight">{p.cups[size].toLocaleString("vi-VN")}</span>
            </span>
          ))}
        </div>
      </div>

      {p.ingredients.length === 0 ? (
        <p className="border-t border-[#F0EAE2] px-4 py-3 text-sm text-red-700">Món chưa có công thức nên chưa bán được.</p>
      ) : (
        <table className="w-full border-t border-[#F0EAE2] text-sm">
          <thead>
            <tr className="text-xs text-[#766B60]">
              <th className="px-4 py-2 text-left font-medium">Nguyên liệu / 1 ly</th>
              {SIZES.map((s) => (
                <th key={s} className="px-2 py-2 text-right font-medium">{s}</th>
              ))}
              <th className="px-4 py-2 text-right font-medium">Tồn kho</th>
            </tr>
          </thead>
          <tbody>
            {p.ingredients.map((i) => (
              <tr key={i.id} className={i.name === p.limiting.S ? "bg-[#FBF5EC]" : ""}>
                <td className="px-4 py-1.5">
                  {i.name}
                  {(i.sugarScaled || i.iceScaled) && (
                    <span className="ml-1 text-xs text-[#766B60]">({i.sugarScaled ? "theo mức đường" : "theo mức đá"})</span>
                  )}
                </td>
                {SIZES.map((s) => (
                  <td key={s} className="px-2 py-1.5 text-right tabular-nums">{i.perCup[s]}</td>
                ))}
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {i.stock.toLocaleString("vi-VN")} {i.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {limiting && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EAE2] bg-[#FBF8F3] px-4 py-3 text-sm">
          <span className="mr-auto text-[#766B60]">
            Giới hạn bởi <strong className="text-[#30271F]">{limiting.name}</strong>
          </span>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            aria-label={`Số lượng nhập ${limiting.name} cho ${p.name}`}
            placeholder={limiting.unit}
            value={amounts[limiting.id] ?? ""}
            onChange={(e) => setAmounts((a) => ({ ...a, [limiting.id]: e.target.value }))}
            className="w-24 rounded-lg border border-[#DED4C7] px-3 py-1.5"
          />
          <button
            type="button"
            disabled={saving === limiting.id}
            onClick={() => onRestock(limiting.id, limiting.name)}
            className="rounded-lg bg-[#30271F] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            Nhập thêm
          </button>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[#E8DFD3] bg-white p-4">
      <p className="text-xs text-[#766B60]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

const toggle = (active: boolean) =>
  `rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-[#30271F] text-white" : "border border-[#DED4C7] bg-white"}`;

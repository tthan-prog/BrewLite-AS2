"use client";

import { useCallback, useEffect, useState } from "react";
import { cupsTone, StaffApiError, staffRequest, type Ingredient, type RecipesResponse } from "../staff-api";

const FLAG: Record<Ingredient["flag"], { label: string; className: string }> = {
  OUT: { label: "Hết", className: "bg-red-100 text-red-800" },
  LOW: { label: "Sắp hết", className: "bg-amber-100 text-amber-800" },
  OK: { label: "Đủ", className: "bg-green-100 text-green-800" },
};

/** Tồn kho nguyên liệu và nhập thêm (FR-17). */
export function IngredientsTable({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [usage, setUsage] = useState<Record<number, Array<{ name: string; cups: number }>>>({});

  /** Món dùng từng nguyên liệu kèm số ly size S còn làm được (cập nhật sau mỗi lần nhập kho). */
  const loadUsage = useCallback(async () => {
    try {
      const data = await staffRequest<RecipesResponse>("/ingredients/recipes");
      const map: Record<number, Array<{ name: string; cups: number }>> = {};
      for (const p of data.products) for (const i of p.ingredients) (map[i.id] ??= []).push({ name: p.name, cups: p.cups.S });
      for (const t of data.toppings) for (const i of t.ingredients) (map[i.id] ??= []).push({ name: `Topping ${t.name}`, cups: t.servings ?? 0 });
      setUsage(map);
    } catch {
      // Bảng tồn kho vẫn dùng được khi không tải được công thức
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setItems(await staffRequest<Ingredient[]>("/ingredients"));
      setError("");
    } catch (e) {
      if (e instanceof StaffApiError && (e.status === 401 || e.status === 403)) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Không tải được kho nguyên liệu.");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
      void loadUsage();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, loadUsage]);

  async function restock(item: Ingredient) {
    const quantity = Number(amounts[item.id]);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Số lượng nhập phải là số nguyên dương.");
      return;
    }
    setSaving(item.id);
    setError("");
    setNotice("");
    try {
      const updated = await staffRequest<Ingredient>(`/ingredients/${item.id}/restock`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
      setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      setAmounts((a) => ({ ...a, [item.id]: "" }));
      setNotice(`Đã nhập thêm ${quantity} ${updated.unit} ${updated.name}. Tồn kho: ${updated.stock} ${updated.unit}.`);
      void loadUsage();
    } catch (e) {
      if (e instanceof StaffApiError && (e.status === 401 || e.status === 403)) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Không nhập kho được.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p role="status" className="py-12 text-center text-[#766B60]">Đang tải kho nguyên liệu...</p>;

  const lowCount = items.filter((i) => i.flag !== "OK").length;

  return (
    <section>
      {lowCount > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {lowCount} nguyên liệu hết hoặc sắp hết, cần nhập thêm.
        </p>
      )}
      {notice && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-[#E8DFD3] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8DFD3] text-xs uppercase tracking-wider text-[#766B60]">
              <th className="px-4 py-3">Nguyên liệu</th>
              <th className="px-4 py-3 text-right">Tồn kho</th>
              <th className="px-4 py-3">Tình trạng</th>
              <th className="px-4 py-3">Dùng cho (số ly size S)</th>
              <th className="px-4 py-3">Nhập thêm</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[#F0EAE2] last:border-0">
                <td className="px-4 py-3 font-semibold">{item.name}</td>
                <td className="px-4 py-3 text-right">
                  {item.stock.toLocaleString("vi-VN")} {item.unit}
                  <span className="block text-xs text-[#766B60]">ngưỡng {item.lowThreshold.toLocaleString("vi-VN")}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${FLAG[item.flag].className}`}>
                    {FLAG[item.flag].label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {(usage[item.id] ?? []).map((u) => (
                      <span key={u.name} className={`rounded-full px-2 py-0.5 text-xs ${cupsTone(u.cups)}`}>
                        {u.name}: {u.cups.toLocaleString("vi-VN")}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <input type="number" min={1} step={1} inputMode="numeric" aria-label={`Số lượng nhập ${item.name}`}
                      value={amounts[item.id] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [item.id]: e.target.value }))}
                      className="w-28 rounded-lg border border-[#DED4C7] px-3 py-2" />
                    <button type="button" disabled={saving === item.id} onClick={() => void restock(item)}
                      className="rounded-lg bg-[#30271F] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      Nhập
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

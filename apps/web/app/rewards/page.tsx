"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../../lib/config";

type Profile = {
  name?: string;
  points: number;
};

type Reward = {
  id: number;
  name: string;
  pointsCost: number;
};

type RedeemedReward = {
  id?: number;
  code: string;
  rewardName?: string;
  name?: string;
  status?: string;
};

type RedemptionResponse = {
  code: string;
  pointsLeft: number;
};

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = data.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(". ");
  }
  return "Yêu cầu thất bại. Vui lòng thử lại.";
}

async function request<T>(
  path: string,
  token: string,
  options: { method?: "GET" | "POST"; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal: options.signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(errorMessage(data), response.status);
  return data as T;
}

function parseRewards(data: unknown): Reward[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "value" in data && Array.isArray(data.value)
      ? data.value
      : null;
  if (!list) throw new Error("Danh sách phần thưởng không hợp lệ.");
  return list.filter((item): item is Reward =>
    Boolean(item && typeof item === "object" &&
      Number.isInteger(item.id) &&
      typeof item.name === "string" &&
      typeof item.pointsCost === "number" &&
      Number.isFinite(item.pointsCost))
  );
}

function parseRedemptions(data: unknown): RedeemedReward[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "value" in data && Array.isArray(data.value)
      ? data.value
      : null;
  if (!list) throw new Error("Danh sách mã đã đổi không hợp lệ.");
  return list.filter((item): item is RedeemedReward =>
    Boolean(item && typeof item === "object" && typeof item.code === "string")
  );
}

export default function RewardsPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemed, setRedeemed] = useState<RedeemedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const unauthorize = useCallback(() => {
    sessionStorage.removeItem("brewlite_token");
    setUser(null);
    setNeedsLogin(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem("brewlite_token");

    if (!token) {
  const frame = window.requestAnimationFrame(() => {
    if (!controller.signal.aborted) {
      setNeedsLogin(true);
      setLoading(false);
    }
  });

  return () => {
    window.cancelAnimationFrame(frame);
    controller.abort();
  };
}

    async function load() {
      try {
        // Tải đồng thời, tất cả đều sử dụng JWT của khách hàng.
        const [profileData, rewardsData, redeemedData] = await Promise.all([
          request<unknown>("/auth/me", token!, { signal: controller.signal }),
          request<unknown>("/rewards", token!, { signal: controller.signal }),
          request<unknown>("/rewards/me", token!, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (!profileData || typeof profileData !== "object" ||
          !("points" in profileData) || typeof profileData.points !== "number") {
          throw new Error("Thông tin điểm của tài khoản không hợp lệ.");
        }
        setUser(profileData as Profile);
        setRewards(parseRewards(rewardsData));
        setRedeemed(parseRedemptions(redeemedData));
        setNeedsLogin(false);
        setError("");
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.status === 401) {
          unauthorize();
        } else {
          setError(caught instanceof Error ? caught.message : "Không thể tải phần thưởng.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshIndex, unauthorize]);

  async function redeem(reward: Reward) {
    if (redeemingId !== null || !user) return;
    const token = sessionStorage.getItem("brewlite_token");
    if (!token) {
      unauthorize();
      return;
    }
    setRedeemingId(reward.id);
    setActionError("");
    setRedeemCode("");
    try {
      const result = await request<RedemptionResponse>(
        `/rewards/${reward.id}/redeem`, token, { method: "POST" }
      );
      if (typeof result.code !== "string" ||
        typeof result.pointsLeft !== "number") {
        throw new Error("Máy chủ trả về mã quà không hợp lệ. Hãy kiểm tra mục mã đã đổi.");
      }
      setRedeemCode(result.code);
      setUser((previous) => previous ? { ...previous, points: result.pointsLeft } : previous);
      // Refresh danh sách mã sau khi đổi, nhưng giữ mã vừa nhận nếu refresh lỗi.
      try {
        const list = await request<unknown>("/rewards/me", token);
        setRedeemed(parseRedemptions(list));
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) unauthorize();
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        unauthorize();
      } else {
        setActionError(caught instanceof Error ? caught.message : "Không thể đổi quà. Vui lòng thử lại.");
      }
    } finally {
      setRedeemingId(null);
    }
  }

  function retry() {
    setLoading(true);
    setError("");
    setRefreshIndex((value) => value + 1);
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-5xl">
        <Link href="/menu" className="text-sm underline">← Quay về thực đơn</Link>
        <div className="my-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#98734D]">BrewLite Loyalty</p>
          <h1 className="mt-3 text-4xl font-bold">Đổi điểm nhận quà 🎁</h1>
          <p className="mt-3 text-gray-600">Dùng điểm tích lũy để đổi phần thưởng từ BrewLite.</p>
        </div>

        <section className="mb-8 rounded-2xl bg-[#30271F] p-6 text-white">
          <p className="text-sm text-[#E6D8C8]">Điểm tích lũy</p>
          {loading ? <p className="mt-3">Đang tải điểm thưởng...</p>
            : needsLogin ? (
              <div className="mt-4">
                <p>Vui lòng đăng nhập để xem và đổi quà.</p>
                <Link href="/login?next=/rewards" className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-bold text-[#30271F]">Đăng nhập</Link>
              </div>
            ) : error ? (
              <div className="mt-4"><p role="alert">{error}</p>
                <button type="button" onClick={retry} className="mt-4 rounded-xl bg-white px-5 py-3 font-bold text-[#30271F]">Thử lại</button>
              </div>
            ) : user ? (
              <div className="mt-4"><p className="text-4xl font-bold">{user.points.toLocaleString("vi-VN")} điểm</p>
                {user.name && <p className="mt-3 text-sm">Xin chào, {user.name}!</p>}
              </div>
            ) : null}
        </section>

        {redeemCode && (
          <section role="status" className="mb-6 rounded-2xl border border-green-300 bg-green-50 p-5 text-green-900">
            <h2 className="font-bold">Đổi quà thành công!</h2>
            <p className="mt-2">Mã quà của bạn: <strong>{redeemCode}</strong></p>
            <p className="mt-1 text-sm">Lưu mã này để sử dụng khi cần.</p>
          </section>
        )}
        {actionError && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{actionError}</p>}

        <h2 className="mb-5 text-2xl font-bold">Danh sách phần thưởng</h2>
        {!loading && !needsLogin && !error && rewards.length === 0 && <p>Hiện chưa có phần thưởng.</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((reward) => (
            <article key={reward.id} className="rounded-2xl border border-[#E8DFD3] bg-white p-6 shadow-sm">
              <div className="mb-5 text-4xl">🎁</div>
              <h3 className="text-xl font-bold">{reward.name}</h3>
              <p className="mt-5 text-lg font-bold text-[#84552D]">{reward.pointsCost} điểm</p>
              {user && user.points < reward.pointsCost &&
                <p className="mt-2 text-sm text-gray-600">Cần thêm {reward.pointsCost - user.points} điểm.</p>}
              <button type="button" onClick={() => void redeem(reward)}
                disabled={!user || redeemingId !== null || loading}
                className="mt-5 w-full rounded-xl bg-[#30271F] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {redeemingId === reward.id ? "Đang đổi quà..." : "Đổi quà"}
              </button>
            </article>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">Mã quà đã đổi</h2>
          {!loading && !needsLogin && !error && redeemed.length === 0 && <p>Bạn chưa đổi phần thưởng nào.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {redeemed.map((item, index) => (
              <div key={item.id ?? `${item.code}-${index}`} className="rounded-xl bg-white p-5 shadow-sm">
                <p className="font-semibold">{item.rewardName ?? item.name ?? "Phần thưởng BrewLite"}</p>
                <p className="mt-2 font-mono font-bold">{item.code}</p>
                {item.status && <p className="mt-1 text-sm text-gray-500">Trạng thái: {item.status}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

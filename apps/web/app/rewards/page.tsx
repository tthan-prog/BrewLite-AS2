
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../../lib/config";

type UserInfo = {
  id: number;
  name: string;
  email: string;
  role: string;
  points: number;
};

const rewards = [
  {
    id: 1,
    name: "Giảm 10.000đ",
    points: 50,
    description: "Phần thưởng giảm giá cho khách hàng.",
  },
  {
    id: 2,
    name: "Một ly cà phê miễn phí",
    points: 150,
    description: "Phần thưởng dành cho khách hàng tích điểm.",
  },
];

async function fetchProfile(
  token: string,
  signal: AbortSignal
): Promise<UserInfo> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    throw new Error("Không thể tải điểm thưởng.");
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("points" in data) ||
    typeof data.points !== "number" ||
    !Number.isFinite(data.points)
  ) {
    throw new Error("Dữ liệu điểm thưởng không hợp lệ.");
  }

  return data as UserInfo;
}

export default function RewardsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      const token = sessionStorage.getItem("brewlite_token");

      if (!token) {
        if (!controller.signal.aborted) {
          setNeedsLogin(true);
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await fetchProfile(
          token,
          controller.signal
        );

        if (controller.signal.aborted) return;

        setUser(profile);
        setNeedsLogin(false);
        setError("");
      } catch (caught) {
        if (controller.signal.aborted) return;

        const message =
          caught instanceof Error
            ? caught.message
            : "Không thể tải điểm thưởng.";

        if (message === "UNAUTHORIZED") {
          sessionStorage.removeItem("brewlite_token");
          setUser(null);
          setNeedsLogin(true);
          setError("");
        } else {
          setError(
            "Không thể tải điểm thưởng. Vui lòng thử lại."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, [retryKey]);

  function retry() {
    setLoading(true);
    setError("");
    setRetryKey((previous) => previous + 1);
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F]">
      <div className="mx-auto max-w-5xl">
        <Link href="/menu" className="text-sm underline">
          ← Quay về thực đơn
        </Link>

        <div className="my-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#98734D]">
            BrewLite Loyalty
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Đổi điểm nhận quà 🎁
          </h1>

          <p className="mt-3 text-gray-600">
            Theo dõi điểm tích lũy và khám phá
            những phần thưởng dành cho bạn.
          </p>
        </div>

        <section className="mb-8 rounded-2xl bg-[#30271F] p-6 text-white">
          <p className="text-sm text-[#E6D8C8]">
            Điểm tích lũy
          </p>

          {loading ? (
            <p className="mt-3 text-lg">
              Đang tải điểm thưởng...
            </p>
          ) : needsLogin ? (
            <div className="mt-4">
              <p className="mb-4">
                Vui lòng đăng nhập để xem điểm của bạn.
              </p>

              <Link
                href="/login?next=/rewards"
                className="inline-block rounded-xl bg-white px-5 py-3 font-bold text-[#30271F]"
              >
                Đăng nhập
              </Link>
            </div>
          ) : error ? (
            <div className="mt-4">
              <p role="alert" className="text-red-200">
                {error}
              </p>

              <button
                type="button"
                onClick={retry}
                className="mt-4 rounded-xl bg-white px-5 py-3 font-bold text-[#30271F]"
              >
                Thử lại
              </button>
            </div>
          ) : user ? (
            <div className="mt-4">
              <p className="text-4xl font-bold">
                {user.points.toLocaleString("vi-VN")} điểm
              </p>

              <p className="mt-3 text-sm text-[#D9CFC2]">
                Xin chào, {user.name}!
              </p>

              <p className="mt-1 text-sm text-[#D9CFC2]">
                Điểm được cập nhật từ tài khoản BrewLite.
              </p>
            </div>
          ) : (
            <p>Không có dữ liệu tài khoản.</p>
          )}
        </section>

        <h2 className="mb-5 text-2xl font-bold">
          Phần thưởng tham khảo
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {rewards.map((reward) => {
            const enoughPoints =
              user !== null && user.points >= reward.points;

            return (
              <article
                key={reward.id}
                className="rounded-2xl border border-[#E8DFD3] bg-white p-6 shadow-sm"
              >
                <div className="mb-5 text-4xl">🎁</div>

                <h3 className="text-xl font-bold">
                  {reward.name}
                </h3>

                <p className="mt-3 min-h-12 text-sm text-gray-600">
                  {reward.description}
                </p>

                <p className="mt-5 text-lg font-bold text-[#84552D]">
                  {reward.points} điểm
                </p>

                {user && (
                  <p className="mt-2 text-sm text-gray-600">
                    {enoughPoints
                      ? "Bạn có đủ điểm cho phần thưởng này."
                      : `Cần thêm ${
                          reward.points - user.points
                        } điểm.`}
                  </p>
                )}

                <button
                  type="button"
                  disabled
                  className="mt-5 w-full cursor-not-allowed rounded-xl bg-gray-300 px-5 py-3 font-semibold text-gray-700"
                >
                  Chưa hỗ trợ đổi quà
                </button>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Danh sách quà đang là dữ liệu minh họa
          theo bộ seed của dự án.
          Chức năng đổi quà chưa được kết nối.
          Không có điểm nào bị trừ khi xem trang này.
        </p>
      </div>
    </main>
  );
}

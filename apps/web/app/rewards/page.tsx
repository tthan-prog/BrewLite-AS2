
"use client";

import Link from "next/link";

const rewards = [
  {
    id: 1,
    name: "Voucher giảm 10.000đ",
    points: 100,
    description: "Giảm giá cho đơn hàng tiếp theo.",
  },
  {
    id: 2,
    name: "Tặng một ly Bạc xỉu",
    points: 250,
    description: "Đổi điểm lấy một ly Bạc xỉu size S.",
  },
  {
    id: 3,
    name: "Voucher giảm 30.000đ",
    points: 300,
    description: "Áp dụng cho đơn hàng tiếp theo.",
  },
];

export default function RewardsPage() {
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
            Tích lũy điểm thưởng và khám phá những phần quà dành cho bạn.
          </p>
        </div>

        <div className="mb-8 rounded-2xl bg-[#30271F] p-6 text-white">
          <p className="text-sm text-[#E6D8C8]">Điểm tích lũy</p>
          <p className="mt-3 text-2xl font-bold">
            Chưa kết nối tài khoản
          </p>
          <p className="mt-2 text-sm text-[#D9CFC2]">
            Số điểm sẽ được lấy từ API sau khi đăng nhập.
          </p>
        </div>

        <h2 className="mb-5 text-2xl font-bold">Danh sách phần thưởng</h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((reward) => (
            <article
              key={reward.id}
              className="rounded-2xl border border-[#E8DFD3] bg-white p-6 shadow-sm"
            >
              <div className="mb-5 text-4xl">🎁</div>
              <h3 className="text-xl font-bold">{reward.name}</h3>
              <p className="mt-3 min-h-12 text-sm text-gray-600">
                {reward.description}
              </p>
              <p className="mt-5 text-lg font-bold text-[#84552D]">
                {reward.points} điểm
              </p>
              <button
                disabled
                className="mt-5 w-full cursor-not-allowed rounded-xl bg-gray-300 px-5 py-3 font-semibold text-gray-700"
              >
                Chờ kết nối API
              </button>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Đây là dữ liệu mẫu để kiểm tra giao diện.
          Chưa thực hiện thao tác trừ điểm hay đổi thưởng.
        </p>
      </div>
    </main>
  );
}

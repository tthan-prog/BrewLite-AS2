"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";

type LoginResponse = {
  accessToken?: string;
  access_token?: string;
  token?: string;
  user?: { id?: string; name?: string; email?: string };
};

// Chỉ cho phép đường dẫn nội bộ (bắt đầu bằng "/", không phải "//" hay "/\").
function getSafeNext(): string {
  if (typeof window === "undefined") return "/menu";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/menu";
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const token = result.accessToken ?? result.access_token ?? result.token;
      if (!token) throw new Error("API đăng nhập không trả về access token.");

      sessionStorage.setItem("brewlite_token", token);
      if (result.user) sessionStorage.setItem("brewlite_user", JSON.stringify(result.user));
      window.dispatchEvent(new Event("brewlite-auth"));
      router.push(getSafeNext());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập lúc này.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-10 text-[#30271F] sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <aside className="flex min-h-64 flex-col justify-between bg-[#30271F] p-8 text-white sm:p-10 md:min-h-[560px]">
          <div>
            <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#E6D8C8]">Chào mừng trở lại</p>
            <h1 className="mt-8 text-4xl font-bold leading-tight sm:text-5xl">Cà phê quen.<br />Khoảnh khắc mới.</h1>
            <p className="mt-5 max-w-sm leading-7 text-[#E6D8C8]">Đăng nhập để tiếp tục trải nghiệm BrewLite và theo dõi những đơn hàng của bạn.</p>
          </div>
          <p className="mt-10 text-sm text-[#D7AB76]">Pha bằng sự tận tâm · Phục vụ bằng sự đơn giản.</p>
        </aside>

        <section className="p-7 sm:p-10 md:flex md:flex-col md:justify-center">
          <Link href="/menu" className="mb-8 inline-flex text-sm font-semibold text-[#84552D] hover:underline">← Quay lại thực đơn</Link>
          <h2 className="text-3xl font-bold">Đăng nhập</h2>
          <p className="mt-2 mb-8 text-sm leading-6 text-[#766B60]">Nhập thông tin tài khoản BrewLite của bạn.</p>
          <form className="space-y-5" onSubmit={submit}>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">Email</label>
              <input id="email" type="email" autoComplete="email" placeholder="ban@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none transition focus:border-[#98734D] focus:ring-2 focus:ring-[#98734D]/15" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">Mật khẩu</label>
              <input id="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none transition focus:border-[#98734D] focus:ring-2 focus:ring-[#98734D]/15" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#30271F] px-5 py-3.5 font-semibold text-white transition hover:bg-[#4A392B] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button>
          </form>
          <p className="mt-7 text-center text-sm text-[#766B60]">Chưa có tài khoản? <Link href="/register" className="font-semibold text-[#84552D] hover:underline">Đăng ký ngay</Link></p>
        </section>
      </div>
    </main>
  );
}
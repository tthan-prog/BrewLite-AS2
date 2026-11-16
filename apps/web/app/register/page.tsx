"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      setSuccess("Đăng ký thành công. Bạn có thể đăng nhập.");
      setName("");
      setEmail("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng ký lúc này.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-10 text-[#30271F] sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <aside className="flex min-h-64 flex-col justify-between bg-[#30271F] p-8 text-white sm:p-10 md:min-h-[620px]">
          <div>
            <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#E6D8C8]">Gia nhập BrewLite</p>
            <h1 className="mt-8 text-4xl font-bold leading-tight sm:text-5xl">Niềm vui nhỏ<br />bắt đầu từ đây.</h1>
            <p className="mt-5 max-w-sm leading-7 text-[#E6D8C8]">Tạo tài khoản để đặt đồ uống và theo dõi đơn hàng dễ dàng hơn.</p>
          </div>
          <p className="mt-10 text-sm text-[#D7AB76]">BrewLite Coffee &amp; More</p>
        </aside>

        <section className="p-7 sm:p-10 md:flex md:flex-col md:justify-center">
          <Link href="/menu" className="mb-8 inline-flex text-sm font-semibold text-[#84552D] hover:underline">← Quay lại thực đơn</Link>
          <h2 className="text-3xl font-bold">Tạo tài khoản</h2>
          <p className="mt-2 mb-7 text-sm leading-6 text-[#766B60]">Điền thông tin bên dưới để đăng ký BrewLite.</p>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold">Họ và tên</label>
              <input id="name" autoComplete="name" placeholder="Nguyễn Văn A" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none focus:border-[#98734D] focus:ring-2 focus:ring-[#98734D]/15" />
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">Email</label>
              <input id="email" type="email" autoComplete="email" placeholder="ban@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none focus:border-[#98734D] focus:ring-2 focus:ring-[#98734D]/15" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">Mật khẩu</label>
              <input id="password" type="password" autoComplete="new-password" placeholder="Ít nhất 8 ký tự" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={72} className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none focus:border-[#98734D] focus:ring-2 focus:ring-[#98734D]/15" />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-2 block text-sm font-semibold">Xác nhận mật khẩu</label>
              <input id="confirm" type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} maxLength={72} className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none focus:border-[#98734D] focus:ring-2 focus:ring-[#98734D]/15" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {success && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{success} <Link href="/login" className="font-semibold underline">Đăng nhập</Link></p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#30271F] px-5 py-3.5 font-semibold text-white transition hover:bg-[#4A392B] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Đang tạo tài khoản..." : "Đăng ký"}</button>
          </form>
          <p className="mt-7 text-center text-sm text-[#766B60]">Đã có tài khoản? <Link href="/login" className="font-semibold text-[#84552D] hover:underline">Đăng nhập</Link></p>
        </section>
      </div>
    </main>
  );
}
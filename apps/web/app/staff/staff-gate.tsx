"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { clearToken, readToken, saveToken, StaffApiError, staffRequest, type StaffUser } from "./staff-api";

type GateState =
  | { kind: "checking" }
  | { kind: "login"; error?: string }
  | { kind: "forbidden"; user: StaffUser }
  | { kind: "ready"; user: StaffUser };

/**
 * Chỉ STAFF vào được trang nhân viên (FR-15). Chưa đăng nhập thì hiện form đăng nhập;
 * tài khoản khách hàng thì báo không có quyền. API vẫn tự kiểm tra vai trò (403).
 */
export function StaffGate({ children }: { children: (user: StaffUser, logout: () => void) => ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: "checking" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async (token: string | null) => {
    if (!token) {
      setState({ kind: "login" });
      return;
    }
    try {
      const user = await staffRequest<StaffUser>("/auth/me", {}, token);
      setState(user.role === "STAFF" ? { kind: "ready", user } : { kind: "forbidden", user });
    } catch (e) {
      if (e instanceof StaffApiError && e.status === 401) clearToken();
      setState({ kind: "login", error: e instanceof StaffApiError && e.status !== 401 ? e.message : undefined });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void verify(readToken()), 0);
    return () => clearTimeout(timer);
  }, [verify]);

  const logout = useCallback(() => {
    clearToken();
    sessionStorage.removeItem("brewlite_user");
    window.dispatchEvent(new Event("brewlite-auth"));
    setState({ kind: "login" });
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await staffRequest<{ accessToken: string; user?: StaffUser }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email: email.trim(), password }) },
        null,
      );
      saveToken(result.accessToken);
      if (result.user) sessionStorage.setItem("brewlite_user", JSON.stringify(result.user));
      window.dispatchEvent(new Event("brewlite-auth"));
      setPassword("");
      await verify(result.accessToken);
    } catch (e) {
      setState({ kind: "login", error: e instanceof Error ? e.message : "Không thể đăng nhập." });
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "checking") {
    return <p role="status" className="p-8 text-center text-[#766B60]">Đang kiểm tra tài khoản...</p>;
  }

  if (state.kind === "forbidden") {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Không có quyền truy cập</h1>
        <p role="alert" className="mt-3 text-sm text-[#766B60]">
          Tài khoản {state.user.email} không phải nhân viên. Trang này chỉ dành cho nhân viên cửa hàng.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={logout} className="rounded-xl bg-[#30271F] px-5 py-3 text-sm font-semibold text-white">
            Đăng nhập tài khoản khác
          </button>
          <Link href="/menu" className="rounded-xl border border-[#DED4C7] px-5 py-3 text-sm font-semibold">
            Về thực đơn
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "login") {
    return (
      <form onSubmit={login} className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Đăng nhập nhân viên</h1>
        <p className="text-sm text-[#766B60]">Dùng tài khoản có vai trò nhân viên (STAFF).</p>
        <div>
          <label htmlFor="staff-email" className="mb-1 block text-sm font-semibold">Email</label>
          <input id="staff-email" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none focus:border-[#98734D]" />
        </div>
        <div>
          <label htmlFor="staff-password" className="mb-1 block text-sm font-semibold">Mật khẩu</label>
          <input id="staff-password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[#DED4C7] px-4 py-3 outline-none focus:border-[#98734D]" />
        </div>
        {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-[#30271F] px-5 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    );
  }

  return <>{children(state.user, logout)}</>;
}

export function StaffNav({ user, logout, current }: { user: StaffUser; logout: () => void; current: "orders" | "ingredients" | "recipes" }) {
  const tab = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-semibold ${active ? "bg-[#30271F] text-white" : "border border-[#DED4C7] bg-white"}`;
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav className="flex flex-wrap gap-2" aria-label="Trang nhân viên">
        <Link href="/staff" className={tab(current === "orders")} aria-current={current === "orders" ? "page" : undefined}>
          Đơn hàng
        </Link>
        <Link href="/staff/ingredients" className={tab(current === "ingredients")}
          aria-current={current === "ingredients" ? "page" : undefined}>
          Kho nguyên liệu
        </Link>
        <Link href="/staff/recipes" className={tab(current === "recipes")}
          aria-current={current === "recipes" ? "page" : undefined}>
          Công thức & số ly
        </Link>
      </nav>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[#766B60]">{user.name}</span>
        <button type="button" onClick={logout} className="font-semibold text-[#84552D] hover:underline">Đăng xuất</button>
      </div>
    </header>
  );
}

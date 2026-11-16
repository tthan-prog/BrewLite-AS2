"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CART_KEY = "brewlite-as2-cart";
const TOKEN_KEY = "brewlite_token";

function cartQuantity(): number {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(value)) return 0;
    return value.reduce((sum: number, item: unknown) => {
      if (!item || typeof item !== "object" || !("quantity" in item)) return sum;
      const quantity = item.quantity;
      return sum + (typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
  } catch {
    return 0;
  }
}

/** Vai trò lưu lúc đăng nhập (sessionStorage "brewlite_user"); chỉ dùng để hiện link, quyền thật do API kiểm tra. */
function readRole(): string | null {
  try {
    const user: unknown = JSON.parse(sessionStorage.getItem("brewlite_user") ?? "null");
    return user && typeof user === "object" && "role" in user ? String((user as { role: unknown }).role) : null;
  } catch {
    return null;
  }
}

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const token = sessionStorage.getItem(TOKEN_KEY);
        setLoggedIn(Boolean(token));
        setIsStaff(Boolean(token) && readRole() === "STAFF");
        setQuantity(cartQuantity());
      });
    };
    const onFocus = () => refresh();
    // capture để nhận cả nút tăng/giảm và Thêm vào giỏ trong cùng tab.
    const onClick = () => refresh();
    refresh();
    window.addEventListener("brewlite-auth", refresh);
    window.addEventListener("brewlite-cart", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("click", onClick, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("brewlite-auth", refresh);
      window.removeEventListener("brewlite-cart", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem("brewlite_user");
    window.dispatchEvent(new Event("brewlite-auth"));
    router.push("/menu");
    router.refresh();
  }

  if (pathname?.startsWith("/staff") || pathname?.startsWith("/pay/")) {
    return null;
  }

  const linkStyle = "shrink-0 rounded-lg px-2 py-2 text-sm font-medium hover:bg-[#594437] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  return (
    <nav aria-label="Điều hướng chính" className="bg-[#30271F] px-4 py-3 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-x-1 overflow-x-auto whitespace-nowrap sm:gap-x-4">
        <Link href="/" className="mr-auto shrink-0 pr-2 text-lg font-bold">BrewLite<span className="text-[#D7AB76]">.</span></Link>
        <Link href="/menu" className={linkStyle}>Thực đơn</Link>
        <Link href="/cart" className={linkStyle}>Giỏ hàng ({quantity})</Link>
        <Link href="/orders/history" className={linkStyle}>Lịch sử đơn</Link>
        <Link href="/rewards" className={linkStyle}>Đổi quà</Link>
        {isStaff && (
          <Link href="/staff" className={`${linkStyle} bg-[#D7AB76] text-[#30271F] hover:bg-[#E6C49A]`}>Quầy nhân viên</Link>
        )}
        {loggedIn ? (
          <button type="button" onClick={logout} className={linkStyle}>Đăng xuất</button>
        ) : (
          <Link href="/login" className={linkStyle}>Đăng nhập</Link>
        )}
      </div>
    </nav>
  );
}

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

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setLoggedIn(Boolean(sessionStorage.getItem(TOKEN_KEY)));
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

  const linkStyle = "rounded-lg px-2 py-2 text-sm font-medium hover:bg-[#594437] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  return (
    <nav aria-label="Điều hướng chính" className="bg-[#30271F] px-4 py-3 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/" className="mr-auto text-lg font-bold">BrewLite<span className="text-[#D7AB76]">.</span></Link>
        <Link href="/menu" className={linkStyle}>Thực đơn</Link>
        <Link href="/cart" className={linkStyle}>Giỏ hàng ({quantity})</Link>
        <Link href="/orders/history" className={linkStyle}>Lịch sử đơn</Link>
        <Link href="/rewards" className={linkStyle}>Đổi quà</Link>
        {loggedIn ? (
          <button type="button" onClick={logout} className={linkStyle}>Đăng xuất</button>
        ) : (
          <Link href="/login" className={linkStyle}>Đăng nhập</Link>
        )}
      </div>
    </nav>
  );
}

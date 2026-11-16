import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SiteHeader } from "./site-header";

const navigate = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigate,
  usePathname: () => "/menu",
}));

beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  navigate.push.mockReset(); navigate.refresh.mockReset();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });

describe("Điều hướng BrewLite", () => {
  it("hiện đường dẫn chính và tổng số ly trong giỏ", async () => {
    localStorage.setItem("brewlite-as2-cart", JSON.stringify([{ quantity: 2 }, { quantity: 3 }]));
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Thực đơn" })).toHaveAttribute("href", "/menu");
    expect(screen.getByRole("link", { name: "Lịch sử đơn" })).toHaveAttribute("href", "/orders/history");
    expect(screen.getByRole("link", { name: "Đổi quà" })).toHaveAttribute("href", "/rewards");
    expect(await screen.findByRole("link", { name: "Giỏ hàng (5)" })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  });

  it("đồng bộ brewlite-auth và đăng xuất", async () => {
    sessionStorage.setItem("brewlite_token", "mock-token");
    render(<SiteHeader />);
    window.dispatchEvent(new Event("brewlite-auth"));
    const logout = await screen.findByRole("button", { name: "Đăng xuất" });
    fireEvent.click(logout);
    expect(sessionStorage.getItem("brewlite_token")).toBeNull();
    expect(navigate.push).toHaveBeenCalledWith("/menu");
    await waitFor(() => expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeInTheDocument());
  });

  it("nhân viên thấy link Quầy nhân viên; khách thì không", async () => {
    sessionStorage.setItem("brewlite_token", "staff-token");
    sessionStorage.setItem("brewlite_user", JSON.stringify({ id: 2, role: "STAFF" }));
    render(<SiteHeader />);
    expect(await screen.findByRole("link", { name: "Quầy nhân viên" })).toHaveAttribute("href", "/staff");
    cleanup();
    sessionStorage.setItem("brewlite_user", JSON.stringify({ id: 1, role: "CUSTOMER" }));
    render(<SiteHeader />);
    await screen.findByRole("button", { name: "Đăng xuất" });
    expect(screen.queryByRole("link", { name: "Quầy nhân viên" })).not.toBeInTheDocument();
  });
});

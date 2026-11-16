import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import HomePage from "./page";
import manifest from "./manifest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Trang chủ và PWA", () => {
  it("có lời mời xem thực đơn, các bước đặt món và món nổi bật còn hàng từ API", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => [
      { id: 1, name: "Cà phê sữa đá", description: "Đậm vị", price: 29000, category: "Cà phê", available: true },
      { id: 2, name: "Bạc xỉu", description: "Nhiều sữa", price: 32000, category: "Cà phê", available: false },
    ] } as Response)));
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "Xem thực đơn" })).toHaveAttribute("href", "/menu");
    expect(screen.getByText("Thanh toán")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Cà phê sữa đá.*29\.000đ/ })).toHaveAttribute("href", "/product/1");
    expect(screen.queryByText("Bạc xỉu")).not.toBeInTheDocument();
  });

  it("API lỗi thì trang chủ vẫn hiển thị, không có mục món nổi bật", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Món nổi bật")).not.toBeInTheDocument();
  });

  it("manifest PWA hợp lệ: tên, mở ở /menu, chế độ standalone, có biểu tượng", () => {
    const m = manifest();
    expect(m).toMatchObject({ short_name: "BrewLite", start_url: "/menu", display: "standalone", lang: "vi" });
    expect(m.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512", "any"]); // Chrome cần icon PNG 192 và 512 để cài
  });
});

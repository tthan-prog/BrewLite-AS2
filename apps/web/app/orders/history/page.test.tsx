import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OrderHistoryPage from "./page";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

const orders = [
  {
    id: 101,
    orderCode: "BL-0101",
    status: "PAID",
    total: 74000,
    createdAt: "2026-11-10T08:00:00.000Z",
  },
];

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("BrewLite Lịch sử đơn hàng", () => {
  it("hiển thị nút Đăng nhập khi chưa có token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<OrderHistoryPage />);

    expect(
      await screen.findByText("Bạn cần đăng nhập trước khi xem lịch sử đơn hàng.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Đăng nhập" })
    ).toHaveAttribute("href", "/login?next=/orders/history");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gọi /orders/me với Bearer token và hiển thị danh sách đơn", async () => {
    sessionStorage.setItem("brewlite_token", "token-123");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(orders));
    vi.stubGlobal("fetch", fetchMock);

    render(<OrderHistoryPage />);

    expect(await screen.findByText("BL-0101")).toBeInTheDocument();
    expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/orders/me"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      })
    );
  });

  it("khi API trả 401 thì xóa token và yêu cầu đăng nhập lại", async () => {
    sessionStorage.setItem("brewlite_token", "token-het-han");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ message: "Unauthorized" }, false, 401)
      )
    );

    render(<OrderHistoryPage />);

    expect(
      await screen.findByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("brewlite_token")).toBeNull();
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeInTheDocument();
  });
});
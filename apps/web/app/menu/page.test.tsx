import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MenuPage from "./page";

const products = [
  {
    id: 1,
    name: "Cà phê sữa đá",
    price: 29000,
    category: "Cà phê",
    description: "Cà phê đậm đà kết hợp sữa đặc.",
    available: true,
    maxQuantity: 50,
  },
  {
    id: 2,
    name: "Matcha Latte",
    price: 45000,
    category: "Matcha",
    description: "Matcha thơm nhẹ.",
    available: false,
    maxQuantity: 0,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => products,
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BrewLite Menu", () => {
  it("hiển thị sản phẩm từ API", async () => {
    render(<MenuPage />);

    expect(screen.getByText("Đang tải thực đơn...")).toBeInTheDocument();

    expect(await screen.findByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(screen.getByText("Matcha Latte")).toBeInTheDocument();
  });

  it("lọc sản phẩm bằng ô tìm kiếm", async () => {
    render(<MenuPage />);

    await screen.findByText("Cà phê sữa đá");

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "matcha" },
    });

    expect(screen.getByText("Matcha Latte")).toBeInTheDocument();
    expect(screen.queryByText("Cà phê sữa đá")).not.toBeInTheDocument();
  });

  it("hiển thị trạng thái không có sản phẩm", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<MenuPage />);

    expect(await screen.findByText("Không tìm thấy sản phẩm phù hợp.")).toBeInTheDocument();
  });

  it("hiển thị lỗi và nút thử lại khi API thất bại", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(<MenuPage />);

    expect(await screen.findByText("Không thể tải thực đơn. Vui lòng thử lại.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("món còn hàng có link đến trang chi tiết", async () => {
    render(<MenuPage />);
    await screen.findByText("Cà phê sữa đá");

    const link = screen.getByRole("link", { name: "Chọn món" });
    expect(link).toHaveAttribute("href", "/product/1");
  });

  it("món hết hàng không có link chọn món", async () => {
    render(<MenuPage />);
    await screen.findByText("Matcha Latte");

    const soldOut = screen.getByText("Hết hàng");
    expect(soldOut).toHaveAttribute("aria-disabled", "true");
    expect(soldOut.closest("a")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Chọn món" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Matcha Latte" })).not.toBeInTheDocument();
  });
});

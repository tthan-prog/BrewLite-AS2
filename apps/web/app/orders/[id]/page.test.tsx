import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OrderDetailPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "12" }) }));

const order = {
  id: 12,
  status: "PREPARING",
  subtotal: 82000,
  discount: 8200,
  total: 73800,
  promotionCode: "GIAM10",
  failureReason: null,
  createdAt: "2026-11-16T10:50:24.640Z",
  items: [{ id: 1, productId: 7, name: "Trà sữa trân châu", quantity: 2, size: "M", sugar: 50, ice: 100, unitPrice: 41000, lineTotal: 82000, toppings: [{ id: 1, name: "Trân châu đen", price: 7000 }, { id: 2, name: "Thạch dừa", price: 6000 }] }],
  lastPayment: { method: "VNPAY", status: "SUCCESS", amount: 73800, createdAt: "2026-11-16T10:51:42.000Z" },
};
const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 300, status, headers: new Headers({ "content-type": "application/json" }), json: async () => body, text: async () => JSON.stringify(body) } as Response);

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Trang chi tiết đơn /orders/[id]", () => {
  it("hiện tiến trình, món kèm nhiều topping, giảm giá và phương thức thanh toán", async () => {
    sessionStorage.setItem("brewlite_token", "t");
    const fetchMock = vi.fn((url: string) => (url ? reply(200, order) : reply(400, {})));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrderDetailPage />);
    expect(await screen.findByRole("heading", { name: "#12" })).toBeInTheDocument();
    expect(screen.getByText("Đang pha chế").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/Trân châu đen, Thạch dừa/)).toBeInTheDocument();
    expect(screen.getByText("−8.200đ")).toBeInTheDocument();
    expect(screen.getByText("VNPay sandbox · thành công")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/orders\/12$/);
  });

  it("chưa đăng nhập thì mời đăng nhập và quay lại đúng đơn; đơn của người khác báo không tìm thấy", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<OrderDetailPage />);
    expect(await screen.findByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login?next=/orders/12");
    cleanup();
    sessionStorage.setItem("brewlite_token", "t");
    vi.stubGlobal("fetch", vi.fn(() => reply(404, { message: "Không tìm thấy đơn hàng" })));
    render(<OrderDetailPage />);
    expect(await screen.findByText("Không tìm thấy đơn hàng này trong tài khoản của bạn.")).toBeInTheDocument();
  });

  it("thanh toán thất bại hiện lý do; đơn hủy hiện thông báo hủy", async () => {
    sessionStorage.setItem("brewlite_token", "t");
    vi.stubGlobal("fetch", vi.fn(() => reply(200, { ...order, status: "PAYMENT_FAILED", failureReason: "Thẻ bị ngân hàng từ chối" })));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/Thẻ bị ngân hàng từ chối/)).toBeInTheDocument();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => reply(200, { ...order, status: "CANCELLED" })));
    render(<OrderDetailPage />);
    expect(await screen.findByText("Đơn đã bị hủy.")).toBeInTheDocument();
  });
});

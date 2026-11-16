import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import VnpayReturnPage from "./page";

const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("brewlite-as2-cart", "[]");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Trang /checkout/vnpay-return (FR-21)", () => {
  it("gửi nguyên query VNPay về API; thành công thì báo đơn, điểm và xóa giỏ", async () => {
    window.history.replaceState(null, "", "/checkout/vnpay-return?vnp_Amount=7380000&vnp_TxnRef=abc&vnp_SecureHash=xyz");
    fetchMock.mockImplementation((url: string) => {
      expect(url).toMatch(/\/payments\/vnpay\/return\?vnp_Amount=7380000&vnp_TxnRef=abc&vnp_SecureHash=xyz$/);
      return reply(200, { orderId: 12, amount: 73800, status: "SUCCESS", orderStatus: "PAID", failureReason: null, pointsEarned: 7 });
    });
    render(<VnpayReturnPage />);
    expect(await screen.findByText("Thanh toán thành công")).toBeInTheDocument();
    expect(screen.getByText(/Đơn #12 · 73\.800 ₫ · \+7 điểm/)).toBeInTheDocument();
    expect(localStorage.getItem("brewlite-as2-cart")).toBeNull();
  });

  it("thất bại thì hiện lý do và giữ giỏ hàng", async () => {
    window.history.replaceState(null, "", "/checkout/vnpay-return?vnp_ResponseCode=24&vnp_TxnRef=abc");
    fetchMock.mockImplementation(() =>
      reply(200, { orderId: 12, amount: 73800, status: "FAILED", orderStatus: "PAYMENT_FAILED", failureReason: "Khách hàng hủy giao dịch", pointsEarned: 0 }),
    );
    render(<VnpayReturnPage />);
    expect(await screen.findByText("Thanh toán không thành công")).toBeInTheDocument();
    expect(screen.getByText("Khách hàng hủy giao dịch")).toBeInTheDocument();
    expect(localStorage.getItem("brewlite-as2-cart")).toBe("[]");
  });

  it("API từ chối (sai chữ ký) thì báo lỗi; không có query VNPay thì không gọi API", async () => {
    window.history.replaceState(null, "", "/checkout/vnpay-return?vnp_TxnRef=abc&vnp_SecureHash=sai");
    fetchMock.mockImplementation(() => reply(400, { message: "Chữ ký VNPay không hợp lệ" }));
    render(<VnpayReturnPage />);
    expect(await screen.findByText("Chữ ký VNPay không hợp lệ")).toBeInTheDocument();

    cleanup();
    fetchMock.mockClear();
    window.history.replaceState(null, "", "/checkout/vnpay-return");
    render(<VnpayReturnPage />);
    expect(await screen.findByText("Không có thông tin giao dịch VNPay.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

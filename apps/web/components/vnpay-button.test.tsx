import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VnpayButton } from "./vnpay-button";

const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);
let fetchMock: ReturnType<typeof vi.fn>;
const assign = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, assign } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  assign.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("VnpayButton (FR-21)", () => {
  it("máy chủ chưa cấu hình VNPay thì không hiện nút", async () => {
    fetchMock.mockImplementation(() => reply(200, { enabled: false }));
    render(<VnpayButton orderId={12} authToken="jwt" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("bấm nút thì tạo giao dịch kèm JWT rồi chuyển sang URL VNPay", async () => {
    const paymentUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=7380000&vnp_SecureHash=abc";
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/payments/vnpay/config")) return reply(200, { enabled: true });
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
      expect(JSON.parse(String(init?.body))).toEqual({ orderId: 12 });
      return reply(201, { orderId: 12, txnRef: "a".repeat(32), amount: 73800, expiresAt: "", paymentUrl });
    });
    render(<VnpayButton orderId={12} authToken="jwt" />);
    fireEvent.click(await screen.findByRole("button", { name: "Thanh toán qua VNPay (sandbox)" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(paymentUrl));
  });

  it("lỗi tạo giao dịch thì hiện thông báo; hết phiên thì gọi onUnauthorized", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/config") ? reply(200, { enabled: true }) : reply(409, { message: "Đơn đã được thanh toán" }),
    );
    render(<VnpayButton orderId={12} authToken="jwt" />);
    fireEvent.click(await screen.findByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đơn đã được thanh toán");

    cleanup();
    const onUnauthorized = vi.fn();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/config") ? reply(200, { enabled: true }) : reply(401, { message: "Bạn cần đăng nhập" }),
    );
    render(<VnpayButton orderId={12} authToken="old" onUnauthorized={onUnauthorized} />);
    fireEvent.click(await screen.findByRole("button"));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});

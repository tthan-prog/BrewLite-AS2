import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QrPaymentPanel } from "./qr-payment-panel";

const created = (token: string, over: Record<string, unknown> = {}) => ({
  token,
  orderId: 12,
  amount: 73800,
  status: "PENDING",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  qrContent: `https://brewlite-as2-web.onrender.com/pay/qr/${token}`,
  qrImage: "data:image/png;base64,AAAA",
  ...over,
});
const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("QrPaymentPanel (FR-18)", () => {
  it("tạo mã QR kèm JWT, hiện ảnh và link; khi điện thoại xác nhận thì gọi onPaid đúng một lần", async () => {
    const token = "b".repeat(32);
    let polls = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
        expect(JSON.parse(String(init.body))).toEqual({ orderId: 12 });
        return reply(201, created(token));
      }
      expect(url).toMatch(new RegExp(`/payments/qr/${token}/status$`));
      polls += 1;
      return reply(200, { status: polls >= 2 ? "PAID" : "PENDING" });
    });
    const onPaid = vi.fn();

    render(<QrPaymentPanel orderId={12} authToken="jwt" onPaid={onPaid} pollMs={20} />);
    expect(await screen.findByAltText("Mã QR thanh toán đơn #12")).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.getByRole("link", { name: "Mở trang xác nhận trên máy này" })).toHaveAttribute(
      "href",
      `https://brewlite-as2-web.onrender.com/pay/qr/${token}`,
    );
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Đã thanh toán/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 80));
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("mã thất bại thì cho tạo mã mới", async () => {
    let n = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        n += 1;
        return reply(201, created(String(n).repeat(32)));
      }
      return reply(200, { status: "FAILED" });
    });
    render(<QrPaymentPanel orderId={12} authToken="jwt" onPaid={vi.fn()} pollMs={20} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tạo mã QR mới" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, i]) => i?.method === "POST").length).toBe(2));
  });

  it("đơn đã thanh toán (409) thì hiện lỗi của API; hết phiên (401) thì gọi onUnauthorized", async () => {
    fetchMock.mockImplementation(() => reply(409, { message: "Đơn đã được thanh toán" }));
    render(<QrPaymentPanel orderId={12} authToken="jwt" onPaid={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Đơn đã được thanh toán");

    cleanup();
    fetchMock.mockImplementation(() => reply(401, { message: "Bạn cần đăng nhập" }));
    const onUnauthorized = vi.fn();
    render(<QrPaymentPanel orderId={12} authToken="old" onPaid={vi.fn()} onUnauthorized={onUnauthorized} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});

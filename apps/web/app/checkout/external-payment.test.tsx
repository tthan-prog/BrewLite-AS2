import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CheckoutPage from "./page";

const mockNav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const mockPanel = vi.hoisted(() => ({ qr: vi.fn(), vnpay: vi.fn(), paid: null as null | (() => void) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ ...mockNav, refresh: vi.fn() }) }));
vi.mock("../../components/qr-payment-panel", () => ({
  QrPaymentPanel: (props: { orderId: number; authToken: string; onPaid: () => void }) => {
    mockPanel.qr(props);
    mockPanel.paid = props.onPaid;
    return <div data-testid="qr-payment-panel">QR đơn #{props.orderId}</div>;
  },
}));
vi.mock("../../components/vnpay-button", () => ({
  VnpayButton: (props: { orderId: number; authToken: string }) => {
    mockPanel.vnpay(props);
    return <button type="button">Thanh toán qua VNPay</button>;
  },
}));

const item = { key: "1-L-1-100-100", productId: 1, name: "Cà phê sữa đá", size: "L", topping: "Trân châu đen", toppingIds: [1], sugar: 100, ice: 100, quantity: 2, unitPrice: 46000 };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("brewlite-as2-cart", JSON.stringify([item]));
  sessionStorage.setItem("brewlite_token", "test-token");
  mockNav.push.mockReset(); mockNav.replace.mockReset(); mockPanel.qr.mockReset(); mockPanel.vnpay.mockReset(); mockPanel.paid = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 42, status: "PENDING", total: 92000 }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

async function selectAndCreate(label: string) {
  render(<CheckoutPage />);
  await screen.findByText("Cà phê sữa đá");
  fireEvent.click(screen.getByRole("radio", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: "Thanh toán đơn hàng" }));
}

describe("Checkout QR và VNPay", () => {
  it("VNPay: tạo đơn rồi truyền đúng orderId và token vào VnpayButton", async () => {
    await selectAndCreate("Thanh toán VNPay");
    expect(await screen.findByRole("button", { name: "Thanh toán qua VNPay" })).toBeInTheDocument();
    expect(mockPanel.vnpay).toHaveBeenCalledWith(expect.objectContaining({ orderId: 42, authToken: "test-token" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/orders");
    expect(localStorage.getItem("brewlite-as2-cart")).not.toBeNull();
  });

  it("QR: tạo đơn và hiển thị QrPaymentPanel đúng orderId", async () => {
    await selectAndCreate("Thanh toán QR");
    expect(await screen.findByTestId("qr-payment-panel")).toBeInTheDocument();
    expect(mockPanel.qr).toHaveBeenCalledWith(expect.objectContaining({ orderId: 42, authToken: "test-token" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("QR onPaid: xóa giỏ, pending rồi hiện xác nhận", async () => {
    await selectAndCreate("Thanh toán QR");
    await screen.findByTestId("qr-payment-panel");
    expect(mockPanel.paid).toBeTypeOf("function");
    const paid = mockPanel.paid;
    if (!paid) throw new Error("Thiếu callback QR");
    act(() => paid());
    expect(await screen.findByText("Thanh toán thành công!")).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem("brewlite-as2-cart")).toBeNull();
      expect(sessionStorage.getItem("brewlite-as2-pending-payment")).toBeNull();
    });
    expect(screen.getByText(/Đơn hàng #42/)).toBeInTheDocument();
  });
});

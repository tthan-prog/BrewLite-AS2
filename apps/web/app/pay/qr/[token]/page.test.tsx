import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import QrConfirmPage from "./page";

const TOKEN = "a".repeat(32);
vi.mock("next/navigation", () => ({ useParams: () => ({ token: TOKEN }) }));

const intent = (over: Record<string, unknown> = {}) => ({
  token: TOKEN,
  orderId: 12,
  amount: 73800,
  status: "PENDING",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  accounts: [
    { identifier: "TEST-0001", holderName: "Tài khoản thử 1" },
    { identifier: "TEST-0002", holderName: "Tài khoản thử 2" },
  ],
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Trang xác nhận QR trên điện thoại (FR-18)", () => {
  it("hiện số tiền, tài khoản thử; nhập đúng PIN thì báo thành công", async () => {
    let paid = false;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(url).toMatch(new RegExp(`/payments/qr/${TOKEN}/confirm$`));
        expect(JSON.parse(String(init.body))).toEqual({ accountIdentifier: "TEST-0001", pin: "123456" });
        paid = true;
        return reply(200, { paymentId: 1, orderId: 12, amount: 73800, status: "SUCCESS", orderStatus: "PAID", failureReason: null, pointsEarned: 7 });
      }
      return reply(200, intent(paid ? { status: "PAID" } : {}));
    });

    render(<QrConfirmPage />);
    expect(await screen.findByText(`${(73800).toLocaleString("vi-VN")} ₫`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thanh toán 73\.800/ })).toBeInTheDocument();
    expect(screen.getByText("TEST-0002")).toBeInTheDocument();
    expect(screen.getByText(/Mã hết hạn sau [45]:\d\d/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("PIN (6 số)"), { target: { value: "12a3456" } });
    fireEvent.click(screen.getByRole("button", { name: /Thanh toán/ }));
    expect(await screen.findByText("Thanh toán thành công")).toBeInTheDocument();
  });

  it("PIN chưa đủ 6 số thì báo lỗi, không gọi API xác nhận", async () => {
    fetchMock.mockImplementation(() => reply(200, intent()));
    render(<QrConfirmPage />);
    fireEvent.change(await screen.findByLabelText("PIN (6 số)"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /Thanh toán/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PIN gồm 6 chữ số.");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("sai PIN thì hiện thông báo của API và cho nhập lại", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST" ? reply(400, { message: "Sai tài khoản hoặc PIN" }) : reply(200, intent()),
    );
    render(<QrConfirmPage />);
    fireEvent.change(await screen.findByLabelText("PIN (6 số)"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Thanh toán/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sai tài khoản hoặc PIN");
    expect(screen.getByLabelText("PIN (6 số)")).toHaveValue("");
  });

  it("thiếu số dư thì báo không thành công kèm lý do", async () => {
    let failed = false;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        failed = true;
        return reply(200, { paymentId: 1, orderId: 12, amount: 73800, status: "FAILED", orderStatus: "PAYMENT_FAILED", failureReason: "Số dư tài khoản không đủ", pointsEarned: 0 });
      }
      return reply(200, intent(failed ? { status: "FAILED" } : {}));
    });
    render(<QrConfirmPage />);
    fireEvent.click(await screen.findByLabelText(/TEST-0002/));
    fireEvent.change(screen.getByLabelText("PIN (6 số)"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Thanh toán/ }));
    expect(await screen.findByText("Thanh toán không thành công")).toBeInTheDocument();
    expect(screen.getByText(/Số dư tài khoản không đủ/)).toBeInTheDocument();
  });

  it("mã hết hạn hoặc không tồn tại thì không cho nhập PIN", async () => {
    fetchMock.mockImplementation(() => reply(200, intent({ status: "EXPIRED" })));
    render(<QrConfirmPage />);
    expect(await screen.findByText(/Mã QR đã hết hạn/)).toBeInTheDocument();
    expect(screen.queryByLabelText("PIN (6 số)")).not.toBeInTheDocument();

    cleanup();
    fetchMock.mockImplementation(() => reply(404, { message: "Không tìm thấy mã QR" }));
    render(<QrConfirmPage />);
    expect(await screen.findByText("Mã QR không tồn tại.")).toBeInTheDocument();
  });
});

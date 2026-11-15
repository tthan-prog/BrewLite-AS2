import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffOrdersPage from "./page";
import StaffIngredientsPage from "./ingredients/page";

type Handler = (init: RequestInit | undefined) => { status?: number; body: unknown };

const staff = { id: 2, name: "Nhân Viên Quầy", email: "staff@brewlite.test", role: "STAFF" };
const order = {
  id: 5,
  status: "PAID",
  total: 73800,
  discount: 8200,
  promotionCode: "GIAM10",
  failureReason: null,
  createdAt: "2026-11-16T02:00:00.000Z",
  customerName: "Khách Thử",
  items: [{ id: 1, name: "Cà phê sữa đá", quantity: 2, size: "M", sugar: 50, ice: 100, toppings: [{ id: 1, name: "Trân châu đen" }] }],
};

let routes: Record<string, Handler>;
let fetchMock: ReturnType<typeof vi.fn>;

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

beforeEach(() => {
  sessionStorage.clear();
  routes = {};
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const key = `${init?.method ?? "GET"} ${path}`;
    const handler = routes[key];
    if (!handler) return json(404, { message: `Không có route giả cho ${key}` });
    const { status = 200, body } = handler(init);
    return json(status, body);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const authHeader = (init?: RequestInit) => (init?.headers as Record<string, string> | undefined)?.Authorization;

describe("Trang nhân viên /staff (FR-15)", () => {
  it("chưa đăng nhập thì hiện form; đăng nhập STAFF xong thấy đơn chờ pha", async () => {
    routes["POST /auth/login"] = () => ({ body: { accessToken: "staff-token" } });
    routes["GET /auth/me"] = () => ({ body: staff });
    routes["GET /orders?status=PAID"] = () => ({ body: [order] });

    render(<StaffOrdersPage />);
    expect(await screen.findByRole("heading", { name: "Đăng nhập nhân viên" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@brewlite.test" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "Staff@123" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("#5")).toBeInTheDocument();
    expect(screen.getByText("2 × Cà phê sữa đá")).toBeInTheDocument();
    expect(screen.getByText(/size M, đường 50%, đá 100%, \+ Trân châu đen/)).toBeInTheDocument();
    expect(sessionStorage.getItem("brewlite_token")).toBe("staff-token");
    const ordersCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/orders?status=PAID"));
    expect(authHeader(ordersCall?.[1])).toBe("Bearer staff-token");
  });

  it("tài khoản khách hàng thì báo không có quyền, không gọi API đơn hàng", async () => {
    sessionStorage.setItem("brewlite_token", "customer-token");
    routes["GET /auth/me"] = () => ({ body: { ...staff, role: "CUSTOMER", email: "customer@brewlite.test" } });

    render(<StaffOrdersPage />);
    expect(await screen.findByRole("heading", { name: "Không có quyền truy cập" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/orders"))).toBe(false);
  });

  it("token hết hạn (401) thì xóa token và hiện form đăng nhập", async () => {
    sessionStorage.setItem("brewlite_token", "expired");
    routes["GET /auth/me"] = () => ({ status: 401, body: { message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn" } });

    render(<StaffOrdersPage />);
    expect(await screen.findByRole("heading", { name: "Đăng nhập nhân viên" })).toBeInTheDocument();
    expect(sessionStorage.getItem("brewlite_token")).toBeNull();
  });

  it("bấm Bắt đầu pha gửi PATCH trạng thái PREPARING và báo thành công", async () => {
    sessionStorage.setItem("brewlite_token", "staff-token");
    let current = "PAID";
    routes["GET /auth/me"] = () => ({ body: staff });
    routes["GET /orders?status=PAID"] = () => ({ body: current === "PAID" ? [order] : [] });
    routes["PATCH /orders/5/status"] = (init) => {
      current = JSON.parse(String(init?.body)).status;
      return { body: { ...order, status: current } };
    };

    render(<StaffOrdersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Bắt đầu pha" }));

    expect(await screen.findByText("Đơn #5: Đang pha")).toBeInTheDocument();
    expect(current).toBe("PREPARING");
    await waitFor(() => expect(screen.getByText("Không có đơn nào ở trạng thái này.")).toBeInTheDocument());
  });

  it("chuyển trạng thái bị API từ chối thì hiện thông báo lỗi", async () => {
    sessionStorage.setItem("brewlite_token", "staff-token");
    routes["GET /auth/me"] = () => ({ body: staff });
    routes["GET /orders?status=PAID"] = () => ({ body: [order] });
    routes["PATCH /orders/5/status"] = () => ({ status: 409, body: { message: "Đơn vừa được cập nhật bởi thao tác khác, vui lòng tải lại" } });

    render(<StaffOrdersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Bắt đầu pha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đơn vừa được cập nhật bởi thao tác khác");
  });
});

describe("Trang kho nguyên liệu /staff/ingredients (FR-17)", () => {
  const ingredients = [
    { id: 1, name: "Cà phê rang xay", unit: "g", stock: 0, lowThreshold: 500, flag: "OUT" },
    { id: 2, name: "Sữa tươi", unit: "ml", stock: 1500, lowThreshold: 2000, flag: "LOW" },
    { id: 3, name: "Đá viên", unit: "g", stock: 40000, lowThreshold: 4000, flag: "OK" },
  ];

  beforeEach(() => {
    sessionStorage.setItem("brewlite_token", "staff-token");
    routes["GET /auth/me"] = () => ({ body: staff });
    routes["GET /ingredients"] = () => ({ body: ingredients });
  });

  it("hiện cờ Hết, Sắp hết, Đủ và cảnh báo số nguyên liệu cần nhập", async () => {
    render(<StaffIngredientsPage />);
    expect(await screen.findByText("Cà phê rang xay")).toBeInTheDocument();
    expect(screen.getByText("Hết")).toBeInTheDocument();
    expect(screen.getByText("Sắp hết")).toBeInTheDocument();
    expect(screen.getByText("Đủ")).toBeInTheDocument();
    expect(screen.getByText("2 nguyên liệu hết hoặc sắp hết, cần nhập thêm.")).toBeInTheDocument();
  });

  it("số lượng không dương thì báo lỗi và không gọi API", async () => {
    render(<StaffIngredientsPage />);
    fireEvent.change(await screen.findByLabelText("Số lượng nhập Cà phê rang xay"), { target: { value: "0" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Nhập" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Số lượng nhập phải là số nguyên dương.");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("nhập thêm gửi PATCH restock và cập nhật tồn kho, cờ", async () => {
    routes["PATCH /ingredients/1/restock"] = (init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ quantity: 1000 });
      return { body: { ...ingredients[0], stock: 1000, flag: "OK" } };
    };
    render(<StaffIngredientsPage />);
    fireEvent.change(await screen.findByLabelText("Số lượng nhập Cà phê rang xay"), { target: { value: "1000" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Nhập" })[0]);
    expect(await screen.findByText("Đã nhập thêm 1000 g Cà phê rang xay. Tồn kho: 1000 g.")).toBeInTheDocument();
    expect(screen.queryByText("Hết")).not.toBeInTheDocument();
  });
});

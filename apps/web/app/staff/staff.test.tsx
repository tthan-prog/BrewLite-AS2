import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffOrdersPage from "./page";
import StaffIngredientsPage from "./ingredients/page";
import StaffRecipesPage from "./recipes/page";

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
  it("đăng xuất: xóa token và thông tin nhân viên, link dẫn về trang chủ", async () => {
    sessionStorage.setItem("brewlite_token", "staff-token");
    sessionStorage.setItem("brewlite_user", JSON.stringify(staff));
    routes["GET /auth/me"] = () => ({ body: staff });
    routes["GET /orders?status=PAID"] = () => ({ body: [] });
    render(<StaffOrdersPage />);
    const logout = await screen.findByRole("link", { name: "Đăng xuất" });
    expect(logout).toHaveAttribute("href", "/");
    fireEvent.click(logout);
    expect(sessionStorage.getItem("brewlite_token")).toBeNull();
    expect(sessionStorage.getItem("brewlite_user")).toBeNull();
  });

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

describe("Trang công thức /staff/recipes (FR-16, FR-17)", () => {
  const recipes = (coffeeStock: number) => {
    const s = Math.floor(coffeeStock / 18);
    const m = Math.floor(coffeeStock / 23);
    const l = Math.floor(coffeeStock / 27);
    return {
      products: [
        {
          id: 7, name: "Cà phê sữa đá", category: "Cà phê", imageUrl: "", basePrice: 29000,
          ingredients: [
            { id: 1, name: "Cà phê rang xay", unit: "g", stock: coffeeStock, flag: coffeeStock > 0 ? "OK" : "OUT", perCup: { S: 18, M: 23, L: 27 }, sugarScaled: false, iceScaled: false },
            { id: 4, name: "Siro đường", unit: "ml", stock: 5000, flag: "OK", perCup: { S: 10, M: 13, L: 15 }, sugarScaled: true, iceScaled: false },
          ],
          cups: { S: s, M: m, L: l },
          limiting: { S: "Cà phê rang xay", M: "Cà phê rang xay", L: "Cà phê rang xay" },
        },
        {
          id: 8, name: "Matcha latte", category: "Trà", imageUrl: "", basePrice: 45000,
          ingredients: [{ id: 5, name: "Bột matcha", unit: "g", stock: 600, flag: "OK", perCup: { S: 6, M: 8, L: 9 }, sugarScaled: false, iceScaled: false }],
          cups: { S: 100, M: 75, L: 66 },
          limiting: { S: "Bột matcha", M: "Bột matcha", L: "Bột matcha" },
        },
      ],
      toppings: [{ id: 1, name: "Trân châu đen", price: 7000, ingredients: [{ id: 6, name: "Trân châu", unit: "g", stock: 400, flag: "OK", perServing: 40 }], servings: 10, limiting: "Trân châu" }],
    };
  };
  let coffeeStock = 90;

  beforeEach(() => {
    coffeeStock = 90;
    sessionStorage.setItem("brewlite_token", "staff-token");
    routes["GET /auth/me"] = () => ({ body: staff });
    routes["GET /ingredients/recipes"] = () => ({ body: recipes(coffeeStock) });
  });

  it("hiện công thức theo size, số ly S/M/L, nguyên liệu giới hạn, thống kê và topping", async () => {
    render(<StaffRecipesPage />);
    const card = await screen.findByRole("article", { name: "Cà phê sữa đá" });
    expect(card).toHaveTextContent("Cà phê rang xay");
    expect(screen.getByLabelText("Số ly làm được của Cà phê sữa đá")).toHaveTextContent(/S\s*5.*M\s*3.*L\s*3/);
    expect(card).toHaveTextContent("Giới hạn bởi Cà phê rang xay");
    expect(card).toHaveTextContent("theo mức đường");
    expect(screen.getByText("Món còn dưới 10 ly (size S)").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("10 phần")).toBeInTheDocument();
  });

  it("nhập thêm nguyên liệu giới hạn: gửi PATCH rồi tải lại, số ly tăng ngay", async () => {
    routes["PATCH /ingredients/1/restock"] = (init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ quantity: 900 });
      coffeeStock += 900;
      return { body: { id: 1, name: "Cà phê rang xay", unit: "g", stock: coffeeStock, lowThreshold: 500, flag: "OK" } };
    };
    render(<StaffRecipesPage />);
    fireEvent.change(await screen.findByLabelText("Số lượng nhập Cà phê rang xay cho Cà phê sữa đá"), { target: { value: "900" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Nhập thêm" })[0]);
    expect(await screen.findByText("Đã nhập thêm 900 g Cà phê rang xay. Số ly đã cập nhật theo tồn kho mới.")).toBeInTheDocument();
    expect(screen.getByLabelText("Số ly làm được của Cà phê sữa đá")).toHaveTextContent(/S\s*55.*M\s*43.*L\s*36/);
  });

  it("sắp xếp ít ly nhất trước và tìm theo tên", async () => {
    render(<StaffRecipesPage />);
    await screen.findByRole("article", { name: "Cà phê sữa đá" });
    fireEvent.click(screen.getByRole("button", { name: "Ít ly nhất trước" }));
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Cà phê sữa đá", "Matcha latte"]);
    fireEvent.change(screen.getByLabelText("Tìm món"), { target: { value: "matcha" } });
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Matcha latte"]);
  });

  it("trang kho hiện món dùng nguyên liệu kèm số ly, cập nhật sau khi nhập kho", async () => {
    routes["GET /ingredients"] = () => ({ body: [{ id: 1, name: "Cà phê rang xay", unit: "g", stock: coffeeStock, lowThreshold: 500, flag: "LOW" }] });
    routes["PATCH /ingredients/1/restock"] = () => {
      coffeeStock += 900;
      return { body: { id: 1, name: "Cà phê rang xay", unit: "g", stock: coffeeStock, lowThreshold: 500, flag: "OK" } };
    };
    render(<StaffIngredientsPage />);
    expect(await screen.findByText("Cà phê sữa đá: 5")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Số lượng nhập Cà phê rang xay"), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Nhập" }));
    expect(await screen.findByText("Cà phê sữa đá: 55")).toBeInTheDocument();
  });
});

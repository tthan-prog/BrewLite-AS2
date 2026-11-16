
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CartPage from "./page";


const sampleCart = [
  {
    key: "1-L-1-100-100",
    productId: 1,
    name: "Cà phê sữa đá",
    size: "L",
    topping: "Trân châu đen",
    toppingIds: [1],
    sugar: 100,
    ice: 100,
    quantity: 2,
    unitPrice: 46000,
  },
];


let maxQuantity = 50;
beforeEach(() => {
  localStorage.clear();
  maxQuantity = 50;
  vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
    const items = (JSON.parse(String(init?.body)) as { items: Array<{ productId: number; quantity: number }> }).items;
    const lines = items.map((i) => ({ productId: i.productId, requested: i.quantity, maxQuantity, ok: i.quantity <= maxQuantity, message: i.quantity <= maxQuantity ? null : `"Cà phê sữa đá" với lựa chọn này chỉ còn làm được tối đa ${maxQuantity} ly` }));
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: lines.every((l) => l.ok), lines }) } as Response);
  }));

  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)
  );

  vi.stubGlobal(
    "cancelAnimationFrame",
    (id: number) => window.clearTimeout(id)
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("BrewLite - Gio hang Task 5", () => {
  it("hien thi khi gio hang trong", async () => {
    render(<CartPage />);

    expect(
      await screen.findByText("Giỏ hàng hiện đang trống.")
    ).toBeInTheDocument();
  });

  it("hien thi 2 ly voi tong tien 88000", async () => {
    localStorage.setItem(
      "brewlite-as2-cart",
      JSON.stringify(sampleCart)
    );

    render(<CartPage />);

    expect(
      await screen.findByText("Cà phê sữa đá")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Size L · Trân châu đen")
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("92.000đ").length
    ).toBeGreaterThan(0);
  });

  it("tang giam so luong va cap nhat tong tien", async () => {
    localStorage.setItem(
      "brewlite-as2-cart",
      JSON.stringify(sampleCart)
    );

    render(<CartPage />);

    await screen.findByText("Cà phê sữa đá");

    fireEvent.click(
      screen.getByRole("button", { name: "+" })
    );

    expect(
      screen.getAllByText("138.000đ").length
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "−" })
    );

    expect(
      screen.getAllByText("92.000đ").length
    ).toBeGreaterThan(0);

    const saved = JSON.parse(
      localStorage.getItem("brewlite-as2-cart") || "[]"
    );

    expect(saved[0].quantity).toBe(2);
  });

  it("xoa mon khoi gio hang", async () => {
    localStorage.setItem(
      "brewlite-as2-cart",
      JSON.stringify(sampleCart)
    );

    render(<CartPage />);

    await screen.findByText("Cà phê sữa đá");

    fireEvent.click(
      screen.getByRole("button", { name: "Xóa món" })
    );

    expect(
      screen.getByText("Giỏ hàng hiện đang trống.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        JSON.parse(
          localStorage.getItem("brewlite-as2-cart") || "[]"
        )
      ).toEqual([]);
    });
  });

  it("kiểm tra nguyên liệu cả giỏ: vượt số ly làm được thì báo lỗi, khóa nút tăng và nút thanh toán", async () => {
    maxQuantity = 1;
    localStorage.setItem("brewlite-as2-cart", JSON.stringify(sampleCart));
    render(<CartPage />);
    expect(await screen.findByText(/chỉ còn làm được tối đa 1 ly/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Điều chỉnh giỏ hàng để tiếp tục" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Tiếp tục thanh toán" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(await screen.findByRole("link", { name: "Tiếp tục thanh toán" })).toBeInTheDocument();
  });
});

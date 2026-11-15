
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
    key: "1-L-Trân châu",
    productId: "1",
    name: "Cà phê sữa đá",
    size: "L",
    topping: "Trân châu",
    quantity: 2,
    unitPrice: 44000,
  },
];

beforeEach(() => {
  localStorage.clear();

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
      screen.getByText("Size L · Trân châu")
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("88.000đ").length
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
      screen.getAllByText("132.000đ").length
    ).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "−" })
    );

    expect(
      screen.getAllByText("88.000đ").length
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
});

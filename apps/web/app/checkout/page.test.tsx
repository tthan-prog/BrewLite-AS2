
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
} from "@testing-library/react";
import CheckoutPage from "./page";

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

describe("BrewLite - Checkout Task 5", () => {
  it("hien thi don hang va tong tien", async () => {
    localStorage.setItem(
      "brewlite-as2-cart",
      JSON.stringify(sampleCart)
    );

    render(<CheckoutPage />);

    expect(
      await screen.findByText("Cà phê sữa đá")
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("88.000đ").length
    ).toBeGreaterThan(0);

    expect(
      screen.getByRole("button", {
        name: /Thanh toán 88.000đ/,
      })
    ).toBeDisabled();
  });

  it("cho phep chon Vi hoac The", async () => {
    localStorage.setItem(
      "brewlite-as2-cart",
      JSON.stringify(sampleCart)
    );

    render(<CheckoutPage />);

    await screen.findByText("Cà phê sữa đá");

    const wallet = screen.getByRole("radio", {
      name: "Ví điện tử (mô phỏng)",
    });

    const card = screen.getByRole("radio", {
      name: "Thẻ ngân hàng (mô phỏng)",
    });

    expect(wallet).toBeChecked();

    fireEvent.click(card);

    expect(card).toBeChecked();
    expect(wallet).not.toBeChecked();
  });
});

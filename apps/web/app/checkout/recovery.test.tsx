
import {
  afterEach,
  beforeEach,
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
import CheckoutPage from "./page";

const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    refresh: vi.fn(),
  }),
}));

const CART_KEY = "brewlite-as2-cart";
const PENDING_KEY = "brewlite-as2-pending-payment";

const cart = [
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

function snapshot(quantity = 2) {
  return JSON.stringify({
    items: [
      {
        productId: 1,
        quantity,
        size: "L",
        sugar: 100,
        ice: 100,
        toppingIds: [1],
      },
    ],
    promotionCode: "",
  });
}

function savePending(
  orderId: number,
  cartSnapshot = snapshot()
) {
  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ orderId, cartSnapshot })
  );
}

function apiResponse(data: unknown, status = 201) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  routerPush.mockClear();
  routerReplace.mockClear();

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  sessionStorage.setItem("brewlite_token", "test-token");

  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)
  );

  vi.stubGlobal(
    "cancelAnimationFrame",
    (id: number) => window.clearTimeout(id)
  );

  vi.stubGlobal("crypto", {
    randomUUID: vi.fn().mockReturnValue("test-idempotency-key"),
  });

  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Checkout - xu ly don hang cu", () => {
  it("400: xoa don het han, giu gio va tao don moi", async () => {
    savePending(12);

    fetchMock
      .mockResolvedValueOnce(
        apiResponse(
          {
            message:
              "Đơn đã bị hủy, không thể thanh toán",
          },
          400
        )
      )
      .mockResolvedValueOnce(
        apiResponse({
          id: 13,
          total: 92000,
          status: "PENDING",
        })
      )
      .mockResolvedValueOnce(
        apiResponse({
          orderId: 13,
          status: "SUCCESS",
          failureReason: null,
          pointsEarned: 9,
        })
      );

    render(<CheckoutPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText(/Đơn cũ đã hết hạn/)
    ).toBeInTheDocument();

    expect(sessionStorage.getItem(PENDING_KEY))
      .toBeNull();

    expect(localStorage.getItem(CART_KEY))
      .not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText("Thanh toán thành công!")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Đơn hàng #13/)
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(3);

    expect(String(fetchMock.mock.calls[0][0]))
      .toContain("/payments");

    expect(String(fetchMock.mock.calls[1][0]))
      .toContain("/orders");

    expect(String(fetchMock.mock.calls[2][0]))
      .toContain("/payments");

    expect(localStorage.getItem(CART_KEY))
      .toBeNull();
  });

  it("409: don da thanh toan thi hien thanh cong", async () => {
    savePending(12);

    fetchMock.mockResolvedValueOnce(
      apiResponse(
        { message: "Đơn đã được thanh toán" },
        409
      )
    );

    render(<CheckoutPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText("Thanh toán thành công!")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Đơn hàng #12/)
    ).toBeInTheDocument();

    expect(localStorage.getItem(CART_KEY))
      .toBeNull();

    expect(sessionStorage.getItem(PENDING_KEY))
      .toBeNull();

    // Không tạo đơn mới khi đơn cũ đã thanh toán.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(String(fetchMock.mock.calls[0][0]))
      .toContain("/payments");
  });

  it("gio thay doi: bam Tao don moi de dat lai", async () => {
    // Đơn cũ được tạo khi giỏ chỉ có 1 ly.
    savePending(12, snapshot(1));

    // Giỏ hiện tại đã đổi thành 2 ly.
    fetchMock
      .mockResolvedValueOnce(
        apiResponse({
          id: 13,
          total: 92000,
          status: "PENDING",
        })
      )
      .mockResolvedValueOnce(
        apiResponse({
          orderId: 13,
          status: "SUCCESS",
          failureReason: null,
          pointsEarned: 9,
        })
      );

    render(<CheckoutPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText(/Giỏ hàng đã thay đổi/)
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Tạo đơn mới",
      })
    );

    await waitFor(() => {
      expect(sessionStorage.getItem(PENDING_KEY))
        .toBeNull();
    });

    expect(localStorage.getItem(CART_KEY))
      .not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText("Thanh toán thành công!")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Đơn hàng #13/)
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(String(fetchMock.mock.calls[0][0]))
      .toContain("/orders");

    const orderBody = JSON.parse(
      fetchMock.mock.calls[0][1].body
    );

    expect(orderBody.items[0].quantity).toBe(2);
  });
});

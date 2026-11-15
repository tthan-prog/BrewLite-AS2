
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

const orderResponse = {
  id: 12,
  total: 92000,
  status: "PENDING",
};

function response(data: unknown, status = 201) {
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

  sessionStorage.setItem("brewlite_token", "test-token");
  localStorage.setItem(
    "brewlite-as2-cart",
    JSON.stringify(sampleCart)
  );

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
    randomUUID: vi.fn()
      .mockReturnValueOnce("test-payment-key-12345678")
      .mockReturnValueOnce("test-payment-key-87654321"),
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

describe("BrewLite - Thanh toan API Task 5", () => {
  it("SUCCESS: tao don, thanh toan va xoa gio", async () => {
    fetchMock
      .mockResolvedValueOnce(response(orderResponse))
      .mockResolvedValueOnce(
        response({
          orderId: 12,
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
      await screen.findByText("Thanh toán thành công!")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Đơn hàng #12/)
    ).toBeInTheDocument();

    expect(
      localStorage.getItem("brewlite-as2-cart")
    ).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [orderUrl, orderOptions] =
      fetchMock.mock.calls[0];

    expect(String(orderUrl)).toContain("/orders");

    expect(JSON.parse(orderOptions.body)).toEqual({
      items: [
        {
          productId: 1,
          quantity: 2,
          size: "L",
          sugar: 100,
          ice: 100,
          toppingIds: [1],
        },
      ],
    });

    expect(orderOptions.headers.Authorization)
      .toBe("Bearer test-token");

    const [paymentUrl, paymentOptions] =
      fetchMock.mock.calls[1];

    expect(String(paymentUrl)).toContain("/payments");

    expect(paymentOptions.headers["Idempotency-Key"])
      .toBe("test-payment-key-12345678");
  });

  it("FAILED: giu gio va thu lai tren cung don", async () => {
    fetchMock
      .mockResolvedValueOnce(response(orderResponse))
      .mockResolvedValueOnce(
        response({
          orderId: 12,
          status: "FAILED",
          failureReason: "Thẻ bị ngân hàng từ chối",
          pointsEarned: 0,
        })
      )
      .mockResolvedValueOnce(
        response({
          orderId: 12,
          status: "SUCCESS",
          failureReason: null,
          pointsEarned: 9,
        })
      );

    render(<CheckoutPage />);

    await screen.findByText("Cà phê sữa đá");

    fireEvent.click(
      screen.getByRole("radio", {
        name: "Thẻ ngân hàng (mô phỏng)",
      })
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "4242 4242 4242 4242"
      ),
      {
        target: {
          value: "4000 0000 0000 0002",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText(
        "Thẻ bị ngân hàng từ chối"
      )
    ).toBeInTheDocument();

    expect(
      localStorage.getItem("brewlite-as2-cart")
    ).not.toBeNull();

    fireEvent.change(
      screen.getByPlaceholderText(
        "4242 4242 4242 4242"
      ),
      {
        target: {
          value: "4242 4242 4242 4242",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Thanh toán đơn hàng",
      })
    );

    expect(
      await screen.findByText("Thanh toán thành công!")
    ).toBeInTheDocument();

    // Chỉ tạo 1 đơn, thử thanh toán lại trên đơn đó.
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const secondPayment = fetchMock.mock.calls[2][1];

    expect(JSON.parse(secondPayment.body).orderId)
      .toBe(12);

    expect(
      secondPayment.headers["Idempotency-Key"]
    ).toBe("test-payment-key-87654321");

    expect(
      localStorage.getItem("brewlite-as2-cart")
    ).toBeNull();
  });

  it("chua dang nhap: chuyen login va giu gio", async () => {
    sessionStorage.removeItem("brewlite_token");

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith(
        "/login?next=/checkout"
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();

    expect(
      localStorage.getItem("brewlite-as2-cart")
    ).not.toBeNull();
  });
});

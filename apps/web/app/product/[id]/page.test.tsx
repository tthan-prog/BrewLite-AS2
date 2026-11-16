import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductDetailPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "7" }), useRouter: () => ({ push }) }));

const product = {
  id: 7,
  name: "Trà sữa trân châu",
  price: 42000,
  description: "Trà sữa kèm trân châu",
  category: "Trà sữa",
  available: true,
  maxQuantity: 50,
  sizes: [{ size: "S", surcharge: 0 }, { size: "M", surcharge: 5000 }, { size: "L", surcharge: 10000 }],
  toppings: [
    { id: 1, name: "Trân châu đen", price: 7000, available: true },
    { id: 2, name: "Thạch dừa", price: 6000, available: true },
    { id: 3, name: "Kem cheese", price: 10000, available: false },
  ],
  sugarLevels: [0, 30, 50, 70, 100],
  iceLevels: [0, 30, 50, 70, 100],
};

const reply = (body: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => body } as Response);
let maxForLast = 50;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  push.mockReset();
  maxForLast = 50;
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/products/7")) return reply(product);
    if (url.endsWith("/products/availability")) {
      const items = (JSON.parse(String(init?.body)) as { items: unknown[] }).items;
      return reply({ ok: true, lines: items.map((_, i) => ({ productId: 7, requested: 1, maxQuantity: i === items.length - 1 ? maxForLast : 50, ok: true, message: null })) });
    }
    return reply({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const lastAvailabilityBody = () => {
  const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/products/availability"));
  return JSON.parse(String((calls[calls.length - 1][1] as RequestInit).body)) as { items: Array<Record<string, unknown>> };
};

describe("Trang chi tiết món", () => {
  it("chọn nhiều topping: giá cộng đủ topping, bỏ chọn được; topping hết nguyên liệu không bấm được", async () => {
    render(<ProductDetailPage />);
    expect(await screen.findByRole("heading", { name: "Trà sữa trân châu" })).toBeInTheDocument();
    // Mặc định size M: 42.000 + 5.000
    expect(screen.getByText("47.000đ / ly")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Trân châu đen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Thạch dừa/ }));
    expect(screen.getByText("60.000đ / ly")).toBeInTheDocument();
    expect(screen.getByText(/đã chọn 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kem cheese/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Thạch dừa/ }));
    expect(screen.getByText("54.000đ / ly")).toBeInTheDocument();
    await waitFor(() => expect(lastAvailabilityBody().items.at(-1)).toMatchObject({ productId: 7, size: "M", toppingIds: [1] }));
  });

  it("số ly bị giới hạn theo máy chủ cho lựa chọn hiện tại; hết nguyên liệu thì không thêm được", async () => {
    maxForLast = 2;
    render(<ProductDetailPage />);
    expect(await screen.findByText("Còn thêm được tối đa 2 ly với lựa chọn này")).toBeInTheDocument();
    const plus = screen.getByRole("button", { name: "Tăng số lượng" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByLabelText("Số lượng đã chọn")).toHaveTextContent("2");
    expect(plus).toBeDisabled();

    maxForLast = 0;
    fireEvent.click(screen.getByRole("button", { name: /^L · Lớn/ }));
    expect(await screen.findByText("Lựa chọn này tạm hết nguyên liệu, hãy đổi size hoặc topping.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm vào giỏ hàng" })).toBeDisabled();
  });

  it("thêm vào giỏ: lưu đủ topping đã sắp xếp, tên topping, đơn giá; cùng lựa chọn thì gộp dòng; gửi kèm giỏ hiện có khi kiểm tra", async () => {
    render(<ProductDetailPage />);
    await screen.findByRole("heading", { name: "Trà sữa trân châu" });
    fireEvent.click(screen.getByRole("button", { name: /Thạch dừa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Trân châu đen/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "50%" })[0]); // mức đường
    await waitFor(() => expect(lastAvailabilityBody().items.at(-1)).toMatchObject({ toppingIds: [2, 1] }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ hàng" }));
    const cart = JSON.parse(localStorage.getItem("brewlite-as2-cart") ?? "[]");
    expect(cart).toEqual([
      expect.objectContaining({ productId: 7, size: "M", toppingIds: [1, 2], topping: "Trân châu đen, Thạch dừa", sugar: 50, quantity: 1, unitPrice: 60000 }),
    ]);
    expect(push).toHaveBeenCalledWith("/cart");

    cleanup();
    render(<ProductDetailPage />);
    await screen.findByRole("heading", { name: "Trà sữa trân châu" });
    fireEvent.click(screen.getByRole("button", { name: /Trân châu đen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Thạch dừa/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "50%" })[0]);
    // Lần kiểm tra gửi cả dòng đang có trong giỏ (số lượng hiện có + 1)
    await waitFor(() => expect(lastAvailabilityBody().items).toEqual([expect.objectContaining({ productId: 7, quantity: 2, toppingIds: [1, 2] })]));
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ hàng" }));
    expect(JSON.parse(localStorage.getItem("brewlite-as2-cart") ?? "[]")).toEqual([expect.objectContaining({ quantity: 2 })]);
  });

  it("món không tồn tại: báo lỗi và có đường quay lại thực đơn", async () => {
    fetchMock.mockImplementation(() => reply({ message: "Không tìm thấy" }, 404));
    render(<ProductDetailPage />);
    expect(await screen.findByText("Món này không tồn tại hoặc đã ngừng bán.")).toBeInTheDocument();
  });
});

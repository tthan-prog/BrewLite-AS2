import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: password } });
  fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!);
}

beforeEach(() => {
  push.mockReset();
  sessionStorage.clear();
  window.history.pushState({}, "", "/login");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("BrewLite Login", () => {
  it("lưu token và chuyển sang trang thực đơn khi đăng nhập thành công", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: "token-123",
          user: { id: "1", name: "Khách", email: "customer@brewlite.test" },
        })
      )
    );

    render(<LoginPage />);
    fillAndSubmit("customer@brewlite.test", "password123");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/menu"));
    expect(sessionStorage.getItem("brewlite_token")).toBe("token-123");
  });

  it("chuyển về đường dẫn trong ?next= khi đó là đường dẫn nội bộ", async () => {
    window.history.pushState({}, "", "/login?next=/orders/history");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ accessToken: "token-123" }))
    );

    render(<LoginPage />);
    fillAndSubmit("customer@brewlite.test", "password123");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/history"));
  });

  it("bỏ qua ?next= là đường dẫn ngoài trang", async () => {
    window.history.pushState({}, "", "/login?next=https://evil.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ accessToken: "token-123" }))
    );

    render(<LoginPage />);
    fillAndSubmit("customer@brewlite.test", "password123");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/menu"));
  });

  it("hiển thị lỗi khi sai thông tin đăng nhập", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ message: "Email hoặc mật khẩu không đúng" }, false, 401)
      )
    );

    render(<LoginPage />);
    fillAndSubmit("customer@brewlite.test", "sai-mat-khau");

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Email hoặc mật khẩu không đúng");
    expect(sessionStorage.getItem("brewlite_token")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
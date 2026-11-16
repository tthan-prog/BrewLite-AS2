import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RewardsPage from "./page";

function respond(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const reward = { id: 3, name: "Voucher 10K", pointsCost: 50 };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("brewlite_token", "test-token");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("Rewards US-17", () => {
  it("đổi quà thành công, hiển thị mã và số điểm mới", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/auth/me")) return Promise.resolve(respond({ name: "Khách hàng", points: 120 }));
      if (path.endsWith("/rewards/3/redeem") && options?.method === "POST") {
        return Promise.resolve(respond({ code: "BL-ABCDEFGH", pointsLeft: 70 }, 201));
      }
      if (path.endsWith("/rewards/me")) return Promise.resolve(respond([{ id: 9, code: "BL-ABCDEFGH", rewardName: "Voucher 10K" }]));
      if (path.endsWith("/rewards")) return Promise.resolve(respond([reward]));
      throw new Error(`Unexpected URL: ${path}`);
    });

    render(<RewardsPage />);
    expect(await screen.findByText("120 điểm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đổi quà" }));
    expect(await screen.findByText("Đổi quà thành công!")).toBeInTheDocument();
    expect(screen.getByText("70 điểm")).toBeInTheDocument();
    expect(screen.getAllByText("BL-ABCDEFGH").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/rewards/3/redeem"),
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer test-token" } })
    );
  });

  it("không đủ điểm: hiện đúng lỗi API và không trừ điểm", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/auth/me")) return Promise.resolve(respond({ name: "Khách hàng", points: 20 }));
      if (path.endsWith("/rewards/3/redeem") && options?.method === "POST") {
        return Promise.resolve(respond({ message: "Không đủ điểm để đổi phần thưởng này" }, 400));
      }
      if (path.endsWith("/rewards/me")) return Promise.resolve(respond([]));
      if (path.endsWith("/rewards")) return Promise.resolve(respond([reward]));
      throw new Error(`Unexpected URL: ${path}`);
    });

    render(<RewardsPage />);
    expect(await screen.findByText("20 điểm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đổi quà" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không đủ điểm để đổi phần thưởng này");
    expect(screen.getByText("20 điểm")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });
});

"use client";

import { StaffGate, StaffNav } from "../staff-gate";
import { RecipesBoard } from "./recipes-board";

/** /staff/recipes: công thức từng món theo size và số ly làm được với tồn kho hiện tại (FR-16, FR-17). */
export default function StaffRecipesPage() {
  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <StaffGate>
          {(user, logout) => (
            <>
              <StaffNav user={user} logout={logout} current="recipes" />
              <h1 className="text-3xl font-bold">Công thức &amp; số ly làm được</h1>
              <p className="mb-5 mt-1 text-sm text-[#766B60]">
                Lượng nguyên liệu cho 1 ly theo từng size (100% đường, 100% đá). Số ly tính theo tồn kho hiện tại và cập nhật ngay khi nhập kho hoặc có đơn được thanh toán.
              </p>
              <RecipesBoard onUnauthorized={logout} />
            </>
          )}
        </StaffGate>
      </div>
    </main>
  );
}

"use client";

import { StaffGate, StaffNav } from "../staff-gate";
import { IngredientsTable } from "./ingredients-table";

/** /staff/ingredients: tồn kho nguyên liệu, cờ hết và sắp hết, nhập thêm (US-15, FR-17). */
export default function StaffIngredientsPage() {
  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <StaffGate>
          {(user, logout) => (
            <>
              <StaffNav user={user} logout={logout} current="ingredients" />
              <h1 className="mb-4 text-3xl font-bold">Kho nguyên liệu</h1>
              <IngredientsTable onUnauthorized={logout} />
            </>
          )}
        </StaffGate>
      </div>
    </main>
  );
}

"use client";

import { OrdersBoard } from "./orders-board";
import { StaffGate, StaffNav } from "./staff-gate";

/** /staff: nhân viên xem đơn theo trạng thái và xử lý pha chế (US-12, FR-15). */
export default function StaffOrdersPage() {
  return (
    <main className="min-h-screen bg-[#F8F5EF] px-4 py-8 text-[#30271F] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <StaffGate>
          {(user, logout) => (
            <>
              <StaffNav user={user} logout={logout} current="orders" />
              <h1 className="mb-4 text-3xl font-bold">Đơn hàng</h1>
              <OrdersBoard onUnauthorized={logout} />
            </>
          )}
        </StaffGate>
      </div>
    </main>
  );
}

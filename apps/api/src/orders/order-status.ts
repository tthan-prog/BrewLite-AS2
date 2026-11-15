import { OrderStatus } from '@prisma/client';

/**
 * Máy trạng thái đơn hàng (FR-10, khớp activity diagram).
 * Mọi chuyển trạng thái không có trong bảng đều bị từ chối.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Trạng thái nhân viên được đặt qua PATCH /orders/:id/status. PAID và PAYMENT_FAILED chỉ do luồng thanh toán đặt. */
export const STAFF_TARGET_STATUSES = ['PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const;
export type StaffTargetStatus = (typeof STAFF_TARGET_STATUSES)[number];

/** Trạng thái còn chờ thanh toán. */
export const PAYABLE_STATUSES: readonly OrderStatus[] = ['PENDING', 'PAYMENT_FAILED'];

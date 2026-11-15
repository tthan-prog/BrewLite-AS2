import { Prisma } from '@prisma/client';

export interface IngredientUse {
  ingredientId: number;
  quantity: number;
}

/**
 * Trừ kho bằng cập nhật có điều kiện "stock >= lượng cần" (FR-12, ADR 005).
 * Chạy trong transaction; nếu một nguyên liệu không đủ thì trả id nguyên liệu đó,
 * bên gọi phải rollback transaction để không trừ dở dang.
 * Sắp theo id để các transaction đồng thời khóa dòng cùng thứ tự, tránh deadlock.
 */
export async function consumeStock(tx: Prisma.TransactionClient, uses: IngredientUse[]): Promise<number | null> {
  const sorted = [...uses].sort((a, b) => a.ingredientId - b.ingredientId);
  for (const use of sorted) {
    const updated = await tx.$executeRaw`
      UPDATE ingredients SET stock = stock - ${use.quantity}
      WHERE id = ${use.ingredientId} AND stock >= ${use.quantity}`;
    if (updated === 0) return use.ingredientId;
  }
  return null;
}

/** Hoàn lại đúng lượng đã trừ (thanh toán thất bại sau khi giữ kho, hoặc hủy đơn đã PAID). */
export async function restoreStock(tx: Prisma.TransactionClient, uses: IngredientUse[]): Promise<void> {
  const sorted = [...uses].sort((a, b) => a.ingredientId - b.ingredientId);
  for (const use of sorted) {
    await tx.ingredient.update({
      where: { id: use.ingredientId },
      data: { stock: { increment: use.quantity } },
    });
  }
}

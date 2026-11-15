import { LoyaltyType, Prisma } from '@prisma/client';
import { loyaltyPoints } from '../orders/pricing';

/**
 * Cộng điểm khi đơn chuyển PAID (FR-14). Ràng buộc unique (orderId, type)
 * bảo đảm một đơn chỉ có một giao dịch EARN.
 */
export async function earnPoints(
  tx: Prisma.TransactionClient,
  userId: number,
  orderId: number,
  total: number,
): Promise<number> {
  const points = loyaltyPoints(total);
  if (points <= 0) return 0;
  await tx.loyaltyTransaction.create({ data: { userId, orderId, type: LoyaltyType.EARN, points } });
  await tx.user.update({ where: { id: userId }, data: { points: { increment: points } } });
  return points;
}

/** Trừ lại điểm đã cộng khi hủy đơn đã PAID; điểm không xuống dưới 0. */
export async function reversePoints(tx: Prisma.TransactionClient, orderId: number): Promise<number> {
  const earn = await tx.loyaltyTransaction.findUnique({
    where: { orderId_type: { orderId, type: LoyaltyType.EARN } },
  });
  if (!earn) return 0;
  const reversed = await tx.loyaltyTransaction.findUnique({
    where: { orderId_type: { orderId, type: LoyaltyType.REVERSAL } },
  });
  if (reversed) return 0;
  await tx.loyaltyTransaction.create({
    data: { userId: earn.userId, orderId, type: LoyaltyType.REVERSAL, points: earn.points },
  });
  await tx.$executeRaw`UPDATE users SET points = GREATEST(points - ${earn.points}, 0) WHERE id = ${earn.userId}`;
  return earn.points;
}

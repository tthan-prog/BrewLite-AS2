import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rewardCode } from './reward-code';

export interface RedeemResult {
  redemptionId: number;
  rewardId: number;
  rewardName: string;
  pointsSpent: number;
  code: string;
  pointsLeft: number;
}

/** Đổi điểm lấy quà (FR-19). */
@Injectable()
export class RewardsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.reward.findMany({
      where: { active: true },
      orderBy: [{ pointsCost: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, pointsCost: true },
    });
  }

  async myRedemptions(userId: number) {
    const rows = await this.prisma.rewardRedemption.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { reward: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      rewardId: r.rewardId,
      rewardName: r.reward.name,
      pointsSpent: r.pointsSpent,
      code: r.code,
    }));
  }

  /**
   * Trừ điểm bằng cập nhật có điều kiện "points >= giá quà" trong transaction:
   * nhiều lần đổi cùng lúc không làm điểm âm. Ghi LoyaltyTransaction REDEEM.
   */
  async redeem(userId: number, rewardId: number): Promise<RedeemResult> {
    const reward = await this.prisma.reward.findUnique({ where: { id: rewardId } });
    if (!reward || !reward.active) throw new NotFoundException('Không tìm thấy phần thưởng');

    return this.prisma.$transaction(async (tx) => {
      const spent = await tx.$executeRaw`
        UPDATE users SET points = points - ${reward.pointsCost}
        WHERE id = ${userId} AND points >= ${reward.pointsCost}`;
      if (spent === 0) throw new BadRequestException('Không đủ điểm để đổi phần thưởng này');

      await tx.loyaltyTransaction.create({
        data: { userId, orderId: null, type: LoyaltyType.REDEEM, points: reward.pointsCost },
      });
      const redemption = await this.createRedemption(tx, userId, reward.id, reward.pointsCost);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
      return {
        redemptionId: redemption.id,
        rewardId: reward.id,
        rewardName: reward.name,
        pointsSpent: reward.pointsCost,
        code: redemption.code,
        pointsLeft: user.points,
      };
    });
  }

  /** Mã quà là unique; trùng (rất hiếm) thì sinh lại. */
  private async createRedemption(tx: Prisma.TransactionClient, userId: number, rewardId: number, pointsSpent: number) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = rewardCode();
      const exists = await tx.rewardRedemption.findUnique({ where: { code } });
      if (!exists) {
        return tx.rewardRedemption.create({ data: { userId, rewardId, pointsSpent, code } });
      }
    }
    throw new Error('Không sinh được mã quà duy nhất');
  }
}

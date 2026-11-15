import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { stockFlag, StockFlag } from './ingredient-status';

export interface IngredientView {
  id: number;
  name: string;
  unit: string;
  stock: number;
  lowThreshold: number;
  flag: StockFlag;
}

const toView = (i: { id: number; name: string; unit: string; stock: number; lowThreshold: number }): IngredientView => ({
  id: i.id,
  name: i.name,
  unit: i.unit,
  stock: i.stock,
  lowThreshold: i.lowThreshold,
  flag: stockFlag(i.stock, i.lowThreshold),
});

/** Nhân viên xem tồn kho và nhập thêm nguyên liệu (FR-17). */
@Injectable()
export class IngredientsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<IngredientView[]> {
    const items = await this.prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
    return items.map(toView);
  }

  /** Cộng dồn bằng increment trong database, không ghi đè khi đang có thanh toán trừ kho cùng lúc. */
  async restock(id: number, quantity: number): Promise<IngredientView> {
    try {
      const updated = await this.prisma.ingredient.update({
        where: { id },
        data: { stock: { increment: quantity } },
      });
      return toView(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Không tìm thấy nguyên liệu');
      }
      throw e;
    }
  }
}

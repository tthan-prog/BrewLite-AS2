import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cartAvailability } from '../inventory/availability';
import { NeedLine } from '../inventory/order-needs';
import { OrderItemDto } from '../orders/dto/create-order.dto';
import {
  maxCups,
  MAX_QUANTITY_PER_LINE,
  SIZE_SURCHARGE,
  SUGAR_ICE_LEVELS,
  CupSize,
} from '../inventory/recipe-calculator';

/** Một món trong danh sách menu (FR-01). Không trả số tồn kho thật (FR-16). */
export interface ProductSummary {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  available: boolean;
  maxQuantity: number;
}

export interface ToppingOption {
  id: number;
  name: string;
  price: number;
  available: boolean;
}

/** Chi tiết món kèm tùy chọn size, topping, mức đường, đá (FR-03). */
export interface ProductDetail extends ProductSummary {
  sizes: Array<{ size: CupSize; surcharge: number }>;
  toppings: ToppingOption[];
  sugarLevels: number[];
  iceLevels: number[];
}

const recipeInclude = { recipe: { include: { ingredient: true } } } as const;

/** Kết quả kiểm tra một dòng giỏ hàng: chỉ trả số ly, không trả tồn kho (FR-16). */
export interface LineAvailabilityView {
  productId: number;
  requested: number;
  maxQuantity: number;
  ok: boolean;
  message: string | null;
}

@Injectable()
export class ProductsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProductSummary[]> {
    const products = await this.prisma.product.findMany({
      include: recipeInclude,
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
    return products.map((p) => this.toSummary(p));
  }

  async findOne(id: number): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: recipeInclude,
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const toppings = await this.prisma.topping.findMany({
      include: recipeInclude,
      orderBy: { id: 'asc' },
    });

    return {
      ...this.toSummary(product),
      sizes: (['S', 'M', 'L'] as CupSize[]).map((size) => ({ size, surcharge: SIZE_SURCHARGE[size] })),
      toppings: toppings.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        // Topping không có công thức coi như luôn còn
        available: t.recipe.length === 0 || maxCups(t.recipe) > 0,
      })),
      sugarLevels: [...SUGAR_ICE_LEVELS],
      iceLevels: [...SUGAR_ICE_LEVELS],
    };
  }

  /**
   * POST /products/availability: số ly tối đa từng dòng theo size, đường, đá, topping và các dòng khác trong giỏ.
   * Giới hạn ở MAX_QUANTITY_PER_LINE nên không lộ tồn kho thật.
   */
  async availability(items: OrderItemDto[]): Promise<{ ok: boolean; lines: LineAvailabilityView[] }> {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const toppingIds = [...new Set(items.flatMap((i) => i.toppingIds ?? []))];
    const [products, toppings] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, include: recipeInclude }),
      this.prisma.topping.findMany({ where: { id: { in: toppingIds } }, include: recipeInclude }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const toppingMap = new Map(toppings.map((t) => [t.id, t]));
    for (const id of productIds) if (!productMap.has(id)) throw new BadRequestException(`Sản phẩm #${id} không tồn tại`);
    for (const id of toppingIds) if (!toppingMap.has(id)) throw new BadRequestException(`Topping #${id} không tồn tại`);

    const stock = new Map<number, number>();
    for (const r of [...products.flatMap((p) => p.recipe), ...toppings.flatMap((t) => t.recipe)]) {
      stock.set(r.ingredient.id, r.ingredient.stock);
    }
    const lines: NeedLine[] = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      options: { size: item.size ?? 'S', sugar: item.sugar ?? 100, ice: item.ice ?? 100 },
      recipe: productMap.get(item.productId)!.recipe,
      toppingRecipes: (item.toppingIds ?? []).map((id) => toppingMap.get(id)!.recipe),
    }));

    const result = cartAvailability(lines, stock).map((r, i): LineAvailabilityView => {
      const item = items[i];
      const name = productMap.get(item.productId)!.name;
      let message: string | null = null;
      if (!r.ok) {
        message =
          r.maxQuantity === 0
            ? `"${name}" với lựa chọn này tạm hết nguyên liệu`
            : `"${name}" với lựa chọn này chỉ còn làm được tối đa ${r.maxQuantity} ly`;
      }
      return { productId: item.productId, requested: item.quantity, maxQuantity: r.maxQuantity, ok: r.ok, message };
    });
    return { ok: result.every((r) => r.ok), lines: result };
  }

  private toSummary(product: {
    id: number;
    name: string;
    description: string;
    basePrice: number;
    category: string;
    imageUrl: string;
    recipe: Parameters<typeof maxCups>[0];
  }): ProductSummary {
    const cups = Math.min(maxCups(product.recipe), MAX_QUANTITY_PER_LINE);
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.basePrice,
      category: product.category,
      imageUrl: product.imageUrl,
      available: cups > 0,
      maxQuantity: cups,
    };
  }
}

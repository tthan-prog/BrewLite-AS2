import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { stockFlag, StockFlag } from './ingredient-status';
import { cupsBySize, cupsFromStock, limitingIngredient, perCupNeeds } from '../inventory/availability';
import { CupSize, ingredientNeed } from '../inventory/recipe-calculator';

const SIZES: CupSize[] = ['S', 'M', 'L'];

export interface RecipeIngredientView {
  id: number;
  name: string;
  unit: string;
  stock: number;
  flag: StockFlag;
  /** Lượng cho 1 ly từng size, với 100% đường và đá. */
  perCup: Record<CupSize, number>;
  sugarScaled: boolean;
  iceScaled: boolean;
}

export interface ProductRecipeView {
  id: number;
  name: string;
  category: string;
  imageUrl: string;
  basePrice: number;
  ingredients: RecipeIngredientView[];
  /** Số ly làm được với tồn kho hiện tại (100% đường, đá; không topping). */
  cups: Record<CupSize, number>;
  /** Tên nguyên liệu giới hạn số ly của từng size; null nếu chưa có công thức. */
  limiting: Record<CupSize, string | null>;
}

export interface ToppingRecipeView {
  id: number;
  name: string;
  price: number;
  ingredients: Array<Omit<RecipeIngredientView, 'perCup' | 'sugarScaled' | 'iceScaled'> & { perServing: number }>;
  /** Số phần topping làm được; null nếu topping không dùng nguyên liệu nào. */
  servings: number | null;
  limiting: string | null;
}

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

const brief = (i: { id: number; name: string; unit: string; stock: number; lowThreshold: number }) => ({
  id: i.id,
  name: i.name,
  unit: i.unit,
  stock: i.stock,
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

  /**
   * GET /ingredients/recipes: công thức từng món theo size và số ly làm được với tồn kho hiện tại (STAFF).
   * Nhân viên được xem tồn kho thật nên số ly không giới hạn ở 50 như phía khách.
   */
  async recipes(): Promise<{ products: ProductRecipeView[]; toppings: ToppingRecipeView[] }> {
    const [products, toppings, ingredients] = await Promise.all([
      this.prisma.product.findMany({ include: { recipe: { include: { ingredient: true } } }, orderBy: [{ category: 'asc' }, { id: 'asc' }] }),
      this.prisma.topping.findMany({ include: { recipe: { include: { ingredient: true } } }, orderBy: { id: 'asc' } }),
      this.prisma.ingredient.findMany(),
    ]);
    const stock = new Map(ingredients.map((i) => [i.id, i.stock]));
    const nameOf = new Map(ingredients.map((i) => [i.id, i.name]));

    const productViews = products.map((p): ProductRecipeView => {
      const limiting = {} as Record<CupSize, string | null>;
      for (const size of SIZES) {
        const id = limitingIngredient(
          perCupNeeds({ productId: p.id, options: { size, sugar: 100, ice: 100 }, recipe: p.recipe, toppingRecipes: [] }),
          stock,
        );
        limiting[size] = id === null ? null : (nameOf.get(id) ?? null);
      }
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        imageUrl: p.imageUrl,
        basePrice: p.basePrice,
        ingredients: p.recipe.map((r) => ({
          ...brief(r.ingredient),
          perCup: Object.fromEntries(SIZES.map((size) => [size, ingredientNeed(r, { size, sugar: 100, ice: 100 })])) as Record<CupSize, number>,
          sugarScaled: r.ingredient.sugarScaled,
          iceScaled: r.ingredient.iceScaled,
        })),
        cups: cupsBySize(p.recipe, stock),
        limiting,
      };
    });

    const toppingViews = toppings.map((t): ToppingRecipeView => {
      const need = new Map(t.recipe.map((r) => [r.ingredient.id, r.quantity]));
      const servings = cupsFromStock(need, stock);
      const limitingId = limitingIngredient(need, stock);
      return {
        id: t.id,
        name: t.name,
        price: t.price,
        ingredients: t.recipe.map((r) => ({ ...brief(r.ingredient), perServing: r.quantity })),
        servings: Number.isFinite(servings) ? servings : null,
        limiting: limitingId === null ? null : (nameOf.get(limitingId) ?? null),
      };
    });
    return { products: productViews, toppings: toppingViews };
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

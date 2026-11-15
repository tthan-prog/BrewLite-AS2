import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { NeedLine, orderNeeds, productsAffected, shortages } from '../inventory/order-needs';
import { CupSize } from '../inventory/recipe-calculator';
import { restoreStock } from '../inventory/stock';
import { reversePoints } from '../loyalty/loyalty';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { canTransition, StaffTargetStatus } from './order-status';
import { discountAmount, promotionError, unitPrice } from './pricing';

export const orderDetailInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { name: true } },
      toppings: { include: { topping: { select: { name: true } } } },
    },
  },
  promotion: { select: { code: true } },
  payments: {
    orderBy: { id: 'desc' },
    take: 1,
    select: { id: true, method: true, status: true, amount: true, createdAt: true },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  createdAt: Date;
}

export function toOrderDetail(order: OrderWithDetail) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    promotionCode: order.promotion?.code ?? null,
    failureReason: order.failureReason,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      quantity: item.quantity,
      size: item.size,
      sugar: item.sugar,
      ice: item.ice,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
      toppings: item.toppings.map((t) => ({ id: t.toppingId, name: t.topping.name, price: t.price })),
    })),
    lastPayment: order.payments[0] ?? null,
  };
}

export type OrderDetail = ReturnType<typeof toOrderDetail>;

const withRecipe = { recipe: { include: { ingredient: true } } } as const;

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Tạo đơn PENDING từ giỏ hàng (FR-07). Giá và giảm giá do máy chủ tính.
   * Kiểm tra đủ nguyên liệu cho cả đơn nhưng chưa trừ kho: kho chỉ bị trừ khi thanh toán (FR-12).
   */
  async create(user: AuthUser, dto: CreateOrderDto): Promise<OrderDetail> {
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const toppingIds = [...new Set(dto.items.flatMap((i) => i.toppingIds ?? []))];
    const [products, toppings] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, include: withRecipe }),
      this.prisma.topping.findMany({ where: { id: { in: toppingIds } }, include: withRecipe }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const toppingMap = new Map(toppings.map((t) => [t.id, t]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new BadRequestException(`Sản phẩm #${id} không tồn tại`);
    }
    for (const id of toppingIds) {
      if (!toppingMap.has(id)) throw new BadRequestException(`Topping #${id} không tồn tại`);
    }

    const lines = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const lineToppings = (item.toppingIds ?? []).map((id) => toppingMap.get(id)!);
      const size: CupSize = item.size ?? 'S';
      const options = { size, sugar: item.sugar ?? 100, ice: item.ice ?? 100 };
      return {
        item,
        product,
        toppings: lineToppings,
        options,
        price: unitPrice(product.basePrice, size, lineToppings.map((t) => t.price)),
      };
    });

    // --- Kiểm tra nguyên liệu cho cả đơn ---
    const needLines: NeedLine[] = lines.map((l) => ({
      productId: l.product.id,
      quantity: l.item.quantity,
      options: l.options,
      recipe: l.product.recipe,
      toppingRecipes: l.toppings.map((t) => t.recipe),
    }));
    const empty = lines.find((l) => l.product.recipe.length === 0);
    if (empty) throw new BadRequestException(`Món "${empty.product.name}" hiện chưa bán`);
    const stock = new Map<number, number>();
    for (const r of [...products.flatMap((p) => p.recipe), ...toppings.flatMap((t) => t.recipe)]) {
      stock.set(r.ingredient.id, r.ingredient.stock);
    }
    const needs = orderNeeds(needLines);
    const missing = shortages(needs, stock);
    if (missing.size > 0) {
      const affected = productsAffected(needLines, missing).map((id) => ({
        productId: id,
        name: productMap.get(id)!.name,
      }));
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Không đủ nguyên liệu cho: ${affected.map((a) => a.name).join(', ')}`,
        missingProducts: affected,
      });
    }

    // --- Giá và khuyến mãi (FR-13) ---
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.item.quantity, 0);
    let promotionId: number | null = null;
    let discount = 0;
    if (dto.promotionCode) {
      const promo = await this.prisma.promotion.findUnique({ where: { code: dto.promotionCode } });
      const error = promotionError(promo, subtotal, new Date());
      if (error || !promo) throw new BadRequestException(error ?? 'Mã khuyến mãi không tồn tại');
      promotionId = promo.id;
      discount = discountAmount(promo, subtotal);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      if (promotionId !== null) {
        // Tăng lượt dùng có điều kiện: hai đơn cùng lúc không vượt usageLimit
        const used = await tx.$executeRaw`
          UPDATE promotions SET used_count = used_count + 1
          WHERE id = ${promotionId} AND (usage_limit IS NULL OR used_count < usage_limit)`;
        if (used === 0) throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
      }
      return tx.order.create({
        data: {
          userId: user.id,
          promotionId,
          status: OrderStatus.PENDING,
          subtotal,
          discount,
          total: subtotal - discount,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              quantity: l.item.quantity,
              size: l.options.size,
              sugar: l.options.sugar,
              ice: l.options.ice,
              unitPrice: l.price,
              toppings: {
                create: l.toppings.map((t) => ({ toppingId: t.id, quantity: 1, price: t.price })),
              },
            })),
          },
          ingredientUses: {
            create: [...needs].map(([ingredientId, quantity]) => ({ ingredientId, quantity })),
          },
        },
        include: orderDetailInclude,
      });
    });
    return toOrderDetail(order);
  }

  /** Lịch sử đơn của người đang đăng nhập, mới nhất trước (FR-11). */
  async findMine(userId: number): Promise<OrderSummary[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { items: { select: { quantity: true } } },
    });
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      createdAt: o.createdAt,
    }));
  }

  /** Chi tiết đơn: chủ đơn hoặc STAFF xem được; người khác nhận 404 (không lộ đơn tồn tại). */
  async findOne(id: number, user: AuthUser): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
    if (!order || (user.role !== Role.STAFF && order.userId !== user.id)) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    return toOrderDetail(order);
  }

  /** Danh sách đơn cho nhân viên, lọc theo trạng thái (FR-15). */
  async listForStaff(status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
      include: { ...orderDetailInclude, user: { select: { name: true } } },
    });
    return orders.map((o) => ({ ...toOrderDetail(o), customerName: o.user.name }));
  }

  /**
   * Nhân viên chuyển trạng thái đơn theo máy trạng thái (FR-10, FR-15).
   * Hủy đơn đã PAID: hoàn đúng phần nguyên liệu đã trừ và trừ lại điểm (FR-12, FR-14).
   * Hủy đơn chưa thanh toán: trả lại lượt dùng mã khuyến mãi.
   */
  async updateStatus(id: number, to: StaffTargetStatus): Promise<OrderDetail> {
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id }, include: { ingredientUses: true } });
      if (!current) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (!canTransition(current.status, to)) {
        throw new BadRequestException(`Không thể chuyển đơn từ ${current.status} sang ${to}`);
      }
      // Cập nhật có điều kiện theo trạng thái vừa đọc: nếu thao tác khác đã đổi trước thì báo 409
      const moved = await tx.order.updateMany({ where: { id, status: current.status }, data: { status: to } });
      if (moved.count === 0) {
        throw new ConflictException('Đơn vừa được cập nhật bởi thao tác khác, vui lòng tải lại');
      }
      if (to === OrderStatus.CANCELLED) {
        if (current.status === OrderStatus.PAID) {
          const consumed = current.ingredientUses.filter((u) => u.consumed);
          await restoreStock(tx, consumed);
          await tx.orderIngredientUse.updateMany({ where: { orderId: id, consumed: true }, data: { consumed: false } });
          await reversePoints(tx, id);
        } else if (current.promotionId !== null) {
          await tx.$executeRaw`
            UPDATE promotions SET used_count = GREATEST(used_count - 1, 0) WHERE id = ${current.promotionId}`;
        }
      }
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderDetailInclude });
    });
    return toOrderDetail(order);
  }
}

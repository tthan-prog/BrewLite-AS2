import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import type { PrismaService } from '../prisma/prisma.service';

const ing = (id: number, stock: number) => ({ id, stock, sugarScaled: false, iceScaled: false });

const caPheSua = {
  id: 1,
  name: 'Cà phê sữa đá',
  description: 'Cà phê đậm vị',
  basePrice: 29000,
  category: 'Cà phê',
  imageUrl: '',
  recipe: [
    { quantity: 18, ingredient: ing(1, 90) },
    { quantity: 30, ingredient: ing(2, 6000) },
  ],
};
const hetHang = {
  ...caPheSua,
  id: 2,
  name: 'Matcha latte',
  recipe: [{ quantity: 6, ingredient: ing(3, 2) }],
};

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const prisma = {
    product: {
      findMany: vi.fn().mockResolvedValue([caPheSua, hetHang]),
      findUnique: vi.fn().mockResolvedValue(caPheSua),
    },
    topping: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, name: 'Trân châu', price: 7000, recipe: [{ quantity: 40, ingredient: ing(4, 400) }] },
        { id: 2, name: 'Kem cheese', price: 10000, recipe: [{ quantity: 35, ingredient: ing(5, 10) }] },
      ]),
    },
    ...overrides,
  };
  return { service: new ProductsService(prisma as unknown as PrismaService), prisma };
}

describe('ProductsService', () => {
  it('findAll trả giá, tình trạng còn hàng và số ly tối đa, không lộ tồn kho', async () => {
    const { service } = makeService();
    const result = await service.findAll();

    expect(result).toEqual([
      expect.objectContaining({ id: 1, price: 29000, available: true, maxQuantity: 5 }),
      expect.objectContaining({ id: 2, available: false, maxQuantity: 0 }),
    ]);
    expect(result[0]).not.toHaveProperty('recipe');
    expect(result[0]).not.toHaveProperty('stock');
  });

  it('findOne trả size kèm phụ phí, topping kèm tình trạng, mức đường và đá', async () => {
    const { service } = makeService();
    const detail = await service.findOne(1);

    expect(detail.sizes).toEqual([
      { size: 'S', surcharge: 0 },
      { size: 'M', surcharge: 5000 },
      { size: 'L', surcharge: 10000 },
    ]);
    expect(detail.toppings).toEqual([
      { id: 1, name: 'Trân châu', price: 7000, available: true },
      { id: 2, name: 'Kem cheese', price: 10000, available: false },
    ]);
    expect(detail.sugarLevels).toEqual([0, 30, 50, 70, 100]);
    expect(detail.iceLevels).toEqual([0, 30, 50, 70, 100]);
  });

  it('findOne báo 404 khi không có sản phẩm', async () => {
    const { service } = makeService({
      product: { findMany: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

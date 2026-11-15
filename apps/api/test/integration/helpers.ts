import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, PromotionType, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

export const PASSWORD = 'Matkhau@123';

/** Khởi động toàn bộ API với database thật (DATABASE_URL). */
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaClient }> {
  if (!process.env.DATABASE_URL) throw new Error('Cần DATABASE_URL trỏ tới database test đã migrate');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: moduleRef.get(PrismaService) };
}

/** Xóa sạch dữ liệu và đánh lại id từ 1. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * Dữ liệu tối thiểu, đặt số tồn kho nhỏ để dễ kiểm tra:
 *  - Cà phê sữa (29.000đ): cà phê 20 + sữa 30 + siro 10 (theo đường) cho size S.
 *  - Topping trân châu (7.000đ): trân châu 40.
 */
export async function seedFixture(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const customer = await prisma.user.create({
    data: { email: 'khach1@test.vn', name: 'Khách Một', passwordHash, role: Role.CUSTOMER },
  });
  const other = await prisma.user.create({
    data: { email: 'khach2@test.vn', name: 'Khách Hai', passwordHash, role: Role.CUSTOMER },
  });
  const staff = await prisma.user.create({
    data: { email: 'nhanvien@test.vn', name: 'Nhân Viên', passwordHash, role: Role.STAFF },
  });
  const coffee = await prisma.ingredient.create({ data: { name: 'Cà phê', unit: 'g', stock: 1000 } });
  const milk = await prisma.ingredient.create({ data: { name: 'Sữa', unit: 'ml', stock: 5000 } });
  const syrup = await prisma.ingredient.create({ data: { name: 'Siro', unit: 'ml', stock: 5000, sugarScaled: true } });
  const pearl = await prisma.ingredient.create({ data: { name: 'Trân châu', unit: 'g', stock: 1000 } });
  const product = await prisma.product.create({
    data: {
      name: 'Cà phê sữa',
      basePrice: 29000,
      category: 'Cà phê',
      recipe: {
        create: [
          { ingredientId: coffee.id, quantity: 20 },
          { ingredientId: milk.id, quantity: 30 },
          { ingredientId: syrup.id, quantity: 10 },
        ],
      },
    },
  });
  const topping = await prisma.topping.create({
    data: { name: 'Trân châu', price: 7000, recipe: { create: [{ ingredientId: pearl.id, quantity: 40 }] } },
  });
  await prisma.promotion.createMany({
    data: [
      { code: 'GIAM10', type: PromotionType.PERCENT, value: 10, minOrder: 50000, expiresAt: new Date('2099-01-01'), usageLimit: 100 },
      { code: 'MOTLAN', type: PromotionType.FIXED, value: 5000, minOrder: 0, usageLimit: 1 },
      { code: 'HETHAN', type: PromotionType.PERCENT, value: 15, minOrder: 0, expiresAt: new Date('2020-01-01') },
    ],
  });
  return { customer, other, staff, coffee, milk, syrup, pearl, product, topping };
}

export async function login(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken as string;
}

let keyCounter = 0;
/** Idempotency-Key mới cho mỗi lần thử thanh toán. */
export function newKey(): string {
  keyCounter += 1;
  return `test-key-${Date.now()}-${keyCounter}`;
}

import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { EXPIRED_REASON, OrderExpiryService } from '../../src/orders/order-expiry.service';
import { createTestApp, login, resetDatabase, seedFixture } from './helpers';

/** US-15 (kho nguyên liệu), US-17 (đổi quà), US-18 (tự hủy đơn quá hạn). */
describe('Kho nguyên liệu, đổi quà, tự hủy đơn (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  let customerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    fx = await seedFixture(prisma);
    [customerToken, staffToken] = await Promise.all([login(app, 'khach1@test.vn'), login(app, 'nhanvien@test.vn')]);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('FR-17 kho nguyên liệu', () => {
    it('STAFF xem tồn kho kèm cờ OUT, LOW, OK; CUSTOMER 403; chưa đăng nhập 401', async () => {
      await prisma.ingredient.update({ where: { id: fx.coffee.id }, data: { stock: 0 } });
      await prisma.ingredient.update({ where: { id: fx.milk.id }, data: { stock: 100, lowThreshold: 200 } });
      const res = await request(server()).get('/ingredients').set(auth(staffToken)).expect(200);
      const byName = Object.fromEntries(res.body.map((i: { name: string; flag: string }) => [i.name, i.flag]));
      expect(byName).toEqual({ 'Cà phê': 'OUT', Sữa: 'LOW', Siro: 'OK', 'Trân châu': 'OK' });
      expect(res.body[0]).toEqual({ id: fx.coffee.id, name: 'Cà phê', unit: 'g', stock: 0, lowThreshold: 0, flag: 'OUT' });

      await request(server()).get('/ingredients').set(auth(customerToken)).expect(403);
      await request(server()).get('/ingredients').expect(401);
    });

    it('nhập thêm cộng dồn đúng; số lượng không dương trả 400; nguyên liệu không tồn tại trả 404', async () => {
      const res = await request(server())
        .patch(`/ingredients/${fx.coffee.id}/restock`)
        .set(auth(staffToken))
        .send({ quantity: 500 })
        .expect(200);
      expect(res.body).toMatchObject({ stock: 1500, flag: 'OK' });

      await request(server()).patch(`/ingredients/${fx.coffee.id}/restock`).set(auth(staffToken)).send({ quantity: 0 }).expect(400);
      await request(server()).patch(`/ingredients/${fx.coffee.id}/restock`).set(auth(staffToken)).send({ quantity: -5 }).expect(400);
      await request(server()).patch('/ingredients/9999/restock').set(auth(staffToken)).send({ quantity: 10 }).expect(404);
      await request(server()).patch(`/ingredients/${fx.coffee.id}/restock`).set(auth(customerToken)).send({ quantity: 10 }).expect(403);
      expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: fx.coffee.id } })).stock).toBe(1500);
    });

    it('sau khi nhập thêm, món hết hàng bán lại được', async () => {
      await prisma.ingredient.update({ where: { id: fx.coffee.id }, data: { stock: 0 } });
      let menu = await request(server()).get('/products').expect(200);
      expect(menu.body[0]).toMatchObject({ available: false, maxQuantity: 0 });
      await request(server()).patch(`/ingredients/${fx.coffee.id}/restock`).set(auth(staffToken)).send({ quantity: 200 }).expect(200);
      menu = await request(server()).get('/products').expect(200);
      expect(menu.body[0]).toMatchObject({ available: true, maxQuantity: 10 });
    });
  });

  describe('FR-19 đổi quà', () => {
    let small: number;
    let big: number;

    beforeEach(async () => {
      small = (await prisma.reward.create({ data: { name: 'Giảm 10.000đ', pointsCost: 50 } })).id;
      big = (await prisma.reward.create({ data: { name: 'Ly miễn phí', pointsCost: 150 } })).id;
      await prisma.reward.create({ data: { name: 'Quà đã ngừng', pointsCost: 1, active: false } });
      await prisma.user.update({ where: { id: fx.customer.id }, data: { points: 100 } });
    });

    it('GET /rewards chỉ trả quà đang mở, xếp theo điểm', async () => {
      const res = await request(server()).get('/rewards').expect(200);
      expect(res.body).toEqual([
        { id: small, name: 'Giảm 10.000đ', pointsCost: 50 },
        { id: big, name: 'Ly miễn phí', pointsCost: 150 },
      ]);
    });

    it('đủ điểm: trừ điểm, trả mã quà, ghi giao dịch REDEEM; không đủ điểm: 400, điểm giữ nguyên', async () => {
      const ok = await request(server()).post(`/rewards/${small}/redeem`).set(auth(customerToken)).expect(201);
      expect(ok.body).toMatchObject({ rewardId: small, rewardName: 'Giảm 10.000đ', pointsSpent: 50, pointsLeft: 50 });
      expect(ok.body.code).toMatch(/^BL-[A-Z2-9]{8}$/);
      expect(await prisma.loyaltyTransaction.findMany({ select: { type: true, points: true, orderId: true } })).toEqual([
        { type: 'REDEEM', points: 50, orderId: null },
      ]);

      const fail = await request(server()).post(`/rewards/${big}/redeem`).set(auth(customerToken)).expect(400);
      expect(fail.body.message).toBe('Không đủ điểm để đổi phần thưởng này');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(50);

      const mine = await request(server()).get('/rewards/me').set(auth(customerToken)).expect(200);
      expect(mine.body).toEqual([{ id: expect.any(Number), rewardId: small, rewardName: 'Giảm 10.000đ', pointsSpent: 50, code: ok.body.code }]);
    });

    it('quà ngừng hoặc không tồn tại trả 404; chưa đăng nhập trả 401', async () => {
      const inactive = await prisma.reward.findFirstOrThrow({ where: { active: false } });
      await request(server()).post(`/rewards/${inactive.id}/redeem`).set(auth(customerToken)).expect(404);
      await request(server()).post('/rewards/9999/redeem').set(auth(customerToken)).expect(404);
      await request(server()).post(`/rewards/${small}/redeem`).expect(401);
    });

    it('đổi đồng thời không làm âm điểm: 100 điểm, 5 yêu cầu 50 điểm → đúng 2 thành công', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => request(server()).post(`/rewards/${small}/redeem`).set(auth(customerToken))),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(results.filter((r) => r.status === 400)).toHaveLength(3);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(0);
      expect(await prisma.rewardRedemption.count()).toBe(2);
    });
  });

  describe('FR-20 tự hủy đơn quá hạn', () => {
    it('hủy đơn PENDING quá 15 phút, trả lượt mã khuyến mãi, không đụng đơn mới hoặc đơn đã thanh toán, không đụng kho', async () => {
      const make = async (body: Record<string, unknown>) =>
        (await request(server()).post('/orders').set(auth(customerToken)).send(body).expect(201)).body.id as number;
      const item = { productId: fx.product.id, quantity: 1 };
      const old = await make({ items: [item], promotionCode: 'MOTLAN' });
      const fresh = await make({ items: [item] });
      const paid = await make({ items: [item] });
      await request(server())
        .post('/payments')
        .set(auth(customerToken))
        .set('Idempotency-Key', 'expiry-test-key-1')
        .send({ orderId: paid, method: 'WALLET' })
        .expect(201);

      const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000);
      await prisma.order.updateMany({ where: { id: { in: [old, paid] } }, data: { createdAt: twentyMinutesAgo } });
      const stockBefore = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
      expect((await prisma.promotion.findUniqueOrThrow({ where: { code: 'MOTLAN' } })).usedCount).toBe(1);

      const cancelled = await app.get(OrderExpiryService).cancelExpired();
      expect(cancelled).toEqual([old]);

      const orders = Object.fromEntries((await prisma.order.findMany()).map((o) => [o.id, o]));
      expect(orders[old]).toMatchObject({ status: 'CANCELLED', failureReason: EXPIRED_REASON });
      expect(orders[fresh].status).toBe('PENDING');
      expect(orders[paid].status).toBe('PAID');
      expect((await prisma.promotion.findUniqueOrThrow({ where: { code: 'MOTLAN' } })).usedCount).toBe(0);
      expect(await prisma.ingredient.findMany({ orderBy: { id: 'asc' } })).toEqual(stockBefore);

      // Đơn đã tự hủy không thanh toán được
      await request(server())
        .post('/payments')
        .set(auth(customerToken))
        .set('Idempotency-Key', 'expiry-test-key-2')
        .send({ orderId: old, method: 'WALLET' })
        .expect(400);
      // Chạy lại không hủy thêm gì
      expect(await app.get(OrderExpiryService).cancelExpired()).toEqual([]);
    });
  });
});

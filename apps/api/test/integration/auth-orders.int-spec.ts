import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp, login, PASSWORD, resetDatabase, seedFixture } from './helpers';

/** US-07, US-08, US-11, US-12, US-13: đăng ký, đăng nhập, đặt đơn, lịch sử, nhân viên đổi trạng thái. */
describe('Xác thực và đơn hàng với database thật (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  let customerToken: string;
  let otherToken: string;
  let staffToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    fx = await seedFixture(prisma);
    [customerToken, otherToken, staffToken] = await Promise.all([
      login(app, 'khach1@test.vn'),
      login(app, 'khach2@test.vn'),
      login(app, 'nhanvien@test.vn'),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('FR-05 đăng ký và đăng nhập', () => {
    it('đăng ký, mật khẩu được băm, đăng nhập nhận JWT, /auth/me trả đúng người', async () => {
      const reg = await request(server())
        .post('/auth/register')
        .send({ name: 'Bình', email: '  Binh@Test.VN ', password: PASSWORD })
        .expect(201);
      expect(reg.body).toEqual({ id: expect.any(Number), name: 'Bình', email: 'binh@test.vn', role: 'CUSTOMER', points: 0 });

      const row = await prisma.user.findUniqueOrThrow({ where: { email: 'binh@test.vn' } });
      expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(row.passwordHash).not.toContain(PASSWORD);

      const loginRes = await request(server()).post('/auth/login').send({ email: 'binh@test.vn', password: PASSWORD }).expect(200);
      expect(loginRes.body.accessToken).toEqual(expect.any(String));
      const me = await request(server()).get('/auth/me').set(auth(loginRes.body.accessToken)).expect(200);
      expect(me.body.email).toBe('binh@test.vn');
    });

    it('email trùng trả 409, sai mật khẩu trả 401', async () => {
      await request(server()).post('/auth/register').send({ name: 'X', email: 'khach1@test.vn', password: PASSWORD }).expect(409);
      await request(server()).post('/auth/login').send({ email: 'khach1@test.vn', password: 'SaiMatKhau1' }).expect(401);
    });
  });

  describe('FR-07, FR-13 tạo đơn', () => {
    it('tính giá ở máy chủ, áp mã giảm giá, chưa trừ kho', async () => {
      const res = await request(server())
        .post('/orders')
        .set(auth(customerToken))
        .send({
          items: [{ productId: fx.product.id, quantity: 2, size: 'M', sugar: 50, toppingIds: [fx.topping.id] }],
          promotionCode: 'giam10',
        })
        .expect(201);
      // (29.000 + 5.000 size M + 7.000 topping) × 2 = 82.000; giảm 10% = 8.200
      expect(res.body).toMatchObject({ status: 'PENDING', subtotal: 82000, discount: 8200, total: 73800, promotionCode: 'GIAM10' });
      expect(res.body.items[0]).toMatchObject({ name: 'Cà phê sữa', quantity: 2, size: 'M', sugar: 50, unitPrice: 41000, lineTotal: 82000 });
      expect(res.body.items[0].toppings).toEqual([{ id: fx.topping.id, name: 'Trân châu', price: 7000 }]);

      const uses = await prisma.orderIngredientUse.findMany({ where: { orderId: res.body.id }, orderBy: { ingredientId: 'asc' } });
      // cà phê ceil(20×1.25)=25 ×2; sữa ceil(37,5)=38 ×2; siro ceil(10×1.25×50%)=7 ×2; trân châu 40×2
      expect(uses.map((u) => [u.ingredientId, u.quantity, u.consumed])).toEqual([
        [fx.coffee.id, 50, false],
        [fx.milk.id, 76, false],
        [fx.syrup.id, 14, false],
        [fx.pearl.id, 80, false],
      ]);
      const coffee = await prisma.ingredient.findUniqueOrThrow({ where: { id: fx.coffee.id } });
      expect(coffee.stock).toBe(1000);
      const promo = await prisma.promotion.findUniqueOrThrow({ where: { code: 'GIAM10' } });
      expect(promo.usedCount).toBe(1);
    });

    it('mã hết hạn, chưa đủ đơn tối thiểu, hết lượt bị từ chối kèm lý do', async () => {
      const item = { productId: fx.product.id, quantity: 1 };
      let res = await request(server()).post('/orders').set(auth(customerToken)).send({ items: [item], promotionCode: 'HETHAN' }).expect(400);
      expect(res.body.message).toBe('Mã khuyến mãi đã hết hạn');
      res = await request(server()).post('/orders').set(auth(customerToken)).send({ items: [item], promotionCode: 'GIAM10' }).expect(400);
      expect(res.body.message).toMatch(/Đơn tối thiểu/);
      await request(server()).post('/orders').set(auth(customerToken)).send({ items: [item], promotionCode: 'MOTLAN' }).expect(201);
      res = await request(server()).post('/orders').set(auth(customerToken)).send({ items: [item], promotionCode: 'MOTLAN' }).expect(400);
      expect(res.body.message).toBe('Mã khuyến mãi đã hết lượt sử dụng');
      res = await request(server()).post('/orders').set(auth(customerToken)).send({ items: [item], promotionCode: 'KHONGCO' }).expect(400);
      expect(res.body.message).toBe('Mã khuyến mãi không tồn tại');
    });

    it('thiếu nguyên liệu trả 400, báo món thiếu và không tạo đơn', async () => {
      const before = await prisma.order.count();
      // 50 ly size L cần cà phê 30 × 50 = 1.500 > 1.000
      const res = await request(server())
        .post('/orders')
        .set(auth(customerToken))
        .send({ items: [{ productId: fx.product.id, quantity: 50, size: 'L' }] })
        .expect(400);
      expect(res.body.message).toBe('Không đủ nguyên liệu cho: Cà phê sữa');
      expect(res.body.missingProducts).toEqual([{ productId: fx.product.id, name: 'Cà phê sữa' }]);
      expect(await prisma.order.count()).toBe(before);
    });

    it('sản phẩm hoặc topping không tồn tại trả 400', async () => {
      await request(server()).post('/orders').set(auth(customerToken)).send({ items: [{ productId: 999, quantity: 1 }] }).expect(400);
      await request(server())
        .post('/orders')
        .set(auth(customerToken))
        .send({ items: [{ productId: fx.product.id, quantity: 1, toppingIds: [999] }] })
        .expect(400);
    });
  });

  describe('FR-11 lịch sử và chi tiết đơn', () => {
    it('GET /orders/me chỉ trả đơn của người đăng nhập, mới nhất trước', async () => {
      await request(server()).post('/orders').set(auth(otherToken)).send({ items: [{ productId: fx.product.id, quantity: 3 }] }).expect(201);
      const mine = await request(server()).get('/orders/me').set(auth(customerToken)).expect(200);
      const ownIds = (await prisma.order.findMany({ where: { userId: fx.customer.id } })).map((o) => o.id);
      expect(mine.body.map((o: { id: number }) => o.id).sort()).toEqual(ownIds.sort());
      expect(mine.body[0]).toEqual({
        id: expect.any(Number),
        status: 'PENDING',
        subtotal: expect.any(Number),
        discount: expect.any(Number),
        total: expect.any(Number),
        itemCount: expect.any(Number),
        createdAt: expect.any(String),
      });
      const ids = mine.body.map((o: { id: number }) => o.id);
      expect(ids).toEqual([...ids].sort((a: number, b: number) => b - a));
    });

    it('người khác xem đơn nhận 404, STAFF xem được', async () => {
      const order = await prisma.order.findFirstOrThrow({ where: { userId: fx.customer.id } });
      await request(server()).get(`/orders/${order.id}`).set(auth(otherToken)).expect(404);
      await request(server()).get(`/orders/${order.id}`).set(auth(customerToken)).expect(200);
      const staffView = await request(server()).get(`/orders/${order.id}`).set(auth(staffToken)).expect(200);
      expect(staffView.body.id).toBe(order.id);
      await request(server()).get('/orders/999999').set(auth(customerToken)).expect(404);
    });
  });

  describe('FR-10, FR-15 nhân viên đổi trạng thái', () => {
    it('STAFF lọc đơn theo trạng thái; CUSTOMER bị 403', async () => {
      const res = await request(server()).get('/orders?status=PENDING').set(auth(staffToken)).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((o: { status: string }) => o.status === 'PENDING')).toBe(true);
      expect(res.body[0].customerName).toEqual(expect.any(String));
      await request(server()).get('/orders').set(auth(customerToken)).expect(403);
    });

    it('chuyển sai trạng thái trả 400 và đơn giữ nguyên', async () => {
      const order = await prisma.order.findFirstOrThrow({ where: { status: 'PENDING' } });
      const res = await request(server())
        .patch(`/orders/${order.id}/status`)
        .set(auth(staffToken))
        .send({ status: 'PREPARING' })
        .expect(400);
      expect(res.body.message).toBe('Không thể chuyển đơn từ PENDING sang PREPARING');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    });

    it('hủy đơn chưa thanh toán trả lại lượt dùng mã khuyến mãi, không đụng kho', async () => {
      const order = await prisma.order.findFirstOrThrow({ where: { promotion: { code: 'MOTLAN' } } });
      const stockBefore = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
      await request(server()).patch(`/orders/${order.id}/status`).set(auth(staffToken)).send({ status: 'CANCELLED' }).expect(200);
      expect((await prisma.promotion.findUniqueOrThrow({ where: { code: 'MOTLAN' } })).usedCount).toBe(0);
      expect(await prisma.ingredient.findMany({ orderBy: { id: 'asc' } })).toEqual(stockBefore);
      // Đơn đã hủy không chuyển tiếp được
      await request(server()).patch(`/orders/${order.id}/status`).set(auth(staffToken)).send({ status: 'CANCELLED' }).expect(400);
    });
  });
});

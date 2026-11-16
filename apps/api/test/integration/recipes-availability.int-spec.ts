import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp, login, newKey, resetDatabase, seedFixture } from './helpers';

/**
 * FR-04, FR-16, FR-17: số ly làm được theo size, topping, giỏ hàng (khách) và bảng công thức (nhân viên).
 * Port các test số lượng của AS1 (realism, qr-ingredients) sang AS2.
 * Món mẫu "Cà phê sữa": 1 ly size S dùng cà phê 20g, sữa 30ml, siro 10ml (theo mức đường); M ×1,25, L ×1,5.
 * Topping trân châu: 40g mỗi phần.
 */
describe('Công thức và số ly làm được (integration)', () => {
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
  const setStock = (id: number, stock: number) => prisma.ingredient.update({ where: { id }, data: { stock } });
  const check = (items: object[]) => request(server()).post('/products/availability').send({ items });

  describe('Khách: POST /products/availability', () => {
    it('size lớn dùng nhiều nguyên liệu hơn: cà phê 60g → S 3 ly, M 2 ly, L 2 ly; size L không đủ dù size S còn đủ', async () => {
      await setStock(fx.coffee.id, 60);
      const res = await check([
        { productId: fx.product.id, quantity: 3, size: 'S' },
        { productId: fx.product.id, quantity: 3, size: 'L' },
      ]).expect(200);
      // Hai dòng tranh nhau cà phê: kiểm tra từng size riêng
      const s = await check([{ productId: fx.product.id, quantity: 3, size: 'S' }]).expect(200);
      const m = await check([{ productId: fx.product.id, quantity: 3, size: 'M' }]).expect(200);
      const l = await check([{ productId: fx.product.id, quantity: 3, size: 'L' }]).expect(200);
      expect(s.body).toEqual({ ok: true, lines: [{ productId: fx.product.id, requested: 3, maxQuantity: 3, ok: true, message: null }] });
      expect(m.body.lines[0]).toMatchObject({ maxQuantity: 2, ok: false, message: '"Cà phê sữa" với lựa chọn này chỉ còn làm được tối đa 2 ly' });
      expect(l.body.lines[0]).toMatchObject({ maxQuantity: 2, ok: false });
      expect(res.body.ok).toBe(false);
    });

    it('hai dòng cùng món tranh nhau nguyên liệu: kho đủ 5 ly, dòng 1 đặt 3 ly thì dòng 2 còn tối đa 2 ly', async () => {
      await setStock(fx.coffee.id, 100);
      const res = await check([
        { productId: fx.product.id, quantity: 3 },
        { productId: fx.product.id, quantity: 3, sugar: 0 },
      ]).expect(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.lines.map((l: { maxQuantity: number }) => l.maxQuantity)).toEqual([2, 2]);
      const fits = await check([
        { productId: fx.product.id, quantity: 3 },
        { productId: fx.product.id, quantity: 2, sugar: 0 },
      ]).expect(200);
      expect(fits.body.ok).toBe(true);
    });

    it('topping trừ nguyên liệu riêng: trân châu 80g chỉ đủ 2 ly có topping; hết trân châu thì ly có topping báo hết, ly không topping vẫn đặt được', async () => {
      await setStock(fx.pearl.id, 80);
      const withPearl = await check([{ productId: fx.product.id, quantity: 3, toppingIds: [fx.topping.id] }]).expect(200);
      expect(withPearl.body.lines[0]).toMatchObject({ maxQuantity: 2, ok: false });
      await setStock(fx.pearl.id, 0);
      const out = await check([{ productId: fx.product.id, quantity: 1, toppingIds: [fx.topping.id] }]).expect(200);
      expect(out.body.lines[0]).toMatchObject({ maxQuantity: 0, ok: false, message: '"Cà phê sữa" với lựa chọn này tạm hết nguyên liệu' });
      const plain = await check([{ productId: fx.product.id, quantity: 1 }]).expect(200);
      expect(plain.body.ok).toBe(true);
    });

    it('giới hạn 50 ly mỗi dòng dù nguyên liệu còn nhiều; không trả số tồn kho', async () => {
      const res = await check([{ productId: fx.product.id, quantity: 1 }]).expect(200);
      expect(res.body.lines[0].maxQuantity).toBe(50);
      expect(Object.keys(res.body.lines[0]).sort()).toEqual(["maxQuantity", "message", "ok", "productId", "requested"]);
      await check([{ productId: fx.product.id, quantity: 51 }]).expect(400);
    });

    it('dữ liệu sai: giỏ rỗng, số lượng 0, món hoặc topping không tồn tại, quá 5 topping → 400', async () => {
      await check([]).expect(400);
      await check([{ productId: fx.product.id, quantity: 0 }]).expect(400);
      await check([{ productId: 999999, quantity: 1 }]).expect(400);
      await check([{ productId: fx.product.id, quantity: 1, toppingIds: [999999] }]).expect(400);
      await check([{ productId: fx.product.id, quantity: 1, toppingIds: [1, 2, 3, 4, 5, 6] }]).expect(400);
    });

    it('khớp với lúc đặt đơn: availability báo không đủ thì POST /orders cũng từ chối; báo đủ thì đặt được', async () => {
      await setStock(fx.coffee.id, 60);
      const items = [{ productId: fx.product.id, quantity: 3, size: 'L' }];
      expect((await check(items).expect(200)).body.ok).toBe(false);
      await request(server()).post('/orders').set(auth(customerToken)).send({ items }).expect(400);
      const ok = [{ productId: fx.product.id, quantity: 2, size: 'L' }];
      expect((await check(ok).expect(200)).body.ok).toBe(true);
      await request(server()).post('/orders').set(auth(customerToken)).send({ items: ok }).expect(201);
    });
  });

  describe('Nhân viên: GET /ingredients/recipes', () => {
    it('chỉ STAFF xem được: CUSTOMER 403, chưa đăng nhập 401', async () => {
      await request(server()).get('/ingredients/recipes').expect(401);
      await request(server()).get('/ingredients/recipes').set(auth(customerToken)).expect(403);
      await request(server()).get('/ingredients/recipes').set(auth(staffToken)).expect(200);
    });

    it('công thức theo size (làm tròn lên), số ly S/M/L theo tồn kho thật, nguyên liệu giới hạn và số phần topping', async () => {
      await setStock(fx.coffee.id, 100);
      const res = await request(server()).get('/ingredients/recipes').set(auth(staffToken)).expect(200);
      const product = res.body.products.find((p: { id: number }) => p.id === fx.product.id);
      expect(product.cups).toEqual({ S: 5, M: 4, L: 3 });
      expect(product.limiting).toEqual({ S: 'Cà phê', M: 'Cà phê', L: 'Cà phê' });
      const coffee = product.ingredients.find((i: { id: number }) => i.id === fx.coffee.id);
      expect(coffee).toMatchObject({ name: 'Cà phê', unit: 'g', stock: 100, perCup: { S: 20, M: 25, L: 30 }, sugarScaled: false });
      const syrup = product.ingredients.find((i: { id: number }) => i.id === fx.syrup.id);
      expect(syrup).toMatchObject({ perCup: { S: 10, M: 13, L: 15 }, sugarScaled: true });
      const topping = res.body.toppings.find((t: { id: number }) => t.id === fx.topping.id);
      expect(topping).toMatchObject({ name: 'Trân châu', servings: 25, limiting: 'Trân châu' });
      expect(topping.ingredients[0]).toMatchObject({ perServing: 40, stock: 1000 });
    });

    it('số ly cập nhật theo kho: thanh toán thì giảm, nhập thêm nguyên liệu thì tăng ngay', async () => {
      await setStock(fx.coffee.id, 100);
      const cups = async () =>
        (await request(server()).get('/ingredients/recipes').set(auth(staffToken)).expect(200)).body.products.find(
          (p: { id: number }) => p.id === fx.product.id,
        ).cups;
      expect(await cups()).toEqual({ S: 5, M: 4, L: 3 });

      const order = await request(server())
        .post('/orders')
        .set(auth(customerToken))
        .send({ items: [{ productId: fx.product.id, quantity: 2 }] })
        .expect(201);
      // Đơn chưa thanh toán không giữ nguyên liệu
      expect(await cups()).toEqual({ S: 5, M: 4, L: 3 });
      await request(server())
        .post('/payments')
        .set(auth(customerToken))
        .set('Idempotency-Key', newKey())
        .send({ orderId: order.body.id, method: 'WALLET' })
        .expect(201);
      expect(await cups()).toEqual({ S: 3, M: 2, L: 2 }); // còn 60g

      await request(server()).patch(`/ingredients/${fx.coffee.id}/restock`).set(auth(staffToken)).send({ quantity: 240 }).expect(200);
      expect(await cups()).toEqual({ S: 15, M: 12, L: 10 }); // 300g
      expect((await check([{ productId: fx.product.id, quantity: 15 }]).expect(200)).body.ok).toBe(true);
    });
  });
});

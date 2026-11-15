import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { DECLINED_CARD, SUCCESS_CARD } from '../../src/payments/payment-gateway';
import { createTestApp, login, newKey, resetDatabase, seedFixture } from './helpers';

/** US-09, US-10, US-14: thanh toán, idempotency, trừ kho có điều kiện, điểm thưởng. */
describe('Thanh toán với database thật (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  let customerToken: string;
  let otherToken: string;
  let staffToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
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

  /** Đơn 2 ly size M, 50% đường, thêm trân châu, mã GIAM10: tổng 73.800đ. */
  async function createSampleOrder(token = customerToken): Promise<number> {
    const res = await request(server())
      .post('/orders')
      .set(auth(token))
      .send({
        items: [{ productId: fx.product.id, quantity: 2, size: 'M', sugar: 50, toppingIds: [fx.topping.id] }],
        promotionCode: 'GIAM10',
      })
      .expect(201);
    return res.body.id as number;
  }

  async function createSmallOrder(): Promise<number> {
    const res = await request(server())
      .post('/orders')
      .set(auth(customerToken))
      .send({ items: [{ productId: fx.product.id, quantity: 1 }] })
      .expect(201);
    return res.body.id as number;
  }

  function pay(orderId: number, key: string, body: Record<string, unknown> = { method: 'WALLET' }, token = customerToken) {
    return request(server()).post('/payments').set(auth(token)).set('Idempotency-Key', key).send({ orderId, ...body });
  }

  const stocks = async () =>
    Object.fromEntries((await prisma.ingredient.findMany()).map((i) => [i.name, i.stock])) as Record<string, number>;

  it('FR-08, FR-12, FR-14: thanh toán Ví thành công, trừ đúng kho, cộng điểm', async () => {
    const orderId = await createSampleOrder();
    const res = await pay(orderId, newKey()).expect(201);
    expect(res.headers['idempotent-replayed']).toBe('false');
    expect(res.body).toMatchObject({
      orderId,
      method: 'WALLET',
      amount: 73800,
      status: 'SUCCESS',
      orderStatus: 'PAID',
      failureReason: null,
      pointsEarned: 7,
    });
    expect(await stocks()).toEqual({ 'Cà phê': 950, Sữa: 4924, Siro: 4986, 'Trân châu': 920 });
    const uses = await prisma.orderIngredientUse.findMany({ where: { orderId } });
    expect(uses.every((u) => u.consumed)).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(7);
    expect(await prisma.loyaltyTransaction.findMany({ select: { type: true, points: true, orderId: true } })).toEqual([
      { type: 'EARN', points: 7, orderId },
    ]);
  });

  it('FR-09: gửi lại cùng Idempotency-Key trả cùng kết quả, chỉ một bản ghi Payment', async () => {
    const orderId = await createSampleOrder();
    const key = newKey();
    const first = await pay(orderId, key).expect(201);
    const second = await pay(orderId, key).expect(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.paymentId).toBe(first.body.paymentId);
    expect(second.body.status).toBe('SUCCESS');
    expect(await prisma.payment.count()).toBe(1);
    expect((await stocks())['Cà phê']).toBe(950);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(7);
  });

  it('FR-09: cùng khóa nhưng nội dung khác trả 409; đơn đã PAID không thanh toán lại', async () => {
    const orderId = await createSampleOrder();
    const key = newKey();
    await pay(orderId, key).expect(201);
    await pay(orderId, key, { method: 'CARD', cardNumber: SUCCESS_CARD }).expect(409);
    const again = await pay(orderId, newKey()).expect(409);
    expect(again.body.message).toBe('Đơn đã được thanh toán');
    expect(await prisma.payment.count()).toBe(1);
  });

  it('FR-08: thẻ bị từ chối → PAYMENT_FAILED, hoàn kho; thử lại bằng khóa mới thì PAID', async () => {
    const orderId = await createSampleOrder();
    const failed = await pay(orderId, newKey(), { method: 'CARD', cardNumber: DECLINED_CARD }).expect(201);
    expect(failed.body).toMatchObject({ status: 'FAILED', orderStatus: 'PAYMENT_FAILED', failureReason: 'Thẻ bị ngân hàng từ chối', pointsEarned: 0 });
    expect(await stocks()).toEqual({ 'Cà phê': 1000, Sữa: 5000, Siro: 5000, 'Trân châu': 1000 });
    expect((await prisma.orderIngredientUse.findMany({ where: { orderId } })).some((u) => u.consumed)).toBe(false);

    const ok = await pay(orderId, newKey(), { method: 'CARD', cardNumber: '4242 4242 4242 4242' }).expect(201);
    expect(ok.body).toMatchObject({ status: 'SUCCESS', orderStatus: 'PAID', failureReason: null });
    expect((await stocks())['Cà phê']).toBe(950);
    expect(await prisma.payment.count()).toBe(2);
  });

  it('không thanh toán được đơn của người khác (404) hoặc thiếu khóa (400)', async () => {
    const orderId = await createSampleOrder();
    await pay(orderId, newKey(), { method: 'WALLET' }, otherToken).expect(404);
    await request(server()).post('/payments').set(auth(customerToken)).send({ orderId, method: 'WALLET' }).expect(400);
    expect(await prisma.payment.count()).toBe(0);
  });

  it('FR-12: kho vừa hết lúc thanh toán → không trừ tiền, không trừ kho, PAYMENT_FAILED kèm lý do', async () => {
    const orderId = await createSampleOrder();
    // Kho cà phê bị dùng hết sau khi tạo đơn (đơn cần 50g)
    await prisma.ingredient.update({ where: { id: fx.coffee.id }, data: { stock: 10 } });
    const res = await pay(orderId, newKey()).expect(201);
    expect(res.body).toMatchObject({ status: 'FAILED', orderStatus: 'PAYMENT_FAILED' });
    expect(res.body.failureReason).toBe('Nguyên liệu vừa hết (Cà phê), chưa trừ tiền');
    expect(await stocks()).toEqual({ 'Cà phê': 10, Sữa: 5000, Siro: 5000, 'Trân châu': 1000 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(0);
  });

  it('FR-12: N khách thanh toán đồng thời không bán vượt kho, tồn kho không âm', async () => {
    // Mỗi ly size S cần 20g cà phê; còn 100g → bán được đúng 5 ly
    await prisma.ingredient.update({ where: { id: fx.coffee.id }, data: { stock: 100 } });
    const orderIds: number[] = [];
    for (let i = 0; i < 8; i++) orderIds.push(await createSmallOrder());

    const results = await Promise.all(orderIds.map((id) => pay(id, newKey())));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const success = results.filter((r) => r.body.status === 'SUCCESS');
    const failed = results.filter((r) => r.body.status === 'FAILED');
    expect(success).toHaveLength(5);
    expect(failed).toHaveLength(3);
    expect(failed.every((r) => r.body.orderStatus === 'PAYMENT_FAILED')).toBe(true);

    const s = await stocks();
    expect(s['Cà phê']).toBe(0);
    expect(s['Sữa']).toBe(5000 - 5 * 30);
    expect(Object.values(s).every((v) => v >= 0)).toBe(true);
    expect(await prisma.order.count({ where: { status: 'PAID' } })).toBe(5);
  });

  it('FR-09: hai yêu cầu đồng thời cho cùng một đơn chỉ thanh toán một lần', async () => {
    const orderId = await createSampleOrder();
    const [a, b] = await Promise.all([pay(orderId, newKey()), pay(orderId, newKey())]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.payment.count({ where: { status: 'SUCCESS' } })).toBe(1);
    expect((await stocks())['Cà phê']).toBe(950);
  });

  it('FR-09: bấm thanh toán hai lần liên tiếp cùng khóa chỉ tạo một Payment', async () => {
    const orderId = await createSampleOrder();
    const key = newKey();
    const results = await Promise.all([pay(orderId, key), pay(orderId, key)]);
    expect(results.some((r) => r.status === 201)).toBe(true);
    expect(results.every((r) => [200, 201, 409].includes(r.status))).toBe(true);
    expect(await prisma.payment.count()).toBe(1);
    expect((await stocks())['Cà phê']).toBe(950);
  });

  it('FR-10, FR-12, FR-14: nhân viên xử lý đơn; hủy đơn đã PAID hoàn kho và trừ lại điểm', async () => {
    const done = await createSampleOrder();
    await pay(done, newKey()).expect(201);
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      const res = await request(server()).patch(`/orders/${done}/status`).set(auth(staffToken)).send({ status }).expect(200);
      expect(res.body.status).toBe(status);
    }

    const cancelled = await createSampleOrder();
    await pay(cancelled, newKey()).expect(201);
    expect((await stocks())['Cà phê']).toBe(900);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(14);

    await request(server()).patch(`/orders/${cancelled}/status`).set(auth(staffToken)).send({ status: 'CANCELLED' }).expect(200);
    expect(await stocks()).toEqual({ 'Cà phê': 950, Sữa: 4924, Siro: 4986, 'Trân châu': 920 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.customer.id } })).points).toBe(7);
    const reversal = await prisma.loyaltyTransaction.findFirstOrThrow({ where: { orderId: cancelled, type: 'REVERSAL' } });
    expect(reversal.points).toBe(7);
    // Đơn đã hủy không thanh toán lại được
    await pay(cancelled, newKey()).expect(400);
  });
});

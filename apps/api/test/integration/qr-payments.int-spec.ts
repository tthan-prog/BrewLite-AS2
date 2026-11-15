import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createTestApp, login, resetDatabase, seedFixture } from './helpers';

/** US-16: thanh toán QR qua cổng mô phỏng (FR-18). */
describe('Thanh toán QR mô phỏng (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  let customerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    fx = await seedFixture(prisma);
    const pinHash = await bcrypt.hash('123456', 4);
    await prisma.paymentAccount.createMany({
      data: [
        { identifier: 'TEST-0001', holderName: 'Tài khoản thử 1', pinHash, balance: 1_000_000 },
        { identifier: 'TEST-0002', holderName: 'Tài khoản thử 2', pinHash, balance: 10_000 },
      ],
    });
    [customerToken, otherToken] = await Promise.all([login(app, 'khach1@test.vn'), login(app, 'khach2@test.vn')]);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Đơn 2 ly size M, đường 50%, trân châu, mã GIAM10: 73.800đ; cần cà phê 50g. */
  async function createOrder(): Promise<number> {
    const res = await request(server())
      .post('/orders')
      .set(auth(customerToken))
      .send({
        items: [{ productId: fx.product.id, quantity: 2, size: 'M', sugar: 50, toppingIds: [fx.topping.id] }],
        promotionCode: 'GIAM10',
      })
      .expect(201);
    return res.body.id as number;
  }

  const createQr = async (orderId: number) =>
    (await request(server()).post('/payments/qr').set(auth(customerToken)).send({ orderId }).expect(201)).body;

  const confirm = (token: string, accountIdentifier: string, pin = '123456') =>
    request(server()).post(`/payments/qr/${token}/confirm`).send({ accountIdentifier, pin });

  const balance = async (identifier: string) =>
    (await prisma.paymentAccount.findUniqueOrThrow({ where: { identifier } })).balance;
  const coffee = async () => (await prisma.ingredient.findUniqueOrThrow({ where: { id: fx.coffee.id } })).stock;

  it('tạo mã QR: token ngẫu nhiên, link tới trang xác nhận, ảnh QR; tạo lại khi còn hạn thì trả cùng mã', async () => {
    const orderId = await createOrder();
    const qr = await createQr(orderId);
    expect(qr.token).toMatch(/^[a-f0-9]{32}$/);
    expect(qr).toMatchObject({ orderId, amount: 73800, status: 'PENDING', qrContent: `http://localhost:3000/pay/qr/${qr.token}` });
    expect(qr.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(new Date(qr.expiresAt).getTime() - Date.now()).toBeGreaterThan(4 * 60_000);
    expect((await createQr(orderId)).token).toBe(qr.token);
  });

  it('trang điện thoại xem được số tiền và tài khoản thử, không lộ số dư; token sai trả 404', async () => {
    const qr = await createQr(await createOrder());
    const res = await request(server()).get(`/payments/qr/${qr.token}`).expect(200);
    expect(res.body).toMatchObject({ amount: 73800, status: 'PENDING' });
    expect(res.body.accounts).toEqual([
      { identifier: 'TEST-0001', holderName: 'Tài khoản thử 1' },
      { identifier: 'TEST-0002', holderName: 'Tài khoản thử 2' },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('balance');
    await request(server()).get('/payments/qr/khong-hop-le').expect(404);
    await request(server()).get(`/payments/qr/${'0'.repeat(32)}`).expect(404);
  });

  it('sai PIN: 400, không trừ tiền, không đụng kho, cho nhập lại', async () => {
    const orderId = await createOrder();
    const qr = await createQr(orderId);
    const res = await confirm(qr.token, 'TEST-0001', '000000').expect(400);
    expect(res.body.message).toBe('Sai tài khoản hoặc PIN');
    await confirm(qr.token, 'KHONG-CO').expect(400);
    await confirm(qr.token, 'TEST-0001', '12').expect(400);
    expect(await balance('TEST-0001')).toBe(1_000_000);
    expect(await coffee()).toBe(1000);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    expect((await prisma.paymentIntent.findUniqueOrThrow({ where: { token: qr.token } })).status).toBe('PENDING');
  });

  it('đúng PIN, đủ số dư: đơn PAID, trừ đúng số tiền, trừ kho, cộng điểm; khách thấy trạng thái PAID', async () => {
    const orderId = await createOrder();
    const qr = await createQr(orderId);
    const res = await confirm(qr.token, 'test-0001').expect(200);
    expect(res.body).toMatchObject({ orderId, method: 'QR', amount: 73800, status: 'SUCCESS', orderStatus: 'PAID', pointsEarned: 7 });
    expect(await balance('TEST-0001')).toBe(1_000_000 - 73800);
    expect(await coffee()).toBe(950);
    const intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { token: qr.token }, include: { account: true } });
    expect(intent.status).toBe('PAID');
    expect(intent.account?.identifier).toBe('TEST-0001');

    const status = await request(server()).get(`/payments/qr/${qr.token}/status`).set(auth(customerToken)).expect(200);
    expect(status.body).toEqual({ token: qr.token, orderId, status: 'PAID', orderStatus: 'PAID' });
    await request(server()).get(`/payments/qr/${qr.token}/status`).set(auth(otherToken)).expect(404);
  });

  it('xác nhận lặp lại chỉ thành công một lần (tuần tự và đồng thời)', async () => {
    const first = await createQr(await createOrder());
    await confirm(first.token, 'TEST-0001').expect(200);
    const again = await confirm(first.token, 'TEST-0001').expect(409);
    expect(again.body.message).toBe('Mã QR này đã được thanh toán');

    // Đơn thứ hai: 5 lần bấm xác nhận cùng lúc
    const second = await createQr(await createOrder());
    const results = await Promise.all(Array.from({ length: 5 }, () => confirm(second.token, 'TEST-0001')));
    expect(results.filter((r) => r.status === 200 && r.body.status === 'SUCCESS').length).toBe(1);
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(await balance('TEST-0001')).toBe(1_000_000 - 2 * 73800);
    expect(await prisma.payment.count({ where: { status: 'SUCCESS' } })).toBe(2);
    expect(await coffee()).toBe(900);
  });

  it('thiếu số dư: không trừ tiền, hoàn kho, đơn PAYMENT_FAILED; tạo mã mới và trả bằng tài khoản khác thì PAID', async () => {
    const orderId = await createOrder();
    const qr = await createQr(orderId);
    const res = await confirm(qr.token, 'TEST-0002').expect(200);
    expect(res.body).toMatchObject({ status: 'FAILED', orderStatus: 'PAYMENT_FAILED', failureReason: 'Số dư tài khoản không đủ' });
    expect(await balance('TEST-0002')).toBe(10_000);
    expect(await coffee()).toBe(1000);
    expect((await prisma.paymentIntent.findUniqueOrThrow({ where: { token: qr.token } })).status).toBe('FAILED');
    await confirm(qr.token, 'TEST-0001').expect(400);

    const retry = await createQr(orderId);
    expect(retry.token).not.toBe(qr.token);
    await confirm(retry.token, 'TEST-0001').expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
  });

  it('QR hết hạn: không trừ tiền, trạng thái EXPIRED', async () => {
    const qr = await createQr(await createOrder());
    await prisma.paymentIntent.update({ where: { token: qr.token }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await confirm(qr.token, 'TEST-0001').expect(400);
    expect(res.body.message).toBe('Mã QR đã hết hạn, vui lòng tạo mã mới');
    expect(await balance('TEST-0001')).toBe(1_000_000);
    expect((await request(server()).get(`/payments/qr/${qr.token}`).expect(200)).body.status).toBe('EXPIRED');
  });

  it('chỉ chủ đơn tạo được QR; chưa đăng nhập trả 401; đơn đã thanh toán trả 409', async () => {
    const orderId = await createOrder();
    await request(server()).post('/payments/qr').set(auth(otherToken)).send({ orderId }).expect(404);
    await request(server()).post('/payments/qr').send({ orderId }).expect(401);
    const qr = await createQr(orderId);
    await confirm(qr.token, 'TEST-0001').expect(200);
    await request(server()).post('/payments/qr').set(auth(customerToken)).send({ orderId }).expect(409);
  });
});

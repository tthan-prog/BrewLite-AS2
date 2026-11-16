import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { sign, signData } from '../../src/payments/vnpay/vnpay-signature';
import { createTestApp, login, resetDatabase, seedFixture } from './helpers';

const SECRET = 'integration-test-vnpay-secret';

/** US-19: thanh toán VNPay sandbox (FR-21). Mô phỏng phần VNPay gửi về bằng dữ liệu ký đúng thuật toán. */
describe('VNPay sandbox (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fx: Awaited<ReturnType<typeof seedFixture>>;
  let customerToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    fx = await seedFixture(prisma);
    customerToken = await login(app, 'khach1@test.vn');
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = { Authorization: `Bearer ${''}` };

  async function createPayment() {
    const order = await request(server())
      .post('/orders')
      .set({ ...auth, Authorization: `Bearer ${customerToken}` })
      .send({ items: [{ productId: fx.product.id, quantity: 2, size: 'M', sugar: 50, toppingIds: [fx.topping.id] }], promotionCode: 'GIAM10' })
      .expect(201);
    const res = await request(server())
      .post('/payments/vnpay')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('X-Forwarded-For', '113.161.1.2, 10.0.0.1')
      .send({ orderId: order.body.id })
      .expect(201);
    return { orderId: order.body.id as number, ...res.body } as { orderId: number; txnRef: string; paymentUrl: string };
  }

  /** Dữ liệu VNPay gửi về, ký bằng cùng secret. */
  function vnpReturn(txnRef: string, over: Record<string, string> = {}, secret = SECRET) {
    const params: Record<string, string> = {
      vnp_Amount: '7380000',
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: 'VNP14123456',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: 'Thanh toan don hang BrewLite',
      vnp_PayDate: '20261116031500',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'TESTTMN1',
      vnp_TransactionNo: '14123456',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
      ...over,
    };
    return `${signData(params)}&vnp_SecureHashType=HmacSHA512&vnp_SecureHash=${sign(params, secret)}`;
  }

  it('tạo URL thanh toán đã ký đúng: số tiền ×100, mã website, IP khách, chữ ký kiểm tra lại được', async () => {
    const { txnRef, paymentUrl } = await createPayment();
    expect(txnRef).toMatch(/^[a-f0-9]{32}$/);
    const url = new URL(paymentUrl);
    expect(`${url.origin}${url.pathname}`).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const q = Object.fromEntries(url.searchParams);
    expect(q).toMatchObject({ vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: 'TESTTMN1', vnp_Amount: '7380000', vnp_CurrCode: 'VND', vnp_TxnRef: txnRef, vnp_IpAddr: '113.161.1.2', vnp_ReturnUrl: 'http://localhost:3000/checkout/vnpay-return' });
    expect(q.vnp_CreateDate).toMatch(/^\d{14}$/);
    const { vnp_SecureHash, ...rest } = q;
    expect(sign(rest, SECRET)).toBe(vnp_SecureHash);
    expect((await request(server()).get('/payments/vnpay/config').expect(200)).body).toEqual({ enabled: true });
  });

  it('Return URL hợp lệ, mã 00: đơn PAID, trừ kho, cộng điểm; gọi lại và IPN không tạo thêm thanh toán', async () => {
    const { orderId, txnRef } = await createPayment();
    const res = await request(server()).get(`/payments/vnpay/return?${vnpReturn(txnRef)}`).expect(200);
    expect(res.body).toMatchObject({ orderId, method: 'VNPAY', amount: 73800, status: 'SUCCESS', orderStatus: 'PAID', pointsEarned: 7 });
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: fx.coffee.id } })).stock).toBe(950);
    expect((await prisma.paymentIntent.findUniqueOrThrow({ where: { token: txnRef } })).status).toBe('PAID');

    await request(server()).get(`/payments/vnpay/return?${vnpReturn(txnRef)}`).expect(200);
    const ipn = await request(server()).get(`/payments/vnpay/ipn?${vnpReturn(txnRef)}`).expect(200);
    expect(ipn.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(await prisma.payment.count()).toBe(1);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: fx.coffee.id } })).stock).toBe(950);
  });

  it('sai chữ ký: từ chối, đơn giữ nguyên PENDING, IPN trả 97', async () => {
    const { orderId, txnRef } = await createPayment();
    const forged = vnpReturn(txnRef, {}, 'secret-gia-mao');
    const res = await request(server()).get(`/payments/vnpay/return?${forged}`).expect(400);
    expect(res.body.message).toBe('Chữ ký VNPay không hợp lệ');
    expect((await request(server()).get(`/payments/vnpay/ipn?${forged}`).expect(200)).body.RspCode).toBe('97');
    // Sửa số tiền sau khi ký cũng là sai chữ ký
    const tampered = vnpReturn(txnRef).replace('vnp_Amount=7380000', 'vnp_Amount=100');
    await request(server()).get(`/payments/vnpay/return?${tampered}`).expect(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    expect(await prisma.payment.count()).toBe(0);
  });

  it('chữ ký đúng nhưng số tiền khác đơn: từ chối, đơn giữ nguyên, IPN trả 04', async () => {
    const { orderId, txnRef } = await createPayment();
    const wrongAmount = vnpReturn(txnRef, { vnp_Amount: '100000' });
    const res = await request(server()).get(`/payments/vnpay/return?${wrongAmount}`).expect(400);
    expect(res.body.message).toBe('Số tiền giao dịch không khớp với đơn hàng');
    expect((await request(server()).get(`/payments/vnpay/ipn?${wrongAmount}`).expect(200)).body.RspCode).toBe('04');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
  });

  it('khách hủy ở VNPay (mã 24): PAYMENT_FAILED kèm lý do, hoàn kho, cho thanh toán lại bằng giao dịch mới', async () => {
    const { orderId, txnRef } = await createPayment();
    const res = await request(server())
      .get(`/payments/vnpay/return?${vnpReturn(txnRef, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' })}`)
      .expect(200);
    expect(res.body).toMatchObject({ status: 'FAILED', orderStatus: 'PAYMENT_FAILED', failureReason: 'Khách hàng hủy giao dịch' });
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: fx.coffee.id } })).stock).toBe(1000);
    expect((await prisma.paymentIntent.findUniqueOrThrow({ where: { token: txnRef } })).status).toBe('FAILED');

    const retry = await request(server()).post('/payments/vnpay').set('Authorization', `Bearer ${customerToken}`).send({ orderId }).expect(201);
    await request(server()).get(`/payments/vnpay/return?${vnpReturn(retry.body.txnRef)}`).expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
  });

  it('giao dịch không tồn tại: Return 404, IPN 01', async () => {
    const unknown = vnpReturn('f'.repeat(32));
    await request(server()).get(`/payments/vnpay/return?${unknown}`).expect(404);
    expect((await request(server()).get(`/payments/vnpay/ipn?${unknown}`).expect(200)).body.RspCode).toBe('01');
  });
});

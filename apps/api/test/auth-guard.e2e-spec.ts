import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Test HTTP cho xác thực và phân quyền (FR-06, FR-15, NFR-02, NFR-04).
 * Prisma là bản giả: các yêu cầu ở đây bị chặn trước khi chạm database.
 */
describe('Xác thực và phân quyền (e2e)', () => {
  let app: INestApplication;
  let customerToken: string;
  let staffToken: string;
  const prismaMock = { $disconnect: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const jwt = moduleRef.get(JwtService);
    customerToken = await jwt.signAsync({ sub: 1, email: 'customer@brewlite.test', role: 'CUSTOMER' });
    staffToken = await jwt.signAsync({ sub: 2, email: 'staff@brewlite.test', role: 'STAFF' });
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('POST /orders không có JWT trả 401', async () => {
    const res = await request(server()).post('/orders').send({ items: [{ productId: 1, quantity: 1 }] }).expect(401);
    expect(res.body.message).toBe('Bạn cần đăng nhập');
  });

  it('JWT ký bằng secret khác trả 401', async () => {
    const fake = await new JwtService({ secret: 'secret-khac' }).signAsync({ sub: 1, role: 'STAFF' });
    await request(server()).get('/orders/me').set('Authorization', `Bearer ${fake}`).expect(401);
  });

  it('CUSTOMER đổi trạng thái đơn nhận 403', async () => {
    await request(server())
      .patch('/orders/1/status')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'PREPARING' })
      .expect(403);
  });

  it('CUSTOMER xem danh sách đơn của nhân viên nhận 403', async () => {
    await request(server()).get('/orders').set('Authorization', `Bearer ${customerToken}`).expect(403);
  });

  it('STAFF đặt trạng thái không cho phép (PAID) nhận 400', async () => {
    await request(server())
      .patch('/orders/1/status')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'PAID' })
      .expect(400);
  });

  it('đặt đơn với dữ liệu sai hoặc trường lạ trả 400', async () => {
    const auth = { Authorization: `Bearer ${customerToken}` };
    await request(server()).post('/orders').set(auth).send({ items: [] }).expect(400);
    await request(server()).post('/orders').set(auth).send({ items: [{ productId: 1, quantity: 51 }] }).expect(400);
    await request(server()).post('/orders').set(auth).send({ items: [{ productId: 1, quantity: 1, sugar: 40 }] }).expect(400);
    // Không cho gửi giá từ phía khách
    await request(server()).post('/orders').set(auth).send({ items: [{ productId: 1, quantity: 1, unitPrice: 1 }] }).expect(400);
  });

  it('POST /payments thiếu Idempotency-Key trả 400', async () => {
    const res = await request(server())
      .post('/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: 1, method: 'WALLET' })
      .expect(400);
    expect(res.body.message).toMatch(/Idempotency-Key/);
  });

  it('POST /payments bằng thẻ mà thiếu số thẻ trả 400', async () => {
    await request(server())
      .post('/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'key-12345678')
      .send({ orderId: 1, method: 'CARD' })
      .expect(400);
  });

  it('đăng ký với email sai hoặc mật khẩu ngắn trả 400', async () => {
    await request(server()).post('/auth/register').send({ name: 'An', email: 'sai', password: 'Matkhau@123' }).expect(400);
    await request(server()).post('/auth/register').send({ name: 'An', email: 'an@test.vn', password: '123' }).expect(400);
    // Không cho tự đặt vai trò STAFF
    await request(server())
      .post('/auth/register')
      .send({ name: 'An', email: 'an@test.vn', password: 'Matkhau@123', role: 'STAFF' })
      .expect(400);
  });
});

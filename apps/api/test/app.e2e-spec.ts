import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Test tích hợp HTTP: chạy toàn bộ AppModule (routing, pipe, filter),
 * thay PrismaService bằng bản giả để không cần database.
 */
const ing = (id: number, stock: number) => ({ id, stock, sugarScaled: false, iceScaled: false });
const product = {
  id: 1,
  name: 'Cà phê sữa đá',
  description: 'Cà phê đậm vị',
  basePrice: 29000,
  category: 'Cà phê',
  imageUrl: '',
  recipe: [{ quantity: 18, ingredient: ing(1, 5000) }],
};

const prismaMock = {
  $queryRaw: vi.fn().mockResolvedValue([1]),
  $disconnect: vi.fn(),
  product: {
    findMany: vi.fn().mockResolvedValue([product]),
    findUnique: vi.fn(({ where }: { where: { id: number } }) => Promise.resolve(where.id === 1 ? product : null)),
  },
  topping: { findMany: vi.fn().mockResolvedValue([]) },
};

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health trả 200, status ok, db up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('GET /health trả 503 khi database lỗi', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('down'));
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'down' });
  });

  it('GET /products trả danh sách menu', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 1, name: 'Cà phê sữa đá', price: 29000, available: true, maxQuantity: 50 });
  });

  it('GET /products/:id trả chi tiết kèm size và mức đường, đá', async () => {
    const res = await request(app.getHttpServer()).get('/products/1').expect(200);
    expect(res.body.sizes).toHaveLength(3);
    expect(res.body.sugarLevels).toEqual([0, 30, 50, 70, 100]);
  });

  it('GET /products/:id trả 404 khi không có sản phẩm', async () => {
    await request(app.getHttpServer()).get('/products/999').expect(404);
  });

  it('GET /products/:id trả 400 khi id không phải số', async () => {
    await request(app.getHttpServer()).get('/products/abc').expect(400);
  });

  it('trả 404 cho đường dẫn không tồn tại', async () => {
    await request(app.getHttpServer()).get('/khong-ton-tai').expect(404);
  });
});

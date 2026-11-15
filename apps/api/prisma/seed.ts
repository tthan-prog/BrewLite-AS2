// Seed dữ liệu mẫu cho BrewLite AS2. Chạy (trong apps/api): npx prisma db seed
import { PrismaClient, PromotionType, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clearAll() {
  // Xóa theo thứ tự phụ thuộc để chạy lại seed được nhiều lần
  await prisma.orderIngredientUse.deleteMany();
  await prisma.orderItemTopping.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.paymentIntent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.toppingRecipeItem.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.product.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.paymentAccount.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearAll();

  // --- Người dùng mẫu (mật khẩu chỉ dùng để thử, không dùng thật) ---
  const pw = await bcrypt.hash('Customer@123', 10);
  const staffPw = await bcrypt.hash('Staff@123', 10);
  await prisma.user.createMany({
    data: [
      { email: 'customer@brewlite.test', name: 'Khách Thử', passwordHash: pw, role: Role.CUSTOMER, points: 120 },
      { email: 'staff@brewlite.test', name: 'Nhân Viên Quầy', passwordHash: staffPw, role: Role.STAFF, points: 0 },
    ],
  });

  // --- Nguyên liệu (đơn vị: g hoặc ml) ---
  const ing = async (name: string, unit: string, stock: number, low: number, sugar = false, ice = false) =>
    prisma.ingredient.create({
      data: { name, unit, stock, lowThreshold: low, sugarScaled: sugar, iceScaled: ice },
    });

  const coffee = await ing('Cà phê rang xay', 'g', 5000, 500);
  const milk = await ing('Sữa tươi', 'ml', 20000, 2000);
  const condensed = await ing('Sữa đặc', 'ml', 6000, 600);
  const tea = await ing('Trà đen', 'g', 3000, 300);
  const matcha = await ing('Bột matcha', 'g', 1500, 150);
  const syrup = await ing('Siro đường', 'ml', 10000, 1000, true, false);
  const ice = await ing('Đá viên', 'g', 40000, 4000, false, true);
  const pearl = await ing('Trân châu', 'g', 4000, 400);
  const jelly = await ing('Thạch', 'g', 3000, 300);
  const cheese = await ing('Kem cheese', 'g', 2500, 250);

  // --- Sản phẩm (giá VND) ---
  const mkProduct = (name: string, desc: string, price: number, category: string, image: string) =>
    prisma.product.create({
      data: { name, description: desc, basePrice: price, category, imageUrl: image },
    });

  const pCaPheSua = await mkProduct('Cà phê sữa đá', 'Cà phê đậm vị, sữa đặc', 29000, 'Cà phê', '/images/ca-phe-sua-da.jpg');
  const pCaPheDen = await mkProduct('Cà phê đen đá', 'Cà phê nguyên chất', 25000, 'Cà phê', '/images/ca-phe-den-da.jpg');
  const pBacXiu = await mkProduct('Bạc xỉu', 'Nhiều sữa, ít cà phê', 32000, 'Cà phê', '/images/bac-xiu.jpg');
  const pTraDao = await mkProduct('Trà đen sữa', 'Trà đen thơm, sữa tươi', 35000, 'Trà', '/images/tra-den-sua.jpg');
  const pMatcha = await mkProduct('Matcha latte', 'Matcha với sữa tươi', 45000, 'Trà', '/images/matcha-latte.jpg');
  const pTraSuaTc = await mkProduct('Trà sữa trân châu', 'Trà sữa kèm trân châu', 42000, 'Trà sữa', '/images/tra-sua-tran-chau.jpg');

  // --- Công thức cho 1 ly size S ---
  const recipe = (productId: number, items: Array<[number, number]>) =>
    prisma.recipeItem.createMany({
      data: items.map(([ingredientId, quantity]) => ({ productId, ingredientId, quantity })),
    });

  await recipe(pCaPheSua.id, [[coffee.id, 18], [condensed.id, 30], [syrup.id, 10], [ice.id, 120]]);
  await recipe(pCaPheDen.id, [[coffee.id, 20], [syrup.id, 10], [ice.id, 120]]);
  await recipe(pBacXiu.id, [[coffee.id, 10], [milk.id, 120], [condensed.id, 20], [ice.id, 100]]);
  await recipe(pTraDao.id, [[tea.id, 8], [milk.id, 100], [syrup.id, 15], [ice.id, 120]]);
  await recipe(pMatcha.id, [[matcha.id, 6], [milk.id, 150], [syrup.id, 10], [ice.id, 100]]);
  await recipe(pTraSuaTc.id, [[tea.id, 8], [milk.id, 100], [syrup.id, 15], [pearl.id, 40], [ice.id, 120]]);

  // --- Topping và công thức topping ---
  const tPearl = await prisma.topping.create({ data: { name: 'Trân châu đen', price: 7000 } });
  const tJelly = await prisma.topping.create({ data: { name: 'Thạch dừa', price: 6000 } });
  const tCheese = await prisma.topping.create({ data: { name: 'Kem cheese', price: 10000 } });
  await prisma.toppingRecipeItem.createMany({
    data: [
      { toppingId: tPearl.id, ingredientId: pearl.id, quantity: 40 },
      { toppingId: tJelly.id, ingredientId: jelly.id, quantity: 30 },
      { toppingId: tCheese.id, ingredientId: cheese.id, quantity: 35 },
    ],
  });

  // --- Mã khuyến mãi ---
  await prisma.promotion.createMany({
    data: [
      { code: 'GIAM10', type: PromotionType.PERCENT, value: 10, minOrder: 50000, expiresAt: new Date('2027-12-31'), usageLimit: 100 },
      { code: 'GIAM20K', type: PromotionType.FIXED, value: 20000, minOrder: 100000, expiresAt: new Date('2027-12-31'), usageLimit: 50 },
      { code: 'HETHAN', type: PromotionType.PERCENT, value: 15, minOrder: 0, expiresAt: new Date('2025-01-01'), usageLimit: null },
    ],
  });

  // --- Tài khoản thanh toán thử nghiệm (QR mô phỏng) ---
  const pin = await bcrypt.hash('123456', 10);
  await prisma.paymentAccount.createMany({
    data: [
      { identifier: 'TEST-0001', holderName: 'Tài khoản thử 1', pinHash: pin, balance: 1000000 },
      { identifier: 'TEST-0002', holderName: 'Tài khoản thử 2 (ít tiền)', pinHash: pin, balance: 10000 },
    ],
  });

  // --- Phần thưởng ---
  await prisma.reward.createMany({
    data: [
      { name: 'Giảm 10.000đ', pointsCost: 50, active: true },
      { name: 'Một ly cà phê miễn phí', pointsCost: 150, active: true },
    ],
  });

  console.log('Seed xong: 2 user, 10 nguyên liệu, 6 sản phẩm, 3 topping, 3 mã khuyến mãi, 2 tài khoản thanh toán, 2 phần thưởng.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService (FR-05, NFR-02)', () => {
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn(), create: vi.fn() } };
    service = new AuthService(prisma as unknown as PrismaService, jwt);
  });

  it('đăng ký: lưu mật khẩu dạng băm bcrypt, vai trò CUSTOMER', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 5, name: data.name, email: data.email, role: data.role, points: 0 }),
    );
    const user = await service.register({ name: 'An', email: 'an@test.vn', password: 'Matkhau@123' });
    expect(user).toEqual({ id: 5, name: 'An', email: 'an@test.vn', role: 'CUSTOMER', points: 0 });
    const saved = prisma.user.create.mock.calls[0][0].data;
    expect(saved.passwordHash).not.toBe('Matkhau@123');
    expect(await bcrypt.compare('Matkhau@123', saved.passwordHash)).toBe(true);
    expect(saved).not.toHaveProperty('password');
  });

  it('đăng ký email đã tồn tại trả 409', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    await expect(service.register({ name: 'An', email: 'an@test.vn', password: 'Matkhau@123' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('đăng nhập đúng trả JWT chứa id và vai trò', async () => {
    const passwordHash = await bcrypt.hash('Matkhau@123', 4);
    prisma.user.findUnique.mockResolvedValue({ id: 7, name: 'An', email: 'an@test.vn', role: 'STAFF', points: 3, passwordHash });
    const result = await service.login({ email: 'an@test.vn', password: 'Matkhau@123' });
    expect(result.user).toEqual({ id: 7, name: 'An', email: 'an@test.vn', role: 'STAFF', points: 3 });
    const payload = await jwt.verifyAsync(result.accessToken);
    expect(payload).toMatchObject({ sub: 7, email: 'an@test.vn', role: 'STAFF' });
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('sai mật khẩu hoặc email không tồn tại đều trả 401 cùng thông báo', async () => {
    const passwordHash = await bcrypt.hash('Matkhau@123', 4);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 7, passwordHash });
    await expect(service.login({ email: 'an@test.vn', password: 'sai-mat-khau' })).rejects.toThrow(
      new UnauthorizedException('Email hoặc mật khẩu không đúng'),
    );
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.login({ email: 'khong@test.vn', password: 'x' })).rejects.toThrow('Email hoặc mật khẩu không đúng');
  });
});

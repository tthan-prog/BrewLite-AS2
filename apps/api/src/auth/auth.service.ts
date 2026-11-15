import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  points: number;
}

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

const publicSelect = { id: true, name: true, email: true, role: true, points: true } as const;

/** Đăng ký, đăng nhập, phát JWT (FR-05, NFR-02). Mật khẩu chỉ lưu dạng băm bcrypt. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email đã được đăng ký');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash, role: Role.CUSTOMER },
        select: publicSelect,
      });
    } catch (e) {
      // Hai yêu cầu đăng ký cùng email chạy song song: ràng buộc unique chặn bản thứ hai
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email đã được đăng ký');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Cùng một thông báo cho sai email và sai mật khẩu, không lộ email nào đã tồn tại
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, points: user.points },
    };
  }

  async me(userId: number): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: publicSelect });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    return user;
  }
}

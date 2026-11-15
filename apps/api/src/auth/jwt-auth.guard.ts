import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload } from './auth-user';

/**
 * Kiểm tra header "Authorization: Bearer <token>" (FR-06).
 * Token thiếu, sai chữ ký hoặc hết hạn đều trả 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = req.headers['authorization'] ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bạn cần đăng nhập');
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
  }
}

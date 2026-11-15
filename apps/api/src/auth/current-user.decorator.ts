import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth-user';

/** Lấy người dùng đã xác thực (do JwtAuthGuard gắn vào request). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return req.user;
});

import { Role } from '@prisma/client';

/** Thông tin người dùng lấy từ JWT, gắn vào request sau khi xác thực. */
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

/** Nội dung JWT: sub là id người dùng. */
export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

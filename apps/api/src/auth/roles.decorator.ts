import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Giới hạn route cho các vai trò được liệt kê (FR-15, NFR-02). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

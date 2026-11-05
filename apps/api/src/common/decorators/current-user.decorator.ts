import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  driverId: string | null;
}

/** Actor used for automated transitions (simulator, autopilot). Recorded as `actorId = null`. */
export const SYSTEM_USER: AuthUser = { id: 'system', email: 'system@gfs.local', name: 'System', role: 'ADMIN', driverId: null };

export const actorIdOf = (user: AuthUser): string | null => (user.id === SYSTEM_USER.id ? null : user.id);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

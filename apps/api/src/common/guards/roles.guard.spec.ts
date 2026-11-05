import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function ctx(role?: Role): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u1', role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const requires = (roles: Role[] | undefined) => jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  afterEach(() => jest.restoreAllMocks());

  it('allows routes without role metadata', () => {
    requires(undefined);
    expect(guard.canActivate(ctx('DRIVER'))).toBe(true);
  });

  it('allows a matching role', () => {
    requires(['DISPATCHER']);
    expect(guard.canActivate(ctx('DISPATCHER'))).toBe(true);
  });

  it('lets ADMIN through every role check', () => {
    requires(['ACCOUNTANT']);
    expect(guard.canActivate(ctx('ADMIN'))).toBe(true);
  });

  it('forbids other roles', () => {
    requires(['DISPATCHER']);
    expect(() => guard.canActivate(ctx('DRIVER'))).toThrow(ForbiddenException);
  });

  it('denies unauthenticated requests', () => {
    requires(['DISPATCHER']);
    expect(guard.canActivate(ctx())).toBe(false);
  });
});

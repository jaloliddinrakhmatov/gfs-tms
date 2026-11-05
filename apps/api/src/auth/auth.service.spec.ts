import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AppConfig } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService, sha256 } from './auth.service';

const user = {
  id: 'u1',
  email: 'dispatcher@gfs.demo',
  name: 'Sarah Chen',
  role: 'DISPATCHER' as const,
  isActive: true,
  passwordHash: bcrypt.hashSync('Demo1234!', 4),
  driver: null,
};

function setup() {
  const tokens = new Map<string, { id: string; userId: string; tokenHash: string; family: string; expiresAt: Date; revokedAt: Date | null }>();
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }) => (where.email === user.email ? user : null)),
      update: jest.fn(async () => user),
    },
    refreshToken: {
      create: jest.fn(async ({ data }) => {
        const row = { id: `rt${tokens.size}`, revokedAt: null, ...data };
        tokens.set(data.tokenHash, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = tokens.get(where.tokenHash);
        return row ? { ...row, user } : null;
      }),
      update: jest.fn(async ({ where, data }) => {
        const row = [...tokens.values()].find((t) => t.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const t of tokens.values()) if (t.family === where.family && !t.revokedAt) (Object.assign(t, data), count++);
        return { count };
      }),
    },
  };
  const config = { get: (k: string) => (k === 'REFRESH_TTL_DAYS' ? 7 : undefined) } as unknown as AppConfig;
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  return { service: new AuthService(prisma as unknown as PrismaService, jwt, config), tokens };
}

describe('AuthService', () => {
  it('rejects bad credentials without revealing which part was wrong', async () => {
    const { service } = setup();
    await expect(service.login('nobody@gfs.demo', 'Demo1234!')).rejects.toThrow('Invalid email or password');
    await expect(service.login(user.email, 'wrong-password')).rejects.toThrow('Invalid email or password');
  });

  it('issues an access token and stores only a hash of the refresh token', async () => {
    const { service, tokens } = setup();
    const res = await service.login(user.email, 'Demo1234!');
    expect(res.accessToken.split('.')).toHaveLength(3);
    expect(tokens.has(sha256(res.refreshToken))).toBe(true);
    expect([...tokens.keys()]).not.toContain(res.refreshToken);
  });

  it('rotates refresh tokens on use', async () => {
    const { service } = setup();
    const first = await service.login(user.email, 'Demo1234!');
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(second.refreshToken)).resolves.toBeDefined();
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const { service } = setup();
    const first = await service.login(user.email, 'Demo1234!');
    const second = await service.refresh(first.refreshToken);

    await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    // The legitimate (newer) token is now revoked as well
    await expect(service.refresh(second.refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});

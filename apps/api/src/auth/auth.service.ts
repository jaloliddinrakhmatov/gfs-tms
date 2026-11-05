import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload } from '../common/guards/jwt-auth.guard';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Used to equalise timing when the e-mail does not exist (prevents user enumeration). */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { driver: { select: { id: true } } },
    });
    // Always run bcrypt to keep timing constant whether or not the user exists.
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    return user;
  }

  async login(email: string, password: string, userAgent?: string) {
    const user = await this.validateCredentials(email, password);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user, user.driver?.id ?? null, randomUUID(), userAgent);
    return { user: this.toPublicUser(user, user.driver?.id ?? null), ...tokens };
  }

  /**
   * Refresh token rotation with reuse detection: every refresh token is single-use.
   * Presenting an already-rotated token revokes the whole token family (likely theft).
   */
  async refresh(rawToken: string | undefined, userAgent?: string) {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: { include: { driver: { select: { id: true } } } } },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; revoking family`);
      await this.revokeFamily(stored.family);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const driverId = stored.user.driver?.id ?? null;
    const tokens = await this.issueTokens(stored.user, driverId, stored.family, userAgent);
    return { user: this.toPublicUser(stored.user, driverId), ...tokens };
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (stored) await this.revokeFamily(stored.family);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { driver: { select: { id: true } } },
    });
    return this.toPublicUser(user, user.driver?.id ?? null);
  }

  private async revokeFamily(family: string) {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: User,
    driverId: string | null,
    family: string,
    userAgent?: string,
  ): Promise<SessionTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      driverId,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.config.get('REFRESH_TTL_DAYS') * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        family,
        expiresAt: refreshExpiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  toPublicUser(user: User, driverId: string | null) {
    return { id: user.id, email: user.email, name: user.name, role: user.role, driverId };
  }
}

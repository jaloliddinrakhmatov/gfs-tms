import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from '../config/app-config.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';

export const REFRESH_COOKIE = 'gfs_rt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  private cookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/',
      expires,
    };
  }

  /** Exchange credentials for an access token; the refresh token is set as an httpOnly cookie. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, refreshExpiresAt, ...result } = await this.auth.login(
      dto.email,
      dto.password,
      req.headers['user-agent'],
    );
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(refreshExpiresAt));
    return result;
  }

  /** Rotate the refresh token and issue a new access token. */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { refreshToken, refreshExpiresAt, ...result } = await this.auth.refresh(
        req.cookies?.[REFRESH_COOKIE],
        req.headers['user-agent'],
      );
      res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(refreshExpiresAt));
      return result;
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

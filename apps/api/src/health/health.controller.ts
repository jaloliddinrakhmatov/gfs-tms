import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness + dependency check for load balancers / k8s probes. */
  @Public()
  @Get()
  async check() {
    const [db, cache] = await Promise.allSettled([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
    const status = {
      status: db.status === 'fulfilled' && cache.status === 'fulfilled' ? 'ok' : 'degraded',
      database: db.status === 'fulfilled' ? 'up' : 'down',
      redis: cache.status === 'fulfilled' ? 'up' : 'down',
      uptimeSeconds: Math.round(process.uptime()),
    };
    if (status.status !== 'ok') throw new ServiceUnavailableException(status);
    return status;
  }
}

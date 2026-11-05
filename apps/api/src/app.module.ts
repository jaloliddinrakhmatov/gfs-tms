import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CommonModule } from './common/common.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppConfig } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { CustomersModule } from './customers/customers.module';
import { FleetModule } from './fleet/fleet.module';
import { HealthController } from './health/health.controller';
import { LocationsController } from './locations/locations.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    CommonModule,
    RealtimeModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const url = new URL(config.get('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
            maxRetriesPerRequest: null,
          },
          prefix: 'gfs',
        };
      },
    }),
    AuthModule,
    ShipmentsModule,
    TrackingModule,
    BillingModule,
    FleetModule,
    CustomersModule,
    AnalyticsModule,
  ],
  controllers: [HealthController, LocationsController],
  providers: [
    // Order matters: throttle → authenticate → authorize
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}

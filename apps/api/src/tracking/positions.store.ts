import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import type { VehiclePosition } from '../realtime/realtime.service';

const KEY = 'tms:positions';

/** Latest known vehicle positions, kept in a Redis hash so every API instance shares them. */
@Injectable()
export class PositionsStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async all(): Promise<VehiclePosition[]> {
    const raw = await this.redis.hvals(KEY);
    return raw.map((r) => JSON.parse(r) as VehiclePosition);
  }

  async replace(positions: VehiclePosition[]) {
    const pipeline = this.redis.multi();
    const keep = new Set(positions.map((p) => p.vehicleId));
    const existing = await this.redis.hkeys(KEY);
    const stale = existing.filter((k) => !keep.has(k));
    if (stale.length) pipeline.hdel(KEY, ...stale);
    if (positions.length) {
      pipeline.hset(KEY, Object.fromEntries(positions.map((p) => [p.vehicleId, JSON.stringify(p)])));
    }
    await pipeline.exec();
  }
}

import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter backed by Redis pub/sub so events broadcast from any API instance
 * reach clients connected to every other instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
    private readonly corsOrigin: string,
  ) {
    super(app);
  }

  async connectToRedis() {
    const pub = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
    const sub = pub.duplicate();
    await Promise.all([
      new Promise((resolve) => pub.once('ready', resolve)),
      new Promise((resolve) => sub.once('ready', resolve)),
    ]);
    this.adapterConstructor = createAdapter(pub, sub);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin.split(','), credentials: true },
      transports: ['websocket', 'polling'],
    });
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}

import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SIMULATOR_ENABLED: bool,
  SIMULATOR_TICK_MS: z.coerce.number().int().min(250).default(2000),
  SIMULATOR_TIME_SCALE: z.coerce.number().positive().default(30),
  SIMULATOR_AUTOPILOT: bool,
  ROUTING_PROVIDER: z.enum(['osrm', 'estimate']).default('estimate'),
  OSRM_URL: z.string().url().default('https://router.project-osrm.org'),
});

export type Env = z.infer<typeof envSchema>;

/** Fail fast on boot with a readable message if configuration is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

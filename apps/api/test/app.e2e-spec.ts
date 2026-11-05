import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * End-to-end tests against a real PostgreSQL + Redis (see `.env.test`).
 * `pnpm test:e2e` migrates and seeds the test database first.
 */
describe('GFS TMS API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  const tokens: Record<string, string> = {};

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Demo1234!' })
      .expect(200);
    return res;
  }
  const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
    for (const role of ['dispatcher', 'accountant', 'driver']) {
      tokens[role] = (await login(`${role}@gfs.demo`)).body.accessToken;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('platform', () => {
    it('GET /api/health reports dependencies', async () => {
      const res = await http.get('/api/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up', redis: 'up' });
    });

    it('rejects requests without a token', () => http.get('/api/shipments').expect(401));

    it('validates and whitelists request bodies', async () => {
      const res = await http
        .post('/api/shipments')
        .set(auth('dispatcher'))
        .send({ originCode: 'CHI', destinationCode: 'DAL', weightLbs: -5, hacker: true })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(/hacker should not exist|weightLbs/);
    });
  });

  describe('auth', () => {
    it('rejects wrong credentials', () =>
      http.post('/api/auth/login').send({ email: 'dispatcher@gfs.demo', password: 'wrong-pass' }).expect(401));

    it('sets an httpOnly refresh cookie and rotates it', async () => {
      const res = await login('admin@gfs.demo');
      const cookie = res.headers['set-cookie'][0] as string;
      expect(cookie).toMatch(/gfs_rt=.+HttpOnly/i);

      const refreshed = await http.post('/api/auth/refresh').set('Cookie', cookie.split(';')[0]).expect(200);
      expect(refreshed.body.accessToken).toBeDefined();

      // Re-using the original (now rotated) cookie is treated as token theft
      await http.post('/api/auth/refresh').set('Cookie', cookie.split(';')[0]).expect(401);
      const newCookie = (refreshed.headers['set-cookie'][0] as string).split(';')[0];
      await http.post('/api/auth/refresh').set('Cookie', newCookie).expect(401);
    });

    it('GET /api/auth/me returns the current user', async () => {
      const res = await http.get('/api/auth/me').set(auth('dispatcher')).expect(200);
      expect(res.body).toMatchObject({ email: 'dispatcher@gfs.demo', role: 'DISPATCHER' });
    });
  });

  describe('RBAC', () => {
    it('drivers cannot tender loads', () =>
      http.post('/api/shipments/quote').set(auth('driver')).send({ originCode: 'CHI', destinationCode: 'DAL' }).expect(403));

    it('accountants cannot dispatch', () =>
      http.get('/api/fleet/availability').set(auth('accountant')).expect(403));

    it('drivers only see their own loads', async () => {
      const me = await http.get('/api/auth/me').set(auth('driver')).expect(200);
      const res = await http.get('/api/shipments?pageSize=100').set(auth('driver')).expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((s: { driver: { id: string } }) => s.driver?.id === me.body.driverId)).toBe(true);
    });
  });

  describe('shipments', () => {
    it('paginates, filters and sorts the load board', async () => {
      const res = await http
        .get('/api/shipments?status=DELIVERED&pageSize=5&sortBy=rateCents&sortDir=desc')
        .set(auth('dispatcher'))
        .expect(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta.total).toBeGreaterThan(5);
      const rates = res.body.data.map((s: { rateCents: number }) => s.rateCents);
      expect([...rates].sort((a, b) => b - a)).toEqual(rates);
      expect(res.body.data.every((s: { status: string }) => s.status === 'DELIVERED')).toBe(true);
    });

    it('runs the full lifecycle: tender → dispatch → pickup → deliver → invoice', async () => {
      const customer = await prisma.customer.findFirstOrThrow();
      const created = await http
        .post('/api/shipments')
        .set(auth('dispatcher'))
        .send({
          customerId: customer.id,
          originCode: 'ATL',
          destinationCode: 'CLT',
          equipment: 'DRY_VAN',
          priority: 'STANDARD',
          commodity: 'E2E test freight',
          weightLbs: 20_000,
          pickupAt: new Date(Date.now() + 3_600_000).toISOString(),
          deliveryBy: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(201);
      const id = created.body.id as string;
      expect(created.body).toMatchObject({ status: 'PENDING', origin: { code: 'ATL' } });
      expect(created.body.rateCents).toBeGreaterThan(0);

      // Cannot deliver a load that has not been picked up
      await http.patch(`/api/shipments/${id}/status`).set(auth('dispatcher')).send({ status: 'DELIVERED' }).expect(409);

      const avail = await http.get('/api/fleet/availability?equipment=DRY_VAN').set(auth('dispatcher')).expect(200);
      const driver = avail.body.drivers[0];
      const vehicle = avail.body.vehicles.find((v: { capacityLbs: number }) => v.capacityLbs >= 20_000);
      await http
        .post(`/api/shipments/${id}/assign`)
        .set(auth('dispatcher'))
        .send({ driverId: driver.id, vehicleId: vehicle.id })
        .expect(201);

      await http.patch(`/api/shipments/${id}/status`).set(auth('dispatcher')).send({ status: 'IN_TRANSIT' }).expect(200);
      const delivered = await http
        .patch(`/api/shipments/${id}/status`)
        .set(auth('dispatcher'))
        .send({ status: 'DELIVERED' })
        .expect(200);
      expect(delivered.body.status).toBe('DELIVERED');

      // The BullMQ worker generates the invoice asynchronously
      let invoice = null;
      for (let i = 0; i < 40 && !invoice; i++) {
        invoice = await prisma.invoice.findUnique({ where: { shipmentId: id } });
        if (!invoice) await new Promise((r) => setTimeout(r, 250));
      }
      expect(invoice).not.toBeNull();
      expect(invoice!.totalCents).toBe(invoice!.lineHaulCents + invoice!.fuelSurchargeCents + invoice!.accessorialCents);

      const detail = await http.get(`/api/shipments/${id}`).set(auth('dispatcher')).expect(200);
      expect(detail.body.events.map((e: { type: string }) => e.type)).toEqual(
        expect.arrayContaining(['CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED']),
      );

      // Resources are released after delivery
      const drv = await prisma.driver.findUniqueOrThrow({ where: { id: driver.id } });
      expect(drv.status).toBe('AVAILABLE');
    });

    it('prevents double-booking a driver', async () => {
      const busy = await prisma.shipment.findFirstOrThrow({ where: { status: 'IN_TRANSIT' } });
      const pending = await prisma.shipment.findFirstOrThrow({ where: { status: 'PENDING', equipment: 'DRY_VAN' } });
      const vehicle = await prisma.vehicle.findFirstOrThrow({
        where: { equipment: 'DRY_VAN', status: 'IDLE', shipments: { none: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } } },
      });
      const res = await http
        .post(`/api/shipments/${pending.id}/assign`)
        .set(auth('dispatcher'))
        .send({ driverId: busy.driverId, vehicleId: vehicle.id })
        .expect(409);
      expect(res.body.message).toMatch(/already on load/);
    });
  });

  describe('billing', () => {
    it('records payments idempotently and blocks over-payment', async () => {
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { status: 'ISSUED', paidCents: 0 } });
      const key = `e2e-${Date.now()}`;
      const body = { amountCents: 1_000, method: 'ACH', reference: 'E2E-1' };

      const first = await http.post(`/api/invoices/${invoice.id}/payments`).set(auth('accountant')).set('Idempotency-Key', key).send(body).expect(201);
      const replay = await http.post(`/api/invoices/${invoice.id}/payments`).set(auth('accountant')).set('Idempotency-Key', key).send(body).expect(201);
      expect(first.body.replayed).toBe(false);
      expect(replay.body.replayed).toBe(true);
      expect(replay.body.invoice.paidCents).toBe(1_000); // applied once

      // Same key, different payload → conflict
      await http.post(`/api/invoices/${invoice.id}/payments`).set(auth('accountant')).set('Idempotency-Key', key).send({ ...body, amountCents: 2_000 }).expect(409);

      // Over-payment is rejected
      await http
        .post(`/api/invoices/${invoice.id}/payments`)
        .set(auth('accountant'))
        .set('Idempotency-Key', `${key}-big`)
        .send({ ...body, amountCents: invoice.totalCents * 2 })
        .expect(400);

      // Missing key
      await http.post(`/api/invoices/${invoice.id}/payments`).set(auth('accountant')).send(body).expect(400);
    });

    it('only accountants can record payments', async () => {
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { status: 'ISSUED' } });
      await http
        .post(`/api/invoices/${invoice.id}/payments`)
        .set(auth('dispatcher'))
        .set('Idempotency-Key', `e2e-dispatcher-${Date.now()}`)
        .send({ amountCents: 100, method: 'ACH' })
        .expect(403);
    });

    it('returns an AR aging summary', async () => {
      const res = await http.get('/api/invoices/summary').set(auth('accountant')).expect(200);
      const { aging, outstandingCents } = res.body;
      expect(aging.current + aging.d1_30 + aging.d31_60 + aging.d60plus).toBe(outstandingCents);
    });
  });

  describe('analytics', () => {
    it('returns dashboard KPIs and a 30-day series', async () => {
      const res = await http.get('/api/analytics/overview').set(auth('dispatcher')).expect(200);
      expect(res.body.kpis.onTimeRate).toBeGreaterThan(0);
      expect(res.body.revenueSeries).toHaveLength(30);
      expect(res.body.topLanes.length).toBeGreaterThan(0);
    });
  });
});

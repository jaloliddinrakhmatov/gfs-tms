/* eslint-disable no-console */
/**
 * Seeds a realistic demo network: 90 days of delivered history (with invoices and payments),
 * live in-transit loads on real road routes, a load board of pending freight, and a fleet.
 * Deterministic (seeded PRNG) so every run produces the same dataset.
 */
import { type Equipment, Prisma, PrismaClient, type Priority, type Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { RoutingService } from '../src/common/geo/routing.service';
import { quoteRate } from '../src/common/money';
import { buildInvoiceAmounts } from '../src/billing/invoice-calc';
import routes from './data/routes.json';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.now();

// ───────────── deterministic random ─────────────
let seed = 20261106;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

// ───────────── reference data ─────────────
const LANES = Object.keys(routes).flatMap((k) => {
  const [a, b] = k.split('-');
  return [`${a}-${b}`, `${b}-${a}`];
});

const COMMODITIES: Record<Equipment, string[]> = {
  DRY_VAN: ['Packaged foods', 'Consumer electronics', 'Paper products', 'Auto parts', 'Retail merchandise', 'Canned beverages', 'Household goods', 'Building materials'],
  REEFER: ['Fresh produce', 'Frozen poultry', 'Dairy products', 'Pharmaceuticals', 'Frozen seafood', 'Floral'],
  FLATBED: ['Steel coils', 'Lumber', 'Construction machinery', 'Steel pipe', 'Precast concrete'],
};

const CUSTOMERS = [
  { name: 'Northwind Foods', contactName: 'Laura Bennett', cityCode: 'CHI', paymentTermsDays: 30 },
  { name: 'Apex Building Supply', contactName: 'Marcus Hill', cityCode: 'DAL', paymentTermsDays: 45 },
  { name: 'BlueRiver Electronics', contactName: 'Priya Natarajan', cityCode: 'LAX', paymentTermsDays: 30 },
  { name: 'Summit Steel Co.', contactName: 'Greg Kowalski', cityCode: 'PIT', paymentTermsDays: 60 },
  { name: 'FreshField Produce', contactName: 'Ana Morales', cityCode: 'LRD', paymentTermsDays: 15 },
  { name: 'Keystone Auto Parts', contactName: 'Derek Shaw', cityCode: 'CMH', paymentTermsDays: 30 },
  { name: 'Coastal Pharma Logistics', contactName: 'Hannah Lee', cityCode: 'EWR', paymentTermsDays: 30 },
  { name: 'Prairie Paper Mills', contactName: 'Tom Lindqvist', cityCode: 'MKC', paymentTermsDays: 45 },
  { name: 'Lone Star Beverages', contactName: 'Rosa Delgado', cityCode: 'HOU', paymentTermsDays: 30 },
  { name: 'Evergreen Home Goods', contactName: 'Nathan Brooks', cityCode: 'SEA', paymentTermsDays: 30 },
  { name: 'Magnolia Retail Group', contactName: 'Claire Dubois', cityCode: 'ATL', paymentTermsDays: 30 },
];

const DRIVER_NAMES = [
  'Carlos Rivera', 'James Walker', 'Aisha Johnson', 'Mike Thompson', 'Dmitri Volkov', 'Sofia Martinez',
  'Jamal Carter', 'Erik Hansen', 'Linda Nguyen', 'Robert King', 'Tanya Brooks', 'Omar Haddad',
  'Kevin O\'Brien', 'Maria Gonzalez', 'Darnell Price', 'Yuki Tanaka', 'Brian Foster', 'Rustam Karimov',
  'Grace Kim', 'Victor Petrov',
];

const TRUCKS = [
  ['Freightliner', 'Cascadia'],
  ['Volvo', 'VNL 860'],
  ['Kenworth', 'T680'],
  ['Peterbilt', '579'],
  ['International', 'LT625'],
  ['Mack', 'Anthem'],
] as const;

const EQUIPMENT_MIX: Equipment[] = [
  ...Array<Equipment>(13).fill('DRY_VAN'),
  ...Array<Equipment>(5).fill('REEFER'),
  ...Array<Equipment>(4).fill('FLATBED'),
];
const CAPACITY: Record<Equipment, number> = { DRY_VAN: 45_000, REEFER: 43_500, FLATBED: 48_000 };
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

function laneRoute(lane: string) {
  const [a, b] = lane.split('-');
  const r = RoutingService.fromCache(a, b);
  if (!r) throw new Error(`Missing cached route ${lane}`);
  return r;
}

function rateFor(distanceMeters: number, equipment: Equipment, priority: Priority) {
  const q = quoteRate({ distanceMeters, equipment, priority });
  return Math.round((q.totalCents * between(0.9, 1.12)) / 100) * 100; // whole dollars
}

async function reset() {
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.shipmentEvent.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.driver.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.sequence.deleteMany(),
  ]);
}

async function main() {
  console.log('🌱 Seeding GFS TMS demo data…');
  await reset();

  // ───────────── users ─────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 10);
  const userSpecs: { email: string; name: string; role: Role }[] = [
    { email: 'admin@gfs.demo', name: 'Alex Morgan', role: 'ADMIN' },
    { email: 'dispatcher@gfs.demo', name: 'Sarah Chen', role: 'DISPATCHER' },
    { email: 'accountant@gfs.demo', name: 'Michael Ross', role: 'ACCOUNTANT' },
    { email: 'driver@gfs.demo', name: 'Carlos Rivera', role: 'DRIVER' },
  ];
  const users = await Promise.all(
    userSpecs.map((u) => prisma.user.create({ data: { ...u, passwordHash, lastLoginAt: new Date(NOW - int(1, 48) * HOUR) } })),
  );
  const [, dispatcher, accountant, driverUser] = users;

  // ───────────── customers ─────────────
  const customers = await Promise.all(
    CUSTOMERS.map((c) =>
      prisma.customer.create({
        data: {
          ...c,
          email: `ap@${c.name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
          phone: `(${int(200, 989)}) 555-${String(int(1000, 9999))}`,
          createdAt: new Date(NOW - int(120, 400) * DAY),
        },
      }),
    ),
  );
  // Weighted toward a few large accounts, as in real freight books
  const customerWeights = customers.flatMap((c, i) => Array(i < 4 ? 4 : i < 8 ? 2 : 1).fill(c));

  // ───────────── drivers & vehicles ─────────────
  const drivers = await Promise.all(
    DRIVER_NAMES.map((name, i) =>
      prisma.driver.create({
        data: {
          name,
          phone: `(${int(200, 989)}) 555-${String(int(1000, 9999))}`,
          licenseNumber: `CDL-${pick(['IL', 'TX', 'GA', 'OH', 'TN', 'CA'])}-${String(int(1000000, 9999999))}`,
          rating: +between(4.3, 5).toFixed(1),
          hosHoursLeft: +between(2, 11).toFixed(1),
          status: i >= 18 ? 'OFF_DUTY' : 'AVAILABLE',
          userId: i === 0 ? driverUser.id : null,
          createdAt: new Date(NOW - int(60, 900) * DAY),
        },
      }),
    ),
  );

  const vehicles = await Promise.all(
    EQUIPMENT_MIX.map((equipment, i) => {
      const [make, model] = TRUCKS[i % TRUCKS.length];
      return prisma.vehicle.create({
        data: {
          unitNumber: `TRK-${1040 + i * 3}`,
          make,
          model,
          year: int(2019, 2025),
          plate: `${pick(['IL', 'TX', 'IN', 'OH'])} ${String.fromCharCode(65 + int(0, 25))}${int(10000, 99999)}`,
          vin: `1${['F', 'V', 'K', 'P', 'H', 'M'][i % 6]}U${Array.from({ length: 14 }, () => pick(VIN_CHARS.split(''))).join('')}`,
          equipment,
          capacityLbs: CAPACITY[equipment],
          status: i === 7 || i === 16 ? 'MAINTENANCE' : 'IDLE',
          odometerMi: int(42_000, 610_000),
          fuelPct: int(18, 100),
          driverId: i < drivers.length - 2 ? drivers[i].id : null, // default truck pairing
        },
      });
    }),
  );

  // ───────────── shipments ─────────────
  let shipmentSeq = 0;
  let invoiceSeq = 0;
  const nextRef = () => `GFS-${100000 + ++shipmentSeq}`;

  type EventSpec = { type: Prisma.ShipmentEventCreateManyInput['type']; message: string; at: Date; actorId?: string | null };

  async function createShipment(opts: {
    lane: string;
    equipment: Equipment;
    status: Prisma.ShipmentCreateInput['status'];
    createdAt: Date;
    pickupAt: Date;
    deliveryBy: Date;
    pickedUpAt?: Date | null;
    deliveredAt?: Date | null;
    progress?: number;
    driverIdx?: number;
    vehicleIdx?: number;
    events: (ctx: { driver?: string; truck?: string }) => EventSpec[];
  }) {
    const [originCode, destinationCode] = opts.lane.split('-');
    const route = laneRoute(opts.lane);
    const priority: Priority = chance(0.18) ? 'EXPEDITED' : 'STANDARD';
    const customer = pick(customerWeights);
    const driver = opts.driverIdx !== undefined ? drivers[opts.driverIdx] : undefined;
    const vehicle = opts.vehicleIdx !== undefined ? vehicles[opts.vehicleIdx] : undefined;
    const weightLbs = Math.min(CAPACITY[opts.equipment], Math.round(between(12_000, 44_000) / 100) * 100);

    const shipment = await prisma.shipment.create({
      data: {
        reference: nextRef(),
        customerId: customer.id,
        originCode,
        destinationCode,
        status: opts.status,
        priority,
        equipment: opts.equipment,
        commodity: pick(COMMODITIES[opts.equipment]),
        weightLbs,
        rateCents: rateFor(route.distanceMeters, opts.equipment, priority),
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        route: route.route as unknown as Prisma.InputJsonValue,
        progress: opts.progress ?? (opts.status === 'DELIVERED' ? 1 : 0),
        pickupAt: opts.pickupAt,
        deliveryBy: opts.deliveryBy,
        pickedUpAt: opts.pickedUpAt ?? null,
        deliveredAt: opts.deliveredAt ?? null,
        driverId: driver?.id ?? null,
        vehicleId: vehicle?.id ?? null,
        createdAt: opts.createdAt,
        updatedAt: opts.deliveredAt ?? opts.pickedUpAt ?? opts.createdAt,
      },
      include: { customer: true },
    });

    const events = opts.events({ driver: driver?.name, truck: vehicle?.unitNumber });
    await prisma.shipmentEvent.createMany({
      data: events.map((e) => ({
        shipmentId: shipment.id,
        type: e.type,
        message: e.message,
        actorId: e.actorId === undefined ? dispatcher.id : e.actorId,
        createdAt: e.at,
      })),
    });
    return shipment;
  }

  // 1) Delivered history — 90 days, volume growing over time
  const historyCount = 190;
  // Generate delivery times first and sort them so references and invoice numbers are chronological
  const deliveryTimes = Array.from({ length: historyCount }, () => {
    const skew = Math.pow(rand(), 0.75); // more recent loads
    return NOW - (1 - skew) * 90 * DAY - int(1, 10) * HOUR;
  }).sort((a, b) => a - b);
  for (let i = 0; i < historyCount; i++) {
    const deliveredAt = new Date(deliveryTimes[i]);
    const lane = pick(LANES);
    const route = laneRoute(lane);
    const equipment = pick(EQUIPMENT_MIX);
    const driveMs = route.durationSeconds * 1000 * between(1.15, 1.45);
    const pickedUpAt = new Date(deliveredAt.getTime() - driveMs);
    const pickupAt = new Date(pickedUpAt.getTime() - int(0, 3) * HOUR);
    const createdAt = new Date(pickupAt.getTime() - between(0.5, 4) * DAY);
    const late = chance(0.07);
    const deliveryBy = late
      ? new Date(deliveredAt.getTime() - int(1, 6) * HOUR)
      : new Date(deliveredAt.getTime() + int(2, 20) * HOUR);
    const di = int(0, 17);

    const shipment = await createShipment({
      lane,
      equipment,
      status: 'DELIVERED',
      createdAt,
      pickupAt,
      deliveryBy,
      pickedUpAt,
      deliveredAt,
      driverIdx: di,
      vehicleIdx: di,
      events: ({ driver, truck }) => [
        { type: 'CREATED', message: 'Load tendered via EDI 204', at: createdAt },
        { type: 'ASSIGNED', message: `Dispatched to ${driver} · ${truck}`, at: new Date(createdAt.getTime() + int(1, 8) * HOUR) },
        { type: 'PICKED_UP', message: 'Picked up — en route to consignee', at: pickedUpAt, actorId: drivers[di].userId },
        { type: 'DELIVERED', message: 'Delivered — POD captured', at: deliveredAt, actorId: null },
      ],
    });

    // Invoice issued on delivery
    const amounts = buildInvoiceAmounts(shipment.rateCents, shipment.priority, late);
    const issuedAt = new Date(deliveredAt.getTime() + int(1, 6) * HOUR);
    const dueAt = new Date(issuedAt.getTime() + shipment.customer.paymentTermsDays * DAY);
    const pastDue = dueAt.getTime() < NOW;
    const ageDays = (NOW - issuedAt.getTime()) / DAY;
    // Older invoices are mostly settled; a few slow payers remain overdue
    const paid = pastDue ? chance(0.86) : chance(Math.min(0.6, ageDays / 40));
    const partial = !paid && chance(0.15);
    const paidCents = paid ? amounts.totalCents : partial ? Math.round(amounts.totalCents * 0.5) : 0;
    const paidAt = paid
      ? new Date(Math.min(NOW - HOUR, issuedAt.getTime() + between(0.4, 1.05) * shipment.customer.paymentTermsDays * DAY))
      : null;

    const number = `INV-${issuedAt.getFullYear()}-${String(++invoiceSeq).padStart(5, '0')}`;
    await prisma.invoice.create({
      data: {
        number,
        shipmentId: shipment.id,
        customerId: shipment.customerId,
        ...amounts,
        paidCents,
        status: paid ? 'PAID' : pastDue ? 'OVERDUE' : 'ISSUED',
        issuedAt,
        dueAt,
        paidAt,
        createdAt: issuedAt,
        payments:
          paidCents > 0
            ? {
                create: {
                  amountCents: paidCents,
                  method: pick(['ACH', 'ACH', 'ACH', 'WIRE', 'CHECK'] as const),
                  reference: `${pick(['ACH', 'WT', 'CHK'])}-${int(100000, 999999)}`,
                  idempotencyKey: `seed-${number}`,
                  recordedById: accountant.id,
                  createdAt: paidAt ?? new Date(issuedAt.getTime() + 10 * DAY),
                },
              }
            : undefined,
      },
    });
  }

  // 2) Cancelled loads
  for (let i = 0; i < 6; i++) {
    const createdAt = new Date(NOW - int(2, 60) * DAY);
    await createShipment({
      lane: pick(LANES),
      equipment: pick(EQUIPMENT_MIX),
      status: 'CANCELLED',
      createdAt,
      pickupAt: new Date(createdAt.getTime() + 2 * DAY),
      deliveryBy: new Date(createdAt.getTime() + 4 * DAY),
      events: () => [
        { type: 'CREATED', message: 'Load tendered via EDI 204', at: createdAt },
        { type: 'CANCELLED', message: `Cancelled: ${pick(['Shipper rescheduled', 'Freight not ready', 'Customer cancelled order'])}`, at: new Date(createdAt.getTime() + int(2, 20) * HOUR) },
      ],
    });
  }

  // 3) Live loads — pair available drivers with their default truck (equipment must match)
  const usable = vehicles
    .map((v, i) => ({ v, i }))
    .filter(({ v, i }) => v.status !== 'MAINTENANCE' && i < 18);
  // Leave every 4th crew free so the dispatcher can work the load board in the demo
  const active = usable.filter((_, n) => n % 4 !== 3);
  const inTransitSlots = active.slice(0, 9);
  const assignedSlots = active.slice(9, 12);

  for (const [n, { v, i }] of inTransitSlots.entries()) {
    const lane = LANES[(n * 5 + 3) % LANES.length];
    const route = laneRoute(lane);
    const progress = between(0.08, 0.82);
    const pickedUpAt = new Date(NOW - route.durationSeconds * 1000 * progress * 1.1);
    const createdAt = new Date(pickedUpAt.getTime() - between(0.6, 2.5) * DAY);
    const late = n === 4 || n === 9; // a couple of at-risk loads for the dashboard
    const deliveryBy = new Date(
      pickedUpAt.getTime() + route.durationSeconds * 1000 * (late ? 0.8 : between(1.35, 1.7)),
    );
    await createShipment({
      lane,
      equipment: v.equipment,
      status: 'IN_TRANSIT',
      createdAt,
      pickupAt: new Date(pickedUpAt.getTime() - HOUR),
      deliveryBy,
      pickedUpAt,
      progress,
      driverIdx: i,
      vehicleIdx: i,
      events: ({ driver, truck }) => [
        { type: 'CREATED', message: 'Load tendered via customer portal', at: createdAt },
        { type: 'ASSIGNED', message: `Dispatched to ${driver} · ${truck}`, at: new Date(createdAt.getTime() + int(1, 6) * HOUR) },
        { type: 'PICKED_UP', message: 'Picked up — en route to consignee', at: pickedUpAt, actorId: drivers[i].userId },
      ],
    });
    await prisma.driver.update({ where: { id: drivers[i].id }, data: { status: 'ON_DUTY' } });
    await prisma.vehicle.update({ where: { id: v.id }, data: { status: 'ACTIVE' } });
  }

  for (const [n, { v, i }] of assignedSlots.entries()) {
    const lane = LANES[(n * 7 + 11) % LANES.length];
    const route = laneRoute(lane);
    const createdAt = new Date(NOW - between(3, 20) * HOUR);
    const pickupAt = new Date(NOW + int(2, 30) * HOUR);
    await createShipment({
      lane,
      equipment: v.equipment,
      status: 'ASSIGNED',
      createdAt,
      pickupAt,
      deliveryBy: new Date(pickupAt.getTime() + route.durationSeconds * 1000 * 1.5),
      driverIdx: i,
      vehicleIdx: i,
      events: ({ driver, truck }) => [
        { type: 'CREATED', message: 'Load tendered via EDI 204', at: createdAt },
        { type: 'ASSIGNED', message: `Dispatched to ${driver} · ${truck}`, at: new Date(createdAt.getTime() + HOUR) },
      ],
    });
    await prisma.driver.update({ where: { id: drivers[i].id }, data: { status: 'ON_DUTY' } });
    await prisma.vehicle.update({ where: { id: v.id }, data: { status: 'ACTIVE' } });
  }

  // 4) Load board — pending freight awaiting dispatch
  for (let n = 0; n < 11; n++) {
    const lane = LANES[(n * 3 + 17) % LANES.length];
    const route = laneRoute(lane);
    const createdAt = new Date(NOW - between(0.2, 30) * HOUR);
    const pickupAt = new Date(NOW + int(6, 96) * HOUR);
    await createShipment({
      lane,
      equipment: pick(EQUIPMENT_MIX),
      status: 'PENDING',
      createdAt,
      pickupAt,
      deliveryBy: new Date(pickupAt.getTime() + route.durationSeconds * 1000 * between(1.4, 1.9)),
      events: () => [{ type: 'CREATED', message: pick(['Load tendered via EDI 204', 'Load tendered via customer portal', 'Load entered by dispatcher']), at: createdAt }],
    });
  }

  await prisma.sequence.createMany({
    data: [
      { key: 'shipment', value: shipmentSeq },
      { key: `invoice-${new Date().getFullYear()}`, value: invoiceSeq },
    ],
  });

  const counts = await prisma.shipment.groupBy({ by: ['status'], _count: { _all: true } });
  console.log('✅ Seed complete');
  console.table(Object.fromEntries(counts.map((c) => [c.status, c._count._all])));
  console.log('\nDemo logins (password: Demo1234!)');
  console.table(userSpecs.map(({ email, role }) => ({ email, role })));
}

async function run() {
  if (process.env.SEED_IF_EMPTY === 'true' && (await prisma.user.count()) > 0) {
    console.log('Database already seeded — skipping (SEED_IF_EMPTY=true)');
    return;
  }
  await main();
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

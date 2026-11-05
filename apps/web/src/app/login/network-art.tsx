import { Activity, ShieldCheck, Zap } from 'lucide-react';
import { Spotlight } from '@/components/fx/spotlight';

// Simple equirectangular projection of the continental US into a 1000×620 canvas
const project = (lat: number, lng: number) => [((lng + 125) / 58) * 1000, ((50 - lat) / 26) * 620] as const;

const CITIES = {
  SEA: project(47.6, -122.3),
  LAX: project(34.05, -118.24),
  PHX: project(33.45, -112.07),
  SLC: project(40.76, -111.89),
  DEN: project(39.74, -104.99),
  DAL: project(32.78, -96.8),
  HOU: project(29.76, -95.37),
  MKC: project(39.1, -94.58),
  CHI: project(41.88, -87.63),
  MEM: project(35.15, -90.05),
  ATL: project(33.75, -84.39),
  CMH: project(39.96, -83),
  CLT: project(35.23, -80.84),
  EWR: project(40.74, -74.17),
  JAX: project(30.33, -81.66),
  LRD: project(27.53, -99.48),
};

type Code = keyof typeof CITIES;
const ROUTES: [Code, Code][] = [
  ['CHI', 'DAL'], ['LAX', 'PHX'], ['SEA', 'SLC'], ['DEN', 'MKC'], ['ATL', 'HOU'], ['EWR', 'CLT'],
  ['LRD', 'CHI'], ['MEM', 'CMH'], ['JAX', 'MEM'], ['SLC', 'DEN'], ['PHX', 'DAL'], ['CLT', 'JAX'], ['CMH', 'EWR'],
];
const HUBS: Code[] = ['CHI', 'DAL', 'ATL', 'LAX', 'EWR', 'DEN'];

function arc([x1, y1]: readonly [number, number], [x2, y2]: readonly [number, number]) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const k = 0.18;
  return `M${x1},${y1} Q${mx - dy * k},${my + dx * k} ${x2},${y2}`;
}

const DRAW_MS = 1400;

export function NetworkArt() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0b0d1f] lg:block">
      {/* drifting glow + grid */}
      <div className="absolute -left-40 -top-40 size-[640px] animate-[drift_18s_ease-in-out_infinite_alternate] rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="absolute -bottom-48 right-0 size-[560px] animate-[drift_22s_ease-in-out_-6s_infinite_alternate-reverse] rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="absolute left-1/3 top-1/2 size-[380px] animate-[drift_26s_ease-in-out_-12s_infinite_alternate] rounded-full bg-fuchsia-600/10 blur-[110px]" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        }}
      />
      <Spotlight size={520} color="rgb(129 140 248 / 0.16)" />

      <div className="relative flex h-full flex-col justify-between p-12 text-white">
        <div className="stagger max-w-md">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-indigo-200 backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live network · 22 terminals
          </p>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
            Every load, truck and invoice —<br />
            <span className="text-shimmer">in one real-time console.</span>
          </h2>
        </div>

        <svg viewBox="0 0 1000 620" className="my-6 w-full" aria-hidden>
          <defs>
            <linearGradient id="route" x1="0" x2="1">
              <stop offset="0" stopColor="#818cf8" stopOpacity="0.1" />
              <stop offset="0.5" stopColor="#a5b4fc" stopOpacity="0.9" />
              <stop offset="1" stopColor="#c4b5fd" stopOpacity="0.1" />
            </linearGradient>
            <radialGradient id="node">
              <stop offset="0" stopColor="#c7d2fe" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {ROUTES.map(([a, b], i) => {
            const d = arc(CITIES[a], CITIES[b]);
            const delay = 300 + i * 90;
            return (
              <g key={`${a}-${b}`}>
                {/* route draws itself in, then the traffic starts flowing */}
                <path
                  d={d}
                  fill="none"
                  stroke="url(#route)"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                  pathLength={1}
                  strokeDasharray="1"
                  style={{ animation: `draw ${DRAW_MS}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms backwards` }}
                />
                <g style={{ animation: `fade-in 600ms ease-out ${delay + DRAW_MS * 0.7}ms backwards` }}>
                  <path d={d} fill="none" stroke="#a5b4fc" strokeWidth="2" strokeDasharray="6 14" strokeLinecap="round">
                    <animate attributeName="stroke-dashoffset" from="200" to="0" dur={`${6 + (i % 5)}s`} repeatCount="indefinite" />
                  </path>
                  <circle r="4" fill="#fff" filter="url(#glow)">
                    <animateMotion dur={`${9 + (i % 6) * 1.5}s`} repeatCount="indefinite" path={d} />
                  </circle>
                </g>
              </g>
            );
          })}
          {Object.entries(CITIES).map(([code, [x, y]], i) => (
            <g key={code} style={{ animation: `fade-in 500ms ease-out ${150 + i * 50}ms backwards` }}>
              {HUBS.includes(code as Code) && (
                <circle cx={x} cy={y} r="4" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeOpacity="0">
                  <animate attributeName="r" values="4;22" dur="2.8s" begin={`${(i % 6) * 0.45}s`} repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.8;0" dur="2.8s" begin={`${(i % 6) * 0.45}s`} repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={x} cy={y} r="16" fill="url(#node)" opacity="0.5" />
              <circle cx={x} cy={y} r="3.5" fill="#e0e7ff" />
              <text x={x + 9} y={y - 8} fill="#c7d2fe" fillOpacity="0.55" fontSize="13" fontFamily="var(--font-geist-mono)">
                {code}
              </text>
            </g>
          ))}
        </svg>

        <div className="stagger grid grid-cols-3 gap-3 [&>*:nth-child(1)]:[animation-delay:700ms] [&>*:nth-child(2)]:[animation-delay:800ms] [&>*:nth-child(3)]:[animation-delay:900ms]">
          {[
            { icon: Activity, label: 'Live GPS', value: 'Socket.IO stream' },
            { icon: Zap, label: 'Auto invoicing', value: 'BullMQ workers' },
            { icon: ShieldCheck, label: 'Secure access', value: 'JWT rotation · RBAC' },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition duration-500 hover:-translate-y-1 hover:border-indigo-300/30 hover:bg-white/[0.07]"
            >
              <Icon className="size-4 text-indigo-300 transition-transform duration-500 group-hover:scale-125" />
              <p className="mt-3 text-sm font-medium">{label}</p>
              <p className="text-xs text-indigo-200/60">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

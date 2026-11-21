import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { DogName, DogPose } from '../modules/lounge/logic';
import type { Trick } from './worldLogic';
import '../styles/dogs.css';

/** Every way the dogs can be drawn. The day decides sleep/rest/proud; scenes add the rest. */
export type AnyPose = DogPose | 'walk' | 'play' | 'beg';

/**
 * Cooper (a black lab with big, heavy hound ears and a red collar) and Shadow (a smaller,
 * scruffier lab–terrier mix with half-up ears and a blue collar), drawn in SVG. Both are black,
 * so their fur is shaded with a cool sheen along the back and a warm rim of lamplight.
 * Each faces left, standing on y=0; place them with a transform on a parent <g>.
 *
 * `playful`: clicking makes the dog hop into a play bow for a moment (with a heart) before
 * settling back, and `onClick` still fires.
 */
export function Dog({ who, pose, onClick, playful = false, grey = 0, tricks = [], onTrick }: {
  who: DogName; pose: AnyPose; onClick?: () => void; playful?: boolean;
  /** 0–1: how grey the muzzle has gone over the years. */
  grey?: number;
  /** Tricks this dog knows; a playful click sometimes shows one off. */
  tricks?: Trick[];
  onTrick?: (t: Trick) => void;
}) {
  const cooper = who === 'cooper';
  const id = useId().replace(/:/g, '');
  const [hop, setHop] = useState(0);
  const [trick, setTrick] = useState<Trick | null>(null);
  useEffect(() => {
    if (!hop) return;
    const t = setTimeout(() => { setHop(0); setTrick(null); }, 1700);
    return () => clearTimeout(t);
  }, [hop]);
  const shown: AnyPose = trick ? (trick === 'shake' ? 'proud' : trick === 'howl' ? 'proud' : 'walk') : hop && playful ? 'play' : pose;
  const click = () => {
    if (playful) {
      // Show off a trick about half the time once some are learned; otherwise a play bow.
      if (tricks.length && Math.random() < 0.6) {
        const t = tricks[Math.floor(Math.random() * tricks.length)];
        setTrick(t);
        onTrick?.(t);
      }
      setHop(Date.now());
    }
    onClick?.();
  };
  const fur = `url(#fur-${id})`;
  const ear = `url(#ear-${id})`;

  return (
    <g className={`dog dog-${who} pose-${shown}${hop ? ' hopping' : ''}${trick ? ` trick-${trick}` : ''}`} style={{ '--grey': grey } as CSSProperties} onClick={onClick || playful ? click : undefined}
      role={onClick || playful ? 'button' : undefined} tabIndex={onClick || playful ? 0 : undefined}
      aria-label={onClick || playful ? (cooper ? 'Cooper' : 'Shadow') : undefined}
      onKeyDown={(e) => { if ((onClick || playful) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); click(); } }}>
      <title>{cooper ? 'Cooper' : 'Shadow'}</title>
      <defs>
        <linearGradient id={`fur-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cooper ? '#2c2c36' : '#30303a'} />
          <stop offset=".45" stopColor="#15151b" />
          <stop offset="1" stopColor="#0a0a0d" />
        </linearGradient>
        <linearGradient id={`ear-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24242c" />
          <stop offset="1" stopColor="#101015" />
        </linearGradient>
      </defs>
      <ellipse className="dog-ground" cx="4" cy="0" rx={shown === 'proud' || shown === 'beg' ? 34 : 60} ry="5" />
      <g className="dog-bob"><g transform={cooper ? undefined : 'scale(.8)'}>
        {shown === 'sleep' && <Sleeping cooper={cooper} fur={fur} ear={ear} />}
        {shown === 'rest' && <Resting cooper={cooper} fur={fur} ear={ear} />}
        {shown === 'proud' && <Sitting cooper={cooper} fur={fur} ear={ear} />}
        {shown === 'beg' && <Sitting cooper={cooper} fur={fur} ear={ear} beg />}
        {shown === 'walk' && <Walking cooper={cooper} fur={fur} ear={ear} />}
        {shown === 'play' && <PlayBow cooper={cooper} fur={fur} ear={ear} />}
      </g></g>
      {hop ? <text key={hop} className="dog-heart" x="-20" y={cooper ? -96 : -80}>{trick === 'howl' ? '\u266a' : '\u2665'}</text> : null}
    </g>
  );
}

type P = { cooper: boolean; fur: string; ear: string };

/* ---------- shared parts ---------- */

/** Cooper's heavy hound ear swings; Shadow's half-up terrier ear perks. */
function Ear({ cooper, ear, x, y, down = false, rot = 0 }: { cooper: boolean; ear: string; x: number; y: number; down?: boolean; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g className={cooper ? 'ear-hound' : 'ear-terrier'}>
        {cooper ? (
          <path fill={ear} className="dog-ear"
            d={down ? 'M-5 -6 C10 -12 26 -2 24 16 C23 28 12 33 4 27 C-3 21 -8 6 -5 -6 Z' : 'M-6 -4 C8 -10 18 4 16 24 C15 36 5 40 -1 32 C-6 24 -9 8 -6 -4 Z'} />
        ) : (
          <path fill={ear} className="dog-ear" d={down ? 'M-2 -2 L11 -9 L10 5 Z' : 'M-3 1 L4 -15 L11 -2 L7 -5 L5 2 Z'} />
        )}
        {cooper && <path className="dog-ear-sheen" d={down ? 'M2 -4 C12 -6 18 2 18 10' : 'M0 -2 C8 -4 12 6 11 18'} />}
      </g>
    </g>
  );
}

const Scruff = ({ x, y }: { x: number; y: number }) => (
  <path className="dog-scruff" transform={`translate(${x} ${y})`} d="M0 0 l-3 5 l3 -1 l-1 6 l3 -3 l1 5 l2 -6 l2 4 l0 -6 l2 2" />
);

function Collar({ cooper, x, y, r = 0 }: { cooper: boolean; x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-3" y="-9" width="6" height="18" rx="3" className={cooper ? 'collar c-red' : 'collar c-blue'} />
      <circle cx="0" cy="11" r="2.6" className="tag" />
    </g>
  );
}

/** A head facing left at (x,y); `tilt` rotates it, `shut` closes the eyes. */
function Head({ cooper, fur, ear, x, y, tilt = 0, shut = false, earDown = false }: P & { x: number; y: number; tilt?: number; shut?: boolean; earDown?: boolean }) {
  const snout = cooper ? 'M-8 -8 C-20 -6 -32 0 -32 6 C-32 11 -26 13 -16 12 L-2 10 Z' : 'M-8 -6 C-18 -4 -28 0 -28 5 C-28 10 -22 11 -14 10 L-2 8 Z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <circle r="15" fill={fur} className="dog-body" />
      <path d={snout} fill={fur} className="dog-body" />
      <path d={snout} className="dog-muzzle" />
      <path className="dog-sheen" d="M-6 -12 C0 -15 8 -13 11 -8" />
      <circle className="dog-nose" cx={cooper ? -30 : -26} cy="5" r="3.2" />
      <circle className="dog-nose-shine" cx={cooper ? -31 : -27} cy="3.8" r=".9" />
      {shut ? <path className="dog-eye-shut" d="M-11 -4 q4 3 8 0" /> : (
        <g className="dog-eyes"><circle className="dog-eye" cx="-7" cy="-4" r="2.1" /><circle className="dog-eye-shine" cx="-7.6" cy="-4.7" r=".7" /></g>
      )}
      {!cooper && <><Scruff x={-22} y={9} /><path className="dog-brow" d="M-12 -9 l7 -3" /><path className="dog-brow" d="M-4 -12 l3 -4" /></>}
      <Ear cooper={cooper} ear={ear} x={3} y={-10} down={earDown} />
    </g>
  );
}

/** A leg from the hip (0,0) down to the ground at `len`, with a paw. Animated in the walk. */
const Leg = ({ fur, x, y, len, cls = '' }: { fur: string; x: number; y: number; len: number; cls?: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <g className={`dog-leg ${cls}`}>
      <path fill={fur} className="dog-body" d={`M-4 0 L-3.5 ${len - 4} C-3.5 ${len} 4 ${len} 4 ${len - 4} L4 0 Z`} />
      <ellipse fill={fur} className="dog-body" cx="-2" cy={len - 1.5} rx="6" ry="2.6" />
    </g>
  </g>
);

const BackSheen = ({ d }: { d: string }) => <path className="dog-sheen" d={d} />;

function Tail({ fur, d, wag = true }: { fur: string; d: string; wag?: boolean }) {
  return <path fill={fur} className={`dog-tail${wag ? ' wag' : ''}`} d={d} />;
}

/* ---------- poses ---------- */

function Resting({ cooper, fur, ear }: P) {
  return (
    <g>
      <Tail fur={fur} d={cooper ? 'M50 -16 C66 -14 80 -8 88 -2 C82 -2 70 -6 50 -10 Z' : 'M46 -16 C56 -22 62 -28 66 -34 C64 -26 58 -16 48 -10 Z'} />
      <ellipse fill={fur} className="dog-body" cx="10" cy="-18" rx="44" ry="17" />
      <ellipse fill={fur} className="dog-body" cx="38" cy="-20" rx="19" ry="17" />
      <path fill={fur} className="dog-body" d="M-24 -10 L-62 -8 C-66 -8 -66 -1 -62 -1 L-20 -1 Z" />
      <path fill={fur} className="dog-body" d="M-22 -14 L-56 -14 C-60 -14 -60 -8 -56 -8 L-20 -8 Z" />
      <ellipse fill={fur} className="dog-body" cx="-22" cy="-28" rx="16" ry="15" />
      <BackSheen d="M-14 -34 C4 -38 30 -38 52 -32" />
      {!cooper && <path className="dog-scruff" d="M-30 -40 l-3 -5 l4 1 l-1 -5 l4 3 l1 -5 l3 5" />}
      <Collar cooper={cooper} x={-22} y={-30} r={-20} />
      <Head cooper={cooper} fur={fur} ear={ear} x={-34} y={-42} />
    </g>
  );
}

function Sleeping({ cooper, fur, ear }: P) {
  return (
    <g>
      <g className="dog-breathe">
        <Tail fur={fur} wag={false} d={cooper ? 'M44 -6 C30 2 0 4 -24 0 C-4 -2 24 -4 40 -10 Z' : 'M40 -8 C30 -2 14 0 0 -2 C14 -5 28 -8 36 -12 Z'} />
        <ellipse fill={fur} className="dog-body" cx="6" cy="-17" rx="42" ry="17" />
        <ellipse fill={fur} className="dog-body" cx="30" cy="-19" rx="18" ry="17" />
        <path fill={fur} className="dog-body" d="M-20 -8 L-58 -6 C-62 -6 -62 0 -58 0 L-18 0 Z" />
        <BackSheen d="M-10 -30 C8 -35 30 -35 46 -28" />
        <Collar cooper={cooper} x={-20} y={-18} r={-70} />
        <Head cooper={cooper} fur={fur} ear={ear} x={-34} y={-14} tilt={8} shut earDown />
      </g>
      <g className="zzz"><text x="-30" y="-40">z</text><text x="-22" y="-52">z</text><text x="-12" y="-66">Z</text></g>
    </g>
  );
}

function Sitting({ cooper, fur, ear, beg = false }: P & { beg?: boolean }) {
  return (
    <g>
      <Tail fur={fur} d={cooper ? 'M18 -4 C32 -2 46 -4 56 -10 C50 -2 36 4 16 2 Z' : 'M18 -8 C26 -16 30 -24 32 -32 C34 -22 30 -12 20 -2 Z'} />
      <ellipse fill={fur} className="dog-body" cx="12" cy="-20" rx="22" ry="20" />
      <ellipse fill={fur} className="dog-body" cx="0" cy="-46" rx="17" ry="30" transform="rotate(-14 0 -46)" />
      {beg ? (
        <>
          <path fill={fur} className="dog-body" d="M-12 -58 C-22 -56 -28 -50 -26 -44 C-24 -40 -18 -42 -14 -48 Z" />
          <path fill={fur} className="dog-body" d="M-2 -56 C-12 -52 -16 -46 -14 -40 C-12 -36 -6 -38 -2 -46 Z" />
          <path fill={fur} className="dog-body" d="M-24 -1 L2 -1 L2 -8 L-22 -8 Z" />
        </>
      ) : (
        <>
          <path fill={fur} className="dog-body" d="M-16 -44 L-18 -3 C-18 1 -10 1 -10 -3 L-8 -40 Z" />
          <path fill={fur} className="dog-body" d="M-6 -42 L-6 -3 C-6 1 2 1 2 -3 L4 -38 Z" />
          <path fill={fur} className="dog-body" d="M-24 -1 L-10 -1 L-10 -6 L-22 -6 Z M-12 -1 L2 -1 L2 -6 L-10 -6 Z" />
        </>
      )}
      <BackSheen d="M4 -70 C9 -60 12 -50 16 -42" />
      {!cooper && <path className="dog-scruff" d="M-14 -60 l-4 -2 l3 -2 l-4 -3 l4 -1 l-2 -4 l4 1" />}
      <Collar cooper={cooper} x={-4} y={-66} r={-10} />
      <Head cooper={cooper} fur={fur} ear={ear} x={-12} y={-80} tilt={beg ? -12 : 0} />
    </g>
  );
}

function Walking({ cooper, fur, ear }: P) {
  return (
    <g className="dog-trot">
      <Leg fur={fur} x={34} y={-40} len={40} cls="leg-b2" />
      <Leg fur={fur} x={-22} y={-40} len={40} cls="leg-f2" />
      <Tail fur={fur} d={cooper ? 'M46 -46 C60 -52 72 -56 80 -66 C78 -54 66 -44 48 -38 Z' : 'M44 -48 C52 -58 56 -66 56 -76 C60 -64 56 -50 46 -40 Z'} />
      <ellipse fill={fur} className="dog-body" cx="8" cy="-40" rx="40" ry="15" />
      <ellipse fill={fur} className="dog-body" cx="34" cy="-42" rx="16" ry="15" />
      <ellipse fill={fur} className="dog-body" cx="-22" cy="-40" rx="16" ry="15" />
      <ellipse fill={fur} className="dog-body" cx="-32" cy="-54" rx="10" ry="14" transform="rotate(-28 -32 -54)" />
      <Leg fur={fur} x={40} y={-40} len={40} cls="leg-b1" />
      <Leg fur={fur} x={-16} y={-40} len={40} cls="leg-f1" />
      <BackSheen d="M-20 -52 C0 -56 24 -56 46 -52" />
      {!cooper && <path className="dog-scruff" d="M-12 -54 l-2 -5 l4 2 l0 -5 l3 4 l2 -5 l2 5" />}
      <Collar cooper={cooper} x={-32} y={-56} r={-30} />
      <Head cooper={cooper} fur={fur} ear={ear} x={-44} y={-66} tilt={-6} />
    </g>
  );
}

function PlayBow({ cooper, fur, ear }: P) {
  return (
    <g>
      <Tail fur={fur} d={cooper ? 'M44 -56 C52 -70 58 -82 70 -92 C68 -78 60 -62 48 -48 Z' : 'M42 -56 C46 -68 46 -78 44 -88 C52 -76 54 -62 46 -48 Z'} />
      <Leg fur={fur} x={26} y={-42} len={42} />
      <Leg fur={fur} x={38} y={-42} len={42} />
      <ellipse fill={fur} className="dog-body" cx="32" cy="-46" rx="17" ry="16" />
      <ellipse fill={fur} className="dog-body" cx="4" cy="-32" rx="38" ry="14" transform="rotate(18 4 -32)" />
      <path fill={fur} className="dog-body" d="M-22 -10 L-62 -8 C-66 -8 -66 -1 -62 -1 L-18 -1 Z" />
      <path fill={fur} className="dog-body" d="M-20 -14 L-56 -14 C-60 -14 -60 -8 -56 -8 L-18 -8 Z" />
      <Collar cooper={cooper} x={-22} y={-22} r={-30} />
      <Head cooper={cooper} fur={fur} ear={ear} x={-34} y={-28} tilt={-4} />
    </g>
  );
}

/** A dog that trots back and forth along a stretch of ground (Home's homestead path). */
export function Patrol({ children, dist, dur, delay = 0 }: { children: ReactNode; dist: number; dur: number; delay?: number }) {
  return (
    <g className="patrol" style={{ '--dist': `${dist}px`, animationDuration: `${dur}s`, animationDelay: `${delay}s` } as CSSProperties}>{children}</g>
  );
}

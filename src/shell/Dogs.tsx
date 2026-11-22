import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { DogName, DogPose } from '../modules/lounge/logic';
import type { Trick } from './worldLogic';
import '../styles/dogs.css';

/** Every way the dogs can be drawn. The day decides sleep/rest/proud; scenes add the rest. */
export type AnyPose = DogPose | 'walk' | 'play' | 'beg';

/**
 * Cooper (Austin's black lab: deep chest, otter tail, and big, heavy hound ears; red collar) and
 * Shadow (a smaller, scruffier lab–terrier mix with wiry brows, a beard and half-up ears; blue collar),
 * painted in SVG. Both are black, so the fur is modelled with soft radial gradients (a cool sheen
 * along the back, falling to near-black at the belly) and a warm rim of lamplight; the eyes are brown
 * with a lamp glint. Each faces left, standing on y=0; place them with a transform on a parent <g>.
 *
 * Ambient life (breathing, blinking, an ear twitch, the tail) is CSS-only and stops under reduced motion.
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
  // React 19 ids contain characters (« ») that break url(#…) references: keep only the safe ones.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
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
  const p: P = { cooper, fur: `url(#fur-${id})`, ear: `url(#ear-${id})`, far: `url(#far-${id})` };
  const sitting = shown === 'proud' || shown === 'beg';

  return (
    <g className={`dog dog-${who} pose-${shown}${hop ? ' hopping' : ''}${trick ? ` trick-${trick}` : ''}`} style={{ '--grey': grey } as CSSProperties} onClick={onClick || playful ? click : undefined}
      role={onClick || playful ? 'button' : undefined} tabIndex={onClick || playful ? 0 : undefined}
      aria-label={onClick || playful ? (cooper ? 'Cooper' : 'Shadow') : undefined}
      onKeyDown={(e) => { if ((onClick || playful) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); click(); } }}>
      <title>{cooper ? 'Cooper' : 'Shadow'}</title>
      <defs>
        {/* the coat: light catches the top of every form and falls away underneath */}
        <radialGradient id={`fur-${id}`} cx=".5" cy=".18" r=".85" fx=".45" fy=".1">
          <stop offset="0" stopColor={cooper ? '#4a4a58' : '#4c4642'} />
          <stop offset=".38" stopColor={cooper ? '#22222b' : '#26221f'} />
          <stop offset=".78" stopColor="#101014" />
          <stop offset="1" stopColor="#070709" />
        </radialGradient>
        <radialGradient id={`far-${id}`} cx=".5" cy=".2" r=".9">
          <stop offset="0" stopColor="#1c1c23" />
          <stop offset="1" stopColor="#060608" />
        </radialGradient>
        <linearGradient id={`ear-${id}`} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor={cooper ? '#2e2e38' : '#332e2b'} />
          <stop offset=".5" stopColor="#15151a" />
          <stop offset="1" stopColor="#09090c" />
        </linearGradient>
        <radialGradient id={`sh-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset=".65" stopColor="#000" stopOpacity=".2" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`iris-${id}`} cx=".45" cy=".4">
          <stop offset="0" stopColor="#8a5222" />
          <stop offset=".7" stopColor="#4a2810" />
          <stop offset="1" stopColor="#1a0d05" />
        </radialGradient>
      </defs>
      <ellipse className="dog-ground" fill={`url(#sh-${id})`} cx={sitting ? 8 : 6} cy="0" rx={sitting ? 40 : 68} ry="6" />
      <g className="dog-bob"><g transform={cooper ? undefined : 'scale(.8)'}>
        {shown === 'sleep' && <Sleeping {...p} iris={`url(#iris-${id})`} />}
        {shown === 'rest' && <Resting {...p} iris={`url(#iris-${id})`} />}
        {shown === 'proud' && <Sitting {...p} iris={`url(#iris-${id})`} />}
        {shown === 'beg' && <Sitting {...p} iris={`url(#iris-${id})`} beg />}
        {shown === 'walk' && <Walking {...p} iris={`url(#iris-${id})`} />}
        {shown === 'play' && <PlayBow {...p} iris={`url(#iris-${id})`} />}
      </g></g>
      {hop ? <text key={hop} className="dog-heart" x="-20" y={cooper ? -104 : -86}>{trick === 'howl' ? '♪' : '♥'}</text> : null}
    </g>
  );
}

type P = { cooper: boolean; fur: string; ear: string; far: string };
type PI = P & { iris: string };

/* ---------- shared parts ---------- */

/** Cooper's heavy hound ear hangs long and swings; Shadow's half-up terrier ear perks and folds at the tip. */
function Ear({ cooper, ear, x, y, down = false }: { cooper: boolean; ear: string; x: number; y: number; down?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={cooper ? 'ear-hound' : 'ear-terrier'}>
        {cooper ? (
          down ? (
            <>
              <path fill={ear} className="dog-ear" d="M-6 -4 C6 -10 22 -6 28 6 C33 16 28 24 18 23 C10 22 2 16 -2 8 C-5 3 -8 -1 -6 -4 Z" />
              <path className="dog-ear-fold" d="M0 0 C8 2 16 8 22 18" />
              <path className="dog-ear-sheen" d="M-2 -4 C8 -7 18 -3 24 4" />
            </>
          ) : (
            <>
              <path fill={ear} className="dog-ear" d="M-6 -2 C2 -7 14 -2 15 12 C16 25 12 33 4 32 C-3 31 -6 24 -7 14 C-8 6 -9 1 -6 -2 Z" />
              <path className="dog-ear-fold" d="M-2 1 C4 4 8 14 7 27" />
              <path className="dog-ear-sheen" d="M-1 -3 C7 -4 11 4 11 14" />
            </>
          )
        ) : down ? (
          <>
            <path fill={ear} className="dog-ear" d="M-4 -2 C2 -9 10 -10 13 -6 C14 -2 11 3 8 5 Z" />
            <path className="dog-ear-sheen" d="M-1 -4 C3 -7 8 -8 11 -6" />
          </>
        ) : (
          <>
            <path fill={ear} className="dog-ear" d="M-5 0 C-5 -8 -2 -16 3 -20 C6 -22 8 -19 8 -16 L9 -3 Z" />
            {/* the folded-over tip */}
            <path fill={ear} className="dog-ear tip" d="M3 -20 C-1 -19 -4 -15 -4 -11 L2 -14 C4 -15 5 -17 3 -20 Z" />
            <path className="dog-ear-sheen" d="M5 -18 C6 -12 7 -8 7 -4" />
          </>
        )}
      </g>
    </g>
  );
}

function Collar({ cooper, x, y, r = 0 }: { cooper: boolean; x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-3" y="-10" width="6.5" height="20" rx="3" className={cooper ? 'collar c-red' : 'collar c-blue'} />
      <path d="M-1.6 -8.5 V8.5" className="collar-hi" />
      <circle cx="0.4" cy="12" r="2.8" className="tag" />
      <circle cx="-0.3" cy="11.2" r=".9" className="tag-hi" />
    </g>
  );
}

/** A head facing left at (x,y); `tilt` rotates it, `shut` closes the eyes. */
function Head({ cooper, fur, ear, iris, x, y, tilt = 0, shut = false, earDown = false }: PI & { x: number; y: number; tilt?: number; shut?: boolean; earDown?: boolean }) {
  const skull = cooper
    ? 'M12 -2 C12 -12 4 -17 -4 -17 C-11 -17 -15 -13 -17 -9 C-21 -8 -28 -6 -33 -3 C-37 -1 -38 4 -36 7 C-34 10 -30 11 -26 11 C-22 13 -14 14 -6 13 C4 12 12 8 12 -2 Z'
    : 'M11 -2 C11 -12 4 -16 -3 -16 C-10 -16 -14 -12 -15 -8 C-19 -7 -25 -5 -28 -2 C-31 1 -31 5 -29 7 C-27 9 -23 10 -20 10 C-15 12 -8 13 -2 12 C6 11 11 6 11 -2 Z';
  const muzzle = cooper
    ? 'M-17 -9 C-21 -8 -28 -6 -33 -3 C-37 -1 -38 4 -36 7 C-34 10 -30 11 -26 11 C-22 12 -16 12 -12 10 C-12 2 -14 -6 -17 -9 Z'
    : 'M-15 -8 C-19 -7 -25 -5 -28 -2 C-31 1 -31 5 -29 7 C-27 9 -23 10 -20 10 C-16 11 -12 11 -10 9 C-10 2 -12 -5 -15 -8 Z';
  const ex = cooper ? -9 : -8, ey = cooper ? -6 : -5;
  const nx = cooper ? -35 : -28.5, ny = cooper ? 1 : 1.6;
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <g className="dog-head">
        <path d={skull} fill={fur} className="dog-body" />
        <path d={muzzle} className="dog-muzzle" />
        <path className="dog-sheen" d={cooper ? 'M-5 -16 C3 -17 9 -13 11 -7' : 'M-4 -15 C3 -16 8 -12 10 -7'} />
        <path className="dog-sheen soft" d={cooper ? 'M-16 -10 C-22 -8 -29 -5 -33 -2' : 'M-14 -9 C-19 -7 -24 -5 -27 -2'} />
        <path className="dog-lip" d={cooper ? 'M-34 8 C-28 9.5 -20 9.5 -13 7' : 'M-27 7 C-22 8.5 -16 8.5 -11 6.5'} />
        {/* nose, wet and catching the light */}
        <ellipse className="dog-nose" cx={nx} cy={ny} rx={cooper ? 3.6 : 3.2} ry={cooper ? 3 : 2.7} />
        <ellipse className="dog-nose-shine" cx={nx - 0.6} cy={ny - 1.4} rx="1.3" ry=".7" />
        {shut ? <path className="dog-eye-shut" d={`M${ex - 3.5} ${ey + 0.5} q3.5 2.6 7 0`} /> : (
          <g className="dog-eyes">
            <path className="dog-brow-hi" d={`M${ex - 4} ${ey - 3} q4 -2.6 8 0`} />
            <ellipse cx={ex} cy={ey} rx="2.7" ry="2.3" fill={iris} className="dog-eye" />
            <circle className="dog-pupil" cx={ex - 0.3} cy={ey} r="1.3" />
            <circle className="dog-eye-shine" cx={ex - 1} cy={ey - 0.9} r=".8" />
            <circle className="dog-eye-shine dim" cx={ex + 1} cy={ey + 1} r=".35" />
          </g>
        )}
        {!cooper && (
          <g className="dog-wire">
            <path d="M-28 7 l-1 4 l2 -2 l0 4 l2 -3 l1 4 l1 -4 l2 3 l0 -4 l2 2 l-0.5 -4" className="dog-beard" />
            <path d="M-13 -10 l-3 -3 M-10.5 -11 l-1.5 -4 M-7.5 -11 l0 -4 M-5 -10.5 l1.5 -3.5" className="dog-brow" />
            <path d="M8 -12 l3 -3 M10 -8 l4 -1 M11 -3 l4 1" className="dog-brow" />
          </g>
        )}
        <Ear cooper={cooper} ear={ear} x={cooper ? 4 : 1} y={cooper ? -10 : -13} down={earDown} />
      </g>
    </g>
  );
}

/** A leg from the hip (0,0) down to the ground at `len`, with a paw. `back` gives it a thigh and a hock. */
function Leg({ fur, x, y, len, cls = '', back = false }: { fur: string; x: number; y: number; len: number; cls?: string; back?: boolean }) {
  const L = len;
  const d = back
    ? `M-9 -4 C-10 ${L * 0.3} -3 ${L * 0.45} -1 ${L * 0.58} L-3 ${L - 5} L4.5 ${L - 5} L7 ${L * 0.52} C10 ${L * 0.36} 10 ${L * 0.1} 9 -4 Z`
    : `M-5 -2 C-5.5 ${L * 0.45} -4 ${L * 0.75} -4 ${L - 5} L4 ${L - 5} C4 ${L * 0.7} 5 ${L * 0.4} 6 -2 Z`;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`dog-leg ${cls}`}>
        <path fill={fur} className="dog-body" d={d} />
        <path fill={fur} className="dog-body" d={`M-9 ${L} C-10 ${L - 4} -6 ${L - 6.5} -1 ${L - 6} L4.5 ${L - 6} C6.5 ${L - 4} 6.5 ${L} 4 ${L} Z`} />
        <path className="dog-toes" d={`M-6 ${L - 0.5} v-1.8 M-3 ${L - 0.5} v-2`} />
      </g>
    </g>
  );
}

function Tail({ fur, d, wag = true }: { fur: string; d: string; wag?: boolean }) {
  return <path fill={fur} className={`dog-tail${wag ? ' wag' : ''}`} d={d} />;
}

/** Short strokes of coat: a few hairs catching light (and wire on Shadow). */
const Hair = ({ d }: { d: string }) => <path className="dog-hair" d={d} />;
const Scruff = ({ d }: { d: string }) => <path className="dog-scruff" d={d} />;

/* ---------- poses ---------- */

function Resting(p: PI) {
  const { cooper, fur, far } = p;
  return (
    <g>
      <Tail fur={fur} d={cooper ? 'M52 -16 C66 -14 80 -8 88 -2 C82 -1 70 -4 52 -8 Z' : 'M50 -18 C58 -24 63 -30 66 -38 C66 -28 60 -18 52 -10 Z'} />
      <path fill={far} d="M-22 -15 L-54 -14 C-59 -14 -59 -8 -54 -8 L-20 -8 Z" />
      <g className="dog-breathe">
        <path fill={fur} className="dog-body" d="M-32 -34 C-20 -42 4 -40 22 -40 C40 -42 56 -34 58 -20 C59 -8 52 -1 42 -1 L-22 -1 C-32 -2 -38 -10 -38 -20 C-38 -26 -36 -31 -32 -34 Z" />
        <path fill={fur} className="dog-body" d="M22 -36 C38 -42 54 -32 54 -18 C54 -8 46 -2 34 -2 C26 -2 18 -6 16 -14 C14 -24 16 -32 22 -36 Z" />
        <path className="dog-crease" d="M24 -30 C32 -32 41 -25 40 -13" />
        <path className="dog-crease" d="M-26 -6 C-10 -4 8 -4 18 -6" />
        <path className="dog-sheen" d="M-26 -38 C-6 -42 20 -42 46 -36" />
        <Hair d="M30 -26 l3 -2 M36 -20 l3 -1 M-18 -24 l2 -3 M-10 -30 l3 -2" />
      </g>
      <path fill={fur} className="dog-body" d="M14 -1 L34 -1 C36 -5 30 -8 22 -7 Z" />
      <path fill={fur} className="dog-body" d="M-24 -12 L-60 -9 C-66 -9 -66 -1 -60 -1 L-20 -1 Z" />
      <path fill={fur} className="dog-body" d="M-40 -24 C-44 -38 -42 -52 -32 -58 L-18 -52 C-16 -42 -18 -30 -24 -20 Z" />
      <path className="dog-sheen soft" d="M-41 -30 C-42 -40 -40 -48 -34 -54" />
      {!cooper && <Scruff d="M-38 -38 l-3 -3 l4 0 l-2 -4 l4 2 M-30 -56 l-2 -4 l3 1 l0 -4 l3 3" />}
      <Collar cooper={cooper} x={-33} y={-48} r={-24} />
      <Head {...p} x={-38} y={-60} />
    </g>
  );
}

function Sleeping(p: PI) {
  const { cooper, fur } = p;
  return (
    <g>
      <g className="dog-breathe">
        <Tail fur={fur} wag={false} d={cooper ? 'M44 -6 C30 2 0 4 -24 0 C-4 -2 24 -4 40 -10 Z' : 'M40 -8 C30 -2 14 0 0 -2 C14 -5 28 -8 36 -12 Z'} />
        <path fill={fur} className="dog-body" d="M-28 -10 C-24 -28 -2 -34 18 -33 C38 -33 50 -24 48 -12 C47 -3 38 0 26 0 L-20 0 C-28 0 -31 -5 -28 -10 Z" />
        <path fill={fur} className="dog-body" d="M16 -30 C32 -36 48 -26 48 -13 C47 -3 38 0 28 0 C18 -2 12 -12 12 -20 C12 -25 13 -28 16 -30 Z" />
        <path className="dog-crease" d="M17 -26 C26 -28 36 -22 36 -10" />
        <path className="dog-sheen" d="M-16 -28 C2 -34 26 -35 42 -27" />
        <Hair d="M0 -22 l3 -2 M8 -26 l3 -1 M28 -18 l3 -1" />
        {!cooper && <Scruff d="M-10 -30 l-1 -4 l3 2 l0 -4 l3 3 l1 -4 l2 4" />}
        <path fill={fur} className="dog-body" d="M-20 -6 L-58 -4 C-63 -4 -63 2 -58 2 L-18 1 Z" />
        <Collar cooper={cooper} x={-20} y={-16} r={-70} />
        <Head {...p} x={-36} y={-12} tilt={8} shut earDown />
      </g>
      <g className="zzz"><text x="-30" y="-40">z</text><text x="-22" y="-52">z</text><text x="-12" y="-66">Z</text></g>
    </g>
  );
}

function Sitting(p: PI & { beg?: boolean }) {
  const { cooper, fur, far, beg = false } = p;
  return (
    <g>
      <Tail fur={fur} d={cooper ? 'M30 -4 C44 -2 56 -4 64 -10 C58 -2 44 3 28 2 Z' : 'M30 -8 C38 -16 42 -24 44 -32 C46 -22 42 -12 32 -2 Z'} />
      {!beg && (
        <>
          <path fill={far} d="M-8 -40 C-8 -28 -7 -14 -6 -5 L1 -5 C1 -16 2 -28 3 -38 Z" />
          <path fill={far} d="M-10 0 C-11 -3 -8 -5.5 -4 -5 L2 -5 C3.5 -3 3.5 0 1.5 0 Z" />
        </>
      )}
      <path fill={fur} className="dog-body" d="M-6 -4 C-8 -24 2 -40 18 -40 C32 -40 38 -26 36 -12 C35 -4 28 0 18 0 L-4 0 Z" />
      <path className="dog-crease" d="M4 -30 C16 -34 28 -26 28 -10" />
      <path fill={fur} className="dog-body" d="M2 -1 L26 -1 C28 -5 24 -8 16 -7 L4 -7 Z" />
      <g className="dog-breathe">
        <path fill={fur} className="dog-body" d="M-22 -48 C-24 -64 -16 -76 -4 -76 C8 -76 16 -64 18 -48 C20 -34 14 -22 4 -18 C-6 -16 -16 -26 -20 -38 Z" />
        <path className="dog-sheen" d="M-2 -74 C8 -70 14 -60 16 -46" />
        <path className="dog-sheen soft" d="M-20 -58 C-22 -48 -20 -38 -15 -30" />
        <Hair d="M-14 -44 l-2 3 M-10 -38 l-2 3 M-16 -52 l-2 2" />
        {!cooper && <Scruff d="M-20 -50 l-4 -1 l3 -2 l-4 -3 l4 -1 l-2 -4 l4 1 M-18 -36 l-4 1 l3 1 l-3 3 l4 -1" />}
      </g>
      {beg ? (
        <>
          <path fill={fur} className="dog-body" d="M-14 -56 C-22 -56 -28 -50 -27 -44 C-26 -40 -20 -41 -16 -46 Z" />
          <path fill={fur} className="dog-body" d="M-4 -54 C-12 -50 -16 -44 -14 -40 C-12 -36 -6 -38 -2 -46 Z" />
          <path fill={fur} className="dog-body" d="M-24 -1 L2 -1 L2 -8 L-22 -8 Z" />
        </>
      ) : (
        <>
          <path fill={fur} className="dog-body" d="M-19 -42 C-20 -30 -20 -16 -19 -5 L-11 -5 C-11 -16 -10 -28 -9 -40 Z" />
          <path fill={fur} className="dog-body" d="M-23 0 C-24 -3 -21 -5.5 -16.5 -5 L-10.5 -5 C-9 -3 -9 0 -11 0 Z" />
          <path className="dog-toes" d="M-21 -0.5 v-1.8 M-18 -0.5 v-2" />
        </>
      )}
      <Collar cooper={cooper} x={-4} y={-70} r={-8} />
      <Head {...p} x={-10} y={-86} tilt={beg ? -12 : 0} />
    </g>
  );
}

function Walking(p: PI) {
  const { cooper, fur, far } = p;
  return (
    <g className="dog-trot">
      <Leg fur={far} x={22} y={-40} len={40} cls="leg-b2" back />
      <Leg fur={far} x={-22} y={-40} len={40} cls="leg-f2" />
      <Tail fur={fur} d={cooper ? 'M36 -52 C48 -56 58 -60 66 -70 C67 -62 61 -53 52 -49 C46 -46 42 -45 38 -45 Z' : 'M34 -52 C40 -60 44 -68 44 -78 C48 -66 45 -52 36 -44 Z'} />
      <path fill={fur} className="dog-body" d="M-32 -60 C-20 -63 -2 -60 14 -60 C26 -60 38 -56 40 -46 C42 -36 37 -30 30 -29 C24 -29 18 -32 12 -33 C2 -32 -8 -30 -16 -28 C-25 -26 -32 -30 -36 -38 C-39 -46 -38 -56 -32 -60 Z" />
      <path fill={fur} className="dog-body" d="M-44 -74 C-48 -64 -44 -52 -34 -46 L-22 -56 C-26 -64 -32 -72 -36 -78 Z" />
      <path className="dog-crease" d="M20 -56 C30 -54 36 -44 32 -32" />
      <path className="dog-crease" d="M-16 -29 C-2 -32 8 -33 16 -33" />
      <path className="dog-sheen" d="M-28 -61 C-8 -63 12 -62 30 -58" />
      <path className="dog-sheen soft" d="M-42 -66 C-44 -58 -42 -50 -36 -46" />
      <Hair d="M26 -48 l3 -2 M30 -42 l3 -1 M-30 -44 l-1 3 M-24 -40 l-1 3" />
      <Leg fur={fur} x={28} y={-40} len={40} cls="leg-b1" back />
      <Leg fur={fur} x={-16} y={-40} len={40} cls="leg-f1" />
      {!cooper && <Scruff d="M-14 -60 l-2 -5 l4 2 l0 -5 l3 4 l2 -5 l2 5 M14 -61 l1 -4 l2 3 l2 -4 l1 4" />}
      <Collar cooper={cooper} x={-36} y={-60} r={-34} />
      <Head {...p} x={-48} y={-74} tilt={-6} />
    </g>
  );
}

function PlayBow(p: PI) {
  const { cooper, fur, far } = p;
  return (
    <g>
      <Tail fur={fur} d={cooper ? 'M48 -56 C54 -70 60 -82 72 -92 C70 -78 62 -62 52 -50 Z' : 'M46 -56 C48 -68 48 -78 46 -88 C54 -76 56 -62 48 -50 Z'} />
      <Leg fur={far} x={26} y={-42} len={42} back />
      <path fill={far} d="M-20 -14 L-56 -14 C-60 -14 -60 -8 -56 -8 L-18 -8 Z" />
      <path fill={fur} className="dog-body" d="M-30 -16 C-22 -30 -2 -42 22 -56 C34 -62 50 -58 52 -46 C53 -36 46 -31 36 -30 C18 -24 0 -12 -14 -8 C-22 -6 -32 -8 -30 -16 Z" />
      <Leg fur={fur} x={38} y={-42} len={42} back />
      <path className="dog-sheen" d="M-22 -26 C-4 -38 16 -52 36 -60" />
      <path fill={fur} className="dog-body" d="M-22 -10 L-62 -8 C-66 -8 -66 -1 -62 -1 L-18 -1 Z" />
      {!cooper && <Scruff d="M0 -40 l-1 -4 l3 2 l0 -4 l3 3 l1 -4 l2 3" />}
      <Collar cooper={cooper} x={-24} y={-20} r={-30} />
      <Head {...p} x={-36} y={-28} tilt={-4} />
    </g>
  );
}

/** A dog that trots back and forth along a stretch of ground (Home's homestead path). */
export function Patrol({ children, dist, dur, delay = 0 }: { children: ReactNode; dist: number; dur: number; delay?: number }) {
  return (
    <g className="patrol" style={{ '--dist': `${dist}px`, animationDuration: `${dur}s`, animationDelay: `${delay}s` } as CSSProperties}>{children}</g>
  );
}

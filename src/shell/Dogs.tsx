import type { DogName, DogPose } from '../modules/lounge/logic';
import '../styles/dogs.css';

/**
 * Cooper (a black lab with big hound ears) and Shadow (a smaller, scruffier lab–terrier mix),
 * drawn in SVG. Both are black, so a warm rim of lamplight picks out their shapes.
 * Each faces left, standing on y=0; place with transform.
 */
export function Dog({ who, pose, onClick }: { who: DogName; pose: DogPose; onClick?: () => void }) {
  const cooper = who === 'cooper';
  return (
    <g className={`dog dog-${who} pose-${pose}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? (cooper ? 'Cooper' : 'Shadow') : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}>
      <title>{cooper ? 'Cooper' : 'Shadow'}</title>
      <ellipse className="dog-shadow" cx="4" cy="0" rx={pose === 'proud' ? 34 : 60} ry="5" />
      {pose === 'sleep' && <Sleeping cooper={cooper} />}
      {pose === 'rest' && <Resting cooper={cooper} />}
      {pose === 'proud' && <Sitting cooper={cooper} />}
    </g>
  );
}

/** Long, heavy hound ear for Cooper; a folded, half-up terrier ear for Shadow. */
const Ear = ({ cooper, x, y, down = false }: { cooper: boolean; x: number; y: number; down?: boolean }) =>
  cooper ? (
    <path className="dog-ear" transform={`translate(${x} ${y})`}
      d={down ? 'M-4 -6 C10 -10 22 0 20 14 C19 24 10 28 4 22 C-2 16 -6 4 -4 -6 Z' : 'M-4 -4 C8 -8 14 4 12 20 C11 30 3 33 -2 26 C-6 18 -7 6 -4 -4 Z'} />
  ) : (
    <path className="dog-ear" transform={`translate(${x} ${y})`} d={down ? 'M-2 -2 L10 -8 L9 4 Z' : 'M-2 0 L5 -14 L10 -3 L6 -6 Z'} />
  );

const Scruff = ({ x, y }: { x: number; y: number }) => (
  <path className="dog-scruff" transform={`translate(${x} ${y})`} d="M0 0 l-3 5 l3 -1 l-1 5 l3 -3 l1 5 l2 -6 l2 3 l0 -6" />
);

function Collar({ cooper, x, y, r = 0 }: { cooper: boolean; x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-3" y="-9" width="6" height="18" rx="3" className={cooper ? 'collar c-red' : 'collar c-blue'} />
      <circle cx="0" cy="11" r="2.6" className="tag" />
    </g>
  );
}

function Resting({ cooper }: { cooper: boolean }) {
  return (
    <g transform={cooper ? undefined : 'scale(.8)'}>
      <path className="dog-tail wag" d={cooper ? 'M50 -16 C66 -14 80 -8 88 -2 C82 -2 70 -6 50 -10 Z' : 'M46 -16 C56 -22 62 -28 66 -34 C64 -26 58 -16 48 -10 Z'} />
      <ellipse className="dog-body" cx="10" cy="-18" rx="44" ry="17" />
      <ellipse className="dog-body" cx="38" cy="-20" rx="19" ry="17" />
      <path className="dog-body" d="M-24 -10 L-62 -8 C-66 -8 -66 -1 -62 -1 L-20 -1 Z" />
      <path className="dog-body" d="M-22 -14 L-56 -14 C-60 -14 -60 -8 -56 -8 L-20 -8 Z" />
      <ellipse className="dog-body" cx="-22" cy="-28" rx="16" ry="15" />
      <circle className="dog-body" cx="-34" cy="-42" r="15" />
      <path className="dog-body" d={cooper ? 'M-42 -50 C-54 -48 -66 -42 -66 -36 C-66 -31 -60 -29 -50 -30 L-36 -32 Z' : 'M-42 -48 C-52 -46 -62 -42 -62 -37 C-62 -32 -56 -31 -48 -32 L-36 -34 Z'} />
      <circle className="dog-nose" cx={cooper ? -64 : -60} cy="-37" r="3" />
      <circle className="dog-eye" cx="-40" cy="-46" r="1.8" />
      {!cooper && <Scruff x={-56} y={-32} />}
      {!cooper && <path className="dog-brow" d="M-44 -51 l6 -2" />}
      <Ear cooper={cooper} x={-30} y={-52} />
      <Collar cooper={cooper} x={-22} y={-30} r={-20} />
    </g>
  );
}

function Sleeping({ cooper }: { cooper: boolean }) {
  return (
    <g transform={cooper ? undefined : 'scale(.8)'}>
      <g className="dog-breathe">
        <path className="dog-tail" d={cooper ? 'M44 -6 C30 2 0 4 -24 0 C-4 -2 24 -4 40 -10 Z' : 'M40 -8 C30 -2 14 0 0 -2 C14 -5 28 -8 36 -12 Z'} />
        <ellipse className="dog-body" cx="6" cy="-17" rx="42" ry="17" />
        <ellipse className="dog-body" cx="30" cy="-19" rx="18" ry="17" />
        <path className="dog-body" d="M-20 -8 L-58 -6 C-62 -6 -62 0 -58 0 L-18 0 Z" />
        <ellipse className="dog-body" cx="-36" cy="-14" rx="17" ry="11" />
        <path className="dog-body" d={cooper ? 'M-44 -20 C-56 -18 -66 -14 -66 -10 C-66 -6 -60 -5 -50 -6 L-38 -8 Z' : 'M-44 -18 C-54 -16 -62 -13 -62 -9 C-62 -6 -56 -5 -48 -6 L-38 -8 Z'} />
        <circle className="dog-nose" cx={cooper ? -64 : -60} cy="-10" r="2.8" />
        <path className="dog-eye-shut" d="M-44 -17 q4 3 8 0" />
        {!cooper && <Scruff x={-56} y={-8} />}
        <Ear cooper={cooper} x={-32} y={-22} down />
        <Collar cooper={cooper} x={-20} y={-18} r={-70} />
      </g>
      <g className="zzz"><text x="-30" y="-36">z</text><text x="-22" y="-48">z</text><text x="-12" y="-62">Z</text></g>
    </g>
  );
}

function Sitting({ cooper }: { cooper: boolean }) {
  return (
    <g transform={cooper ? undefined : 'scale(.8)'}>
      <path className="dog-tail wag" d={cooper ? 'M18 -4 C32 -2 46 -4 56 -10 C50 -2 36 4 16 2 Z' : 'M18 -8 C26 -16 30 -24 32 -32 C34 -22 30 -12 20 -2 Z'} />
      <ellipse className="dog-body" cx="12" cy="-20" rx="22" ry="20" />
      <ellipse className="dog-body" cx="0" cy="-46" rx="17" ry="30" transform="rotate(-14 0 -46)" />
      <path className="dog-body" d="M-16 -44 L-18 -3 C-18 1 -10 1 -10 -3 L-8 -40 Z" />
      <path className="dog-body" d="M-6 -42 L-6 -3 C-6 1 2 1 2 -3 L4 -38 Z" />
      <path className="dog-body" d="M-24 -1 L-10 -1 L-10 -6 L-22 -6 Z M-12 -1 L2 -1 L2 -6 L-10 -6 Z" />
      <circle className="dog-body" cx="-12" cy="-80" r="15" />
      <path className="dog-body" d={cooper ? 'M-20 -88 C-32 -86 -44 -80 -44 -74 C-44 -69 -38 -67 -28 -68 L-14 -70 Z' : 'M-20 -86 C-30 -84 -40 -80 -40 -75 C-40 -70 -34 -69 -26 -70 L-14 -72 Z'} />
      <circle className="dog-nose" cx={cooper ? -42 : -38} cy="-75" r="3" />
      <circle className="dog-eye" cx="-18" cy="-84" r="1.9" />
      {!cooper && <Scruff x={-34} y={-70} />}
      {!cooper && <path className="dog-brow" d="M-22 -89 l6 -2" />}
      <Ear cooper={cooper} x={-8} y={-90} />
      <Collar cooper={cooper} x={-4} y={-66} r={-10} />
    </g>
  );
}

import s from './cover.module.css';

/** Small drawn covers for repos that have no interface to screenshot. */

function MapCover() {
  const rings = [0, 1, 2, 3, 4].map((r) => {
    const rx = 40 + r * 22;
    const ry = 22 + r * 12;
    return <ellipse key={r} cx="210" cy="78" rx={rx} ry={ry} transform={`rotate(${-8 + r * 3} 210 78)`} />;
  });
  return (
    <svg viewBox="0 0 320 150" className={s.svg} data-kind="map">
      <rect width="320" height="150" className={s.bg} />
      <g className={s.contours}>{rings}</g>
      <path className={s.river} d="M-10 120 C 60 100, 90 132, 150 110 S 250 70, 330 92" />
      <path className={s.river} d="M60 -10 C 70 40, 110 60, 150 110" />
      <path className={s.riverThin} d="M250 -10 C 230 30, 260 50, 250 80" />
      {[
        [150, 110],
        [212, 70],
        [96, 58],
      ].map(([x, y]) => (
        <g key={`${x}`} className={s.pin} transform={`translate(${x} ${y})`}>
          <path d="M0 0 C -7 -9, -7 -17, 0 -17 C 7 -17, 7 -9, 0 0 Z" />
          <circle cy="-11" r="2.6" />
        </g>
      ))}
      <rect x="16" y="16" width="92" height="26" rx="8" className={s.chip} />
      <text x="28" y="34" className={s.chipText}>
        Chure region
      </text>
    </svg>
  );
}

function WaveCover() {
  const bars = Array.from({ length: 38 }, (_, i) => {
    const h = 10 + Math.abs(Math.sin(i * 0.55) * 34 + Math.sin(i * 1.7) * 12);
    return <rect key={i} x={24 + i * 7} y={78 - h / 2} width="4" height={h} rx="2" />;
  });
  return (
    <svg viewBox="0 0 320 150" className={s.svg} data-kind="wave">
      <rect width="320" height="150" className={s.bg} />
      <g className={s.bars}>{bars}</g>
      <text x="24" y="132" className={s.mono}>
        /ˈæk.sənt/
      </text>
      <g transform="translate(272 124)" className={s.ring}>
        <circle r="15" className={s.ringTrack} />
        <circle r="15" className={s.ringValue} strokeDasharray="70 95" transform="rotate(-90)" />
      </g>
    </svg>
  );
}

function CodeCover() {
  return (
    <svg viewBox="0 0 320 150" className={s.svg} data-kind="code">
      <rect width="320" height="150" className={s.bg} />
      <rect x="14" y="18" width="130" height="114" rx="10" className={s.pane} />
      <rect x="176" y="18" width="130" height="114" rx="10" className={s.pane} />
      <text x="26" y="40" className={s.tag}>
        python
      </text>
      <text x="188" y="40" className={s.tag}>
        c
      </text>
      <text x="26" y="66" className={s.code}>
        <tspan className={s.kw}>def</tspan> area(r):
      </text>
      <text x="38" y="84" className={s.code}>
        <tspan className={s.kw}>return</tspan> 3.14*r*r
      </text>
      <text x="188" y="66" className={s.code}>
        <tspan className={s.kw}>double</tspan> area(
      </text>
      <text x="196" y="84" className={s.code}>
        <tspan className={s.kw}>double</tspan> r) {'{'}
      </text>
      <text x="200" y="102" className={s.code}>
        <tspan className={s.kw}>return</tspan> 3.14*r*r;
      </text>
      <text x="188" y="120" className={s.code}>
        {'}'}
      </text>
      <path d="M150 75 h 20 m -7 -7 l 7 7 l -7 7" className={s.arrow} />
    </svg>
  );
}

function CatalogueCover() {
  const tiles = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const x = 18 + c * 70;
      const y = 18 + r * 60;
      tiles.push(
        <g key={`${r}${c}`} transform={`translate(${x} ${y})`}>
          <rect width="60" height="50" rx="8" className={s.tile} />
          {(r * 3 + c) % 3 === 0 && <rect x="14" y="22" width="32" height="7" rx="3.5" className={s.part} />}
          {(r * 3 + c) % 3 === 1 && <circle cx="30" cy="25" r="10" className={s.part} />}
          {(r * 3 + c) % 3 === 2 && (
            <g className={s.part}>
              <rect x="18" y="12" width="10" height="26" rx="2" />
              <rect x="32" y="12" width="10" height="26" rx="2" />
            </g>
          )}
        </g>,
      );
    }
  }
  return (
    <svg viewBox="0 0 320 150" className={s.svg} data-kind="catalogue">
      <rect width="320" height="150" className={s.bg} />
      {tiles}
      <g transform="translate(236 34)">
        <rect width="70" height="34" rx="10" className={s.bubbleA} />
        <rect x="-8" y="44" width="70" height="34" rx="10" className={s.bubbleB} />
        <rect x="12" y="14" width="40" height="5" rx="2.5" className={s.line} />
        <rect x="4" y="58" width="44" height="5" rx="2.5" className={s.lineDark} />
      </g>
    </svg>
  );
}

const COVERS = { map: MapCover, wave: WaveCover, code: CodeCover, catalogue: CatalogueCover };

export default function Cover({ kind }) {
  const C = COVERS[kind];
  return C ? (
    <div className={s.cover} aria-hidden="true">
      <C />
    </div>
  ) : null;
}

import { useEffect, useRef } from 'react';
import s from './backdrop.module.css';

/**
 * The quiet layer behind the page: contour lines like the hills around
 * Kathmandu, the stack floating up as bubbles, golf shots arcing across the
 * margins. Everything sits at low contrast and never takes a click.
 * `Signal` is the handwritten note placed beside section headings.
 */

const BUBBLES = [
  ['React', 4, 3, 1.1],
  ['Node.js', 93, 6, 0.9],
  ['Python', 7, 12, 1],
  ['FastAPI', 95, 15, 0.85],
  ['PostgreSQL', 3, 22, 1.15],
  ['three.js', 91, 25, 1],
  ['Docker', 8, 33, 0.85],
  ['LangChain', 94, 36, 1.05],
  ['MCP', 5, 44, 0.8],
  ['Next.js', 92, 47, 0.95],
  ['Flutter', 4, 55, 0.9],
  ['C#', 95, 58, 0.8],
  ['Vulkan', 7, 66, 1],
  ['Ollama', 93, 69, 0.9],
  ['MongoDB', 3, 77, 0.95],
  ['TypeScript', 91, 80, 1.05],
  ['Linux', 6, 88, 0.85],
  ['Figma', 94, 91, 0.9],
];

const ARCS = [
  [9, 17, 'l'],
  [83, 46, 'r'],
  [10, 70, 'l'],
];

const HILLS = [
  [-8, 4, 560],
  [74, 30, 640],
  [-12, 58, 600],
  [70, 82, 560],
];

/** Nested wobbly rings, like a contour map of a hill. */
function Hill({ size, seed }) {
  const rings = [];
  for (let r = 0; r < 8; r++) {
    const base = 40 + r * 34;
    let d = '';
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const wob = Math.sin(a * 3 + seed + r * 0.4) * 9 + Math.sin(a * 5 - seed * 2 + r) * 5;
      const rr = base + wob;
      d += `${i === 0 ? 'M' : 'L'}${(300 + Math.cos(a) * rr).toFixed(1)} ${(300 + Math.sin(a) * rr * 0.82).toFixed(1)}`;
    }
    rings.push(<path key={r} d={`${d}Z`} />);
  }
  return (
    <svg className={s.hill} viewBox="0 0 600 600" width={size} height={size} aria-hidden="true">
      {rings}
    </svg>
  );
}

export default function Backdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--sy', String(window.scrollY));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className={s.backdrop} ref={ref} aria-hidden="true">
      {HILLS.map(([x, y, size], i) => (
        <div key={`h${i}`} className={s.at} style={{ left: `${x}%`, top: `${y}%`, '--k': -0.04 }}>
          <Hill size={size} seed={i * 1.7} />
        </div>
      ))}

      {ARCS.map(([x, y, side], i) => (
        <div key={`a${i}`} className={s.at} style={{ left: `${x}%`, top: `${y}%`, '--k': 0.03 }}>
          <svg className={s.arc} viewBox="0 0 220 120" width="220" height="120" data-side={side}>
            <path d="M8 112 Q 100 -20 196 92" />
            <circle cx="8" cy="112" r="4" />
            <path className={s.pin} d="M196 92 V 62 L 212 68 L 196 74" />
          </svg>
        </div>
      ))}

      {BUBBLES.map(([label, x, y, scale], i) => (
        <span
          key={label}
          className={`${s.at} ${s.bubble}`}
          style={{ left: `${x}%`, top: `${y}%`, '--k': -0.02 - (i % 4) * 0.025, '--s': scale, '--d': `${(i % 5) * -1.7}s` }}
        >
          {label}
        </span>
      ))}

    </div>
  );
}

/** A handwritten margin note with a faint pulsing signal. */
export function Signal({ children, rot = -3, className = '' }) {
  return (
    <p className={`${s.note} ${className}`} style={{ '--r': `${rot}deg` }} aria-hidden="true">
      <svg viewBox="0 0 20 16" width="18" height="14" className={s.signal}>
        <circle cx="3" cy="13" r="1.8" />
        <path d="M3 8.5a4.5 4.5 0 0 1 4.5 4.5" />
        <path d="M3 4a9 9 0 0 1 9 9" />
        <path d="M3 -0.5a13.5 13.5 0 0 1 13.5 13.5" />
      </svg>
      {children}
    </p>
  );
}

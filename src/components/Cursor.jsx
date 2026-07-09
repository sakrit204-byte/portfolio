import { useEffect, useRef, useState } from 'react';
import s from './cursor.module.css';

const HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, [data-cursor]';

/**
 * An ink-dot cursor with a lagging ring. Desktop + fine-pointer only, and it
 * bows out entirely under prefers-reduced-motion (the OS cursor is restored).
 */
export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ok = fine.matches && !calm.matches;
    setEnabled(ok);
    if (!ok) return;

    document.body.dataset.cursor = 'on';

    // Target = true pointer position; ring lerps toward it for a trailing feel.
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { ...target };
    let raf = 0;
    let label = '';

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      const hit = e.target instanceof Element ? e.target.closest(HOVER_SELECTOR) : null;
      const next = hit ? hit.getAttribute('data-cursor') || 'hover' : '';
      if (next !== label) {
        label = next;
        const el = ringRef.current;
        if (el) {
          el.dataset.state = next ? 'hover' : '';
          el.textContent = next && next !== 'hover' ? next : '';
        }
      }
    };

    // Press feedback goes through data-attrs, not transform — the rAF loop owns
    // `transform` and would clobber any class-based scale every frame.
    const onDown = () => ringRef.current?.setAttribute('data-down', '');
    const onUp = () => ringRef.current?.removeAttribute('data-down');
    const onLeave = () => dotRef.current?.style.setProperty('opacity', '0');
    const onEnter = () => dotRef.current?.style.setProperty('opacity', '1');

    const tick = () => {
      ring.x += (target.x - ring.x) * 0.16;
      ring.y += (target.y - ring.y) * 0.16;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      delete document.body.dataset.cursor;
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden="true">
      <div ref={dotRef} className={s.dot} />
      <div ref={ringRef} className={s.ring} />
    </div>
  );
}

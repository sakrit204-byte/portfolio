import s from './grain.module.css';

/**
 * Fixed paper texture: fibrous noise + a warm vignette, sitting above the page
 * background but below content. Pointer-events off so it never eats clicks.
 */
export default function Grain() {
  return (
    <div className={s.wrap} aria-hidden="true">
      <svg className={s.noise} xmlns="http://www.w3.org/2000/svg">
        <filter id="paperGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paperGrain)" />
      </svg>
      <div className={s.vignette} />
    </div>
  );
}

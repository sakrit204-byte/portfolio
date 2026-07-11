import s from './grain.module.css';

/**
 * Ambient atmosphere: sensor noise, cool light pools and a faint scanline
 * wash. Above the page background, below content, never eats clicks.
 */
export default function Grain() {
  return (
    <div className={s.wrap} aria-hidden="true">
      <div className={s.vignette} />
      <svg className={s.noise} xmlns="http://www.w3.org/2000/svg">
        <filter id="sensorNoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sensorNoise)" />
      </svg>
      <div className={s.scan} />
    </div>
  );
}

import styles from './SpiralRing.module.css';

export default function SpiralRing() {
  return (
    <svg
      className={styles.ring}
      viewBox="0 0 360 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="180" cy="180" r="155"
        stroke="#0d0d0d"
        strokeWidth="1.5"
        strokeDasharray="6 5"
      />
      <circle
        cx="180" cy="180" r="166"
        stroke="#f59e0b"
        strokeWidth="1"
        strokeDasharray="3 8"
        opacity="0.5"
      />
    </svg>
  );
}

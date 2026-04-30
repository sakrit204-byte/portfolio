import styles from './CircleButton.module.css';

const colorMap = {
  amber: styles.amber,
  red:   styles.red,
  cyan:  styles.cyan,
};

export default function CircleButton({ label, color = 'amber', onClick }) {
  return (
    <button
      className={`${styles.btn} ${colorMap[color]}`}
      onClick={onClick}
      aria-label={`Open ${label}`}
    >
      {label}
    </button>
  );
}

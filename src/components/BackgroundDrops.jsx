import { useMemo } from 'react';
import styles from './BackgroundDrops.module.css';

const COUNT = 14;

export default function BackgroundDrops() {
  const drops = useMemo(() => {
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      size: 5 + Math.random() * 9,
      left: Math.random() * 98,
      duration: 7 + Math.random() * 8,
      delay: -(Math.random() * 15),
    }));
  }, []);

  return (
    <div className={styles.bg} aria-hidden="true">
      {drops.map((d) => (
        <span
          key={d.id}
          className={styles.drop}
          style={{
            width: d.size,
            height: d.size,
            left: `${d.left}%`,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

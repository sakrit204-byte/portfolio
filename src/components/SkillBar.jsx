import { useEffect, useRef, useState } from 'react';
import styles from './SkillBar.module.css';

export default function SkillBar({ name, value }) {
  const [filled, setFilled] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Use IntersectionObserver so bars animate when visible
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setFilled(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <li ref={ref} className={styles.row}>
      <div className={styles.label}>
        <span>{name}</span>
        <span>{value}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: filled ? `${value}%` : '0%' }}
        />
      </div>
    </li>
  );
}

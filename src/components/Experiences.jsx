import { EXPERIENCES } from '../data';
import styles from './Experiences.module.css';

export default function Experiences() {
  return (
    <div className={styles.list}>
      {EXPERIENCES.map((e, i) => (
        <div key={e.id} className={styles.item}>
          <div className={styles.dot} />
          {i < EXPERIENCES.length - 1 && <div className={styles.line} />}
          <div className={styles.content}>
            <div className={styles.role}>{e.role}</div>
            <div className={styles.company}>{e.company}</div>
            <div className={styles.period}>{e.period}</div>
            <div className={styles.desc}>{e.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

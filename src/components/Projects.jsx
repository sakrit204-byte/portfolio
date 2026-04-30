import { PROJECTS } from '../data';
import styles from './Projects.module.css';

export default function Projects() {
  return (
    <div className={styles.grid}>
      {PROJECTS.map((p) => (
        <article key={p.id} className={styles.card}>
          <h3 className={styles.cardName}>{p.name}</h3>
          <p className={styles.cardDesc}>{p.desc}</p>
          <div className={styles.tags}>
            {p.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

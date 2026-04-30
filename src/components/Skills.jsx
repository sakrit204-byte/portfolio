import SkillBar from './SkillBar';
import { SKILLS } from '../data';
import styles from './Skills.module.css';

export default function Skills() {
  return (
    <ul className={styles.list}>
      {SKILLS.map((s) => (
        <SkillBar key={s.name} name={s.name} value={s.value} />
      ))}
    </ul>
  );
}

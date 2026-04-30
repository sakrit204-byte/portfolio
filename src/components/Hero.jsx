import SpiralRing from './SpiralRing';
import CircleButton from './CircleButton';
import styles from './Hero.module.css';
import profileImg from '../assets/profile.jpg';

export default function Hero({ onOpenModal }) {
  return (
    <main className={styles.hero}>
      {/* Profile image */}
      <div className={styles.left}>
        <div className={styles.profileOuter}>
          <SpiralRing />
          <div className={styles.profileWrap}>
            <img src={profileImg} alt="Sakrit Kafle" className={styles.profileImg} />
          </div>
        </div>
      </div>

      {/* Text + CTA */}
      <div className={styles.right}>
        <h1 className={styles.name}>Sakrit<br />Kafle</h1>
        <p className={styles.role}>Full-Stack Developer</p>
        <p className={styles.desc}>
          I'm a full-stack developer experienced in client handling and IT
          solutions — delivering tailored integrations. Passionate about
          crafting seamless UIs and well-thought-out backends.
        </p>

        <div className={styles.circles}>
          <CircleButton label="Skills"      color="amber" onClick={() => onOpenModal('skills')} />
          <CircleButton label="Projects"    color="red"   onClick={() => onOpenModal('projects')} />
          <CircleButton label="Experience"  color="cyan"  onClick={() => onOpenModal('experiences')} />
        </div>
      </div>
    </main>
  );
}

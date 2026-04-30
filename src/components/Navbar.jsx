import styles from './Navbar.module.css';

function downloadResume() {
  const link = document.createElement('a');
  link.href = '/sakrit_resume.pdf';
  link.download = 'sakrit_resume.pdf';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Navbar({ onOpenModal }) {
  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.dot} />
          <span className={styles.name}>Sakrit Kafle</span>
          <span className={styles.sub}>Full-Stack Developer</span>
        </div>

        <nav className={styles.links}>
          <button className={styles.link} onClick={() => onOpenModal('projects')}>
            Projects
          </button>
          <button className={styles.link} onClick={() => onOpenModal('experiences')}>
            Experience
          </button>
          <button className={styles.resumeBtn} onClick={downloadResume}>
            ↓ Resume
          </button>
        </nav>
      </div>
    </header>
  );
}

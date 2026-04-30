import { useEffect, useRef } from 'react';
import Skills from './Skills';
import Projects from './Projects';
import Experiences from './Experiences';
import styles from './Modal.module.css';

const TITLES = {
  skills:      'Skills',
  projects:    'Projects',
  experiences: 'Experience',
};

const PANELS = {
  skills:      Skills,
  projects:    Projects,
  experiences: Experiences,
};

export default function Modal({ activeModal, onClose }) {
  const overlayRef = useRef(null);
  const isOpen = !!activeModal;

  // Trap focus inside modal when open
  useEffect(() => {
    if (isOpen) overlayRef.current?.focus();
  }, [isOpen]);

  if (!activeModal && !isOpen) return null;

  const Panel = PANELS[activeModal];
  const title = TITLES[activeModal];

  return (
    <div
      ref={overlayRef}
      className={`${styles.overlay} ${isOpen ? styles.active : ''}`}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {Panel && <Panel />}
        </div>
      </div>
    </div>
  );
}

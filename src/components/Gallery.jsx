import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GALLERY } from '../data/cv';
import s from './gallery.module.css';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Reward popup: fires when the player walks back to base camp. Slots with no
 * `src` render as empty frames, ready for screenshots.
 */
export default function Gallery({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  // Portalled to <body>: the map's `perspective` would otherwise act as the
  // containing block for this fixed-position overlay and clip it.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={s.root} role="dialog" aria-modal="true" aria-labelledby="gal-title">
          <motion.div
            className={s.scrim}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          <motion.div
            className={s.panel}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <button className={s.close} onClick={onClose} aria-label="Close gallery">
              ✕
            </button>

            <header className={s.head}>
              <p className={s.kicker}>
                <i className={s.badge} aria-hidden="true">
                  ★
                </i>
                Base camp reached
              </p>
              <h2 className={s.title} id="gal-title">
                The work, in pictures.
              </h2>
              <p className={s.lead}>Screens from the systems behind the markers you’ve been walking across.</p>
            </header>

            <div className={s.grid}>
              {GALLERY.map((g, i) => (
                <motion.figure
                  key={g.id}
                  className={s.frame}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.45, ease: EASE }}
                >
                  <div className={s.shot} data-empty={!g.src || undefined}>
                    {g.src ? (
                      <img src={g.src} alt={`${g.title} — screenshot`} loading="lazy" />
                    ) : (
                      <span className={s.placeholder} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                          <path
                            d="M3 7h4l2-2h6l2 2h4v12H3zM12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  <figcaption>
                    <strong>{g.title}</strong>
                    <span>{g.project}</span>
                  </figcaption>
                </motion.figure>
              ))}
            </div>

            <footer className={s.foot}>
              <a className={s.cta} href="#contact" onClick={onClose}>
                Start a project
              </a>
              <button className={s.ghost} onClick={onClose}>
                Back to the map
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

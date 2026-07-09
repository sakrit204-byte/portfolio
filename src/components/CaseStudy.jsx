import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CONTACT } from '../data/cv';
import s from './casestudy.module.css';

const EASE = [0.22, 1, 0.36, 1];

export default function CaseStudy({ node, onClose }) {
  const panelRef = useRef(null);
  const restoreFocus = useRef(null);

  useEffect(() => {
    if (!node) return;

    restoreFocus.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Keep focus inside the drawer while it's open.
      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => panelRef.current?.focus(), 40);

    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      restoreFocus.current?.focus?.();
    };
  }, [node, onClose]);

  // Retain the last node through the exit transition — `node` is nulled the
  // instant we close, and AnimatePresence still needs content to animate out.
  const lastNode = useRef(node);
  if (node) lastNode.current = node;
  const shown = node ?? lastNode.current;
  const study = shown?.study;

  return (
    <AnimatePresence>
      {node && study && (
        <div className={s.root} role="dialog" aria-modal="true" aria-labelledby="cs-title">
          <motion.div
            className={s.scrim}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className={s.panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <button className={s.close} onClick={onClose} aria-label="Close case study">
              <span aria-hidden="true">✕</span>
              <kbd>esc</kbd>
            </button>

            <div className={s.scroll}>
              <p className={s.kicker}>{shown.kicker}</p>
              <h2 className={s.title} id="cs-title">
                {study.title}
              </h2>

              <dl className={s.facts}>
                <div>
                  <dt>Role</dt>
                  <dd>{study.role}</dd>
                </div>
                <div>
                  <dt>Organisation</dt>
                  <dd>{study.org}</dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>{study.period}</dd>
                </div>
                {study.location && (
                  <div>
                    <dt>Location</dt>
                    <dd>{study.location}</dd>
                  </div>
                )}
              </dl>

              <p className={s.summary}>{study.summary}</p>

              {study.metrics && (
                <ul className={s.metrics}>
                  {study.metrics.map((m) => (
                    <li key={m.label}>
                      <strong>{m.value}</strong>
                      <span>{m.label}</span>
                    </li>
                  ))}
                </ul>
              )}

              {study.bullets && (
                <ul className={s.bullets}>
                  {study.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}

              {study.groups?.map((g) => (
                <section key={g.title} className={s.group}>
                  <h3>{g.title}</h3>
                  <ul className={s.bullets}>
                    {g.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </section>
              ))}

              {study.stack && (
                <>
                  <p className={s.stackLabel}>{study.cta ? 'How we’d work' : 'Stack'}</p>
                  <ul className={s.chips}>
                    {study.stack.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}

              {study.link && (
                <a className={s.link} href={study.link.href} target="_blank" rel="noreferrer">
                  {study.link.label} <span aria-hidden="true">↗</span>
                </a>
              )}

              {study.cta && (
                <div className={s.ctaRow}>
                  <a className={s.ctaPrimary} href={`mailto:${CONTACT.email}`}>
                    Email me
                  </a>
                  <a className={s.ctaGhost} href={CONTACT.phoneHref}>
                    {CONTACT.phone}
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PROFILE } from '../data/cv';
import { LAYOUT } from '../three/course';
import Course from './Course';
import s from './hero.module.css';

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + 0.08 * i, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] } }),
};

const PAR = LAYOUT.reduce((n, h) => n + h.par, 0);

export default function Hero() {
  const [playing, setPlaying] = useState(false);
  const exit = useCallback(() => setPlaying(false), []);

  const play = () => {
    document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
    setPlaying(true);
  };

  // phones play full screen: keep the page from scrolling underneath
  useEffect(() => {
    if (!playing || !window.matchMedia('(pointer: coarse)').matches) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [playing]);

  return (
    <section className={s.hero} id="top" data-playing={playing || undefined}>
      <Course playing={playing} onExit={exit} />

      <div className={s.veil} aria-hidden="true" />

      <div className={s.copy} inert={playing || undefined}>
        <div className="wrap">
          <motion.p className={s.kicker} initial="hidden" animate="show" custom={0} variants={rise}>
            {PROFILE.role} <span aria-hidden="true">/</span> {PROFILE.studio}
          </motion.p>
          <motion.h1 className={s.title} initial="hidden" animate="show" custom={1} variants={rise}>
            {PROFILE.headline}
          </motion.h1>
          <motion.p className={s.intro} initial="hidden" animate="show" custom={2} variants={rise}>
            {PROFILE.intro}
          </motion.p>
          <motion.div className={s.actions} initial="hidden" animate="show" custom={3} variants={rise}>
            <a className="btn btnPrimary" href="#work">
              See my work
            </a>
            <button className="btn btnGhost" onClick={play}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 21V3l11 4.5L6 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M3 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Play the course
            </button>
          </motion.div>
          <motion.p className={s.note} initial="hidden" animate="show" custom={4} variants={rise}>
            {LAYOUT.length} holes, one for each chapter of my work. Par {PAR}.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

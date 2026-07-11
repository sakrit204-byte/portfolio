import { motion } from 'framer-motion';
import { PROFILE, CONTACT } from '../data/cv';
import World from './World';
import s from './hero.module.css';

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

const STACK = ['React', 'Node.js', 'FastAPI', 'PostgreSQL', 'Docker', 'LangChain'];

export default function Hero({ onOpen, paused }) {
  return (
    <section className={s.hero} id="top">
      <div className={s.intro}>
        <motion.p className={s.chip} initial="hidden" animate="show" custom={0} variants={rise}>
          <i className={s.dot} aria-hidden="true" />
          {PROFILE.available}
        </motion.p>

        <motion.h1 className={s.title} initial="hidden" animate="show" custom={1} variants={rise}>
          <span className={s.name}>{PROFILE.name}</span>
          <span className={s.titleSub}>
            I build full-stack systems and <em>ship them to production</em> — web apps, CRMs, REST APIs and AI/RAG
            pipelines.
          </span>
        </motion.h1>

        <motion.div className={s.meta} initial="hidden" animate="show" custom={2} variants={rise}>
          {STACK.map((t) => (
            <span key={t} className={s.tag}>
              {t}
            </span>
          ))}
        </motion.div>

        <motion.div className={s.actions} initial="hidden" animate="show" custom={3} variants={rise}>
          <a className={s.primary} href="#contact">
            Start a project
          </a>
          <a className={s.ghost} href="#work">
            See the work
          </a>
          <a className={s.ghost} href={CONTACT.cvHref} download={CONTACT.cvFile}>
            Download CV ↓
          </a>
          <a className={s.ghost} href={CONTACT.githubHref} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </motion.div>
      </div>

      <div className={s.map}>
        <span className={s.mapTag} aria-hidden="true">
          <i />
          the_course.gl — this course IS the CV. roll it.
        </span>
        <World onOpen={onOpen} paused={paused} />
      </div>
    </section>
  );
}

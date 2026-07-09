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

export default function Hero({ onOpen }) {
  return (
    <section className={s.hero} id="top">
      <div className={s.intro}>
        <motion.p className={s.chip} initial="hidden" animate="show" custom={0} variants={rise}>
          <i className={s.dot} aria-hidden="true" />
          {PROFILE.available}
        </motion.p>

        <motion.h1 className={s.title} initial="hidden" animate="show" custom={1} variants={rise}>
          {PROFILE.name}
          <span className={s.titleSub}>
            I scope, build and <em>ship</em> full-stack products —
            <br className={s.brk} /> then deploy them myself.
          </span>
        </motion.h1>

        <motion.div className={s.meta} initial="hidden" animate="show" custom={2} variants={rise}>
          <span>{PROFILE.roles[0]}</span>
          <span className={s.sep} aria-hidden="true" />
          <span>{PROFILE.roles[1]}</span>
          <span className={s.sep} aria-hidden="true" />
          <span>{PROFILE.location}</span>
        </motion.div>

        <motion.div className={s.actions} initial="hidden" animate="show" custom={3} variants={rise}>
          <a className={s.primary} href="#contact">
            Start a project
          </a>
          <a className={s.ghost} href="#work">
            See the work
          </a>
          <a className={s.ghost} href={CONTACT.githubHref} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </motion.div>

        <motion.p
          className={s.scribble}
          initial={{ opacity: 0, rotate: -6 }}
          animate={{ opacity: 1, rotate: -3 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          aria-hidden="true"
        >
          the map below is real — go wander ↓
        </motion.p>
      </div>

      <div className={s.map}>
        <World onOpen={onOpen} />
      </div>
    </section>
  );
}

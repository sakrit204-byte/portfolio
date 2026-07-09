import { motion } from 'framer-motion';

/** Scroll-in reveal. `as` keeps the underlying element semantic. */
export default function Reveal({ children, as = 'div', delay = 0, y = 26, className, ...rest }) {
  const M = motion[as] ?? motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </M>
  );
}

/** Section heading: mono index + serif title + optional hand-written aside. */
export function Heading({ index, title, aside, lead }) {
  return (
    <header style={{ maxWidth: '58ch' }}>
      <Reveal as="p" className="secIndex">
        <span>{index}</span>
        {aside && <em>{aside}</em>}
      </Reveal>
      <Reveal as="h2" className="secTitle" delay={0.06}>
        {title}
      </Reveal>
      {lead && (
        <Reveal as="p" className="secLead" delay={0.12}>
          {lead}
        </Reveal>
      )}
    </header>
  );
}

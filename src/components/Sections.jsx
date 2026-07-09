import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import Reveal, { Heading } from './Reveal';
import { CONTACT, EDUCATION, NODES, PROFILE, REFERENCES, SERVICES, SKILLS, STATS } from '../data/cv';
import s from './sections.module.css';

const CASE_IDS = ['brcrn', 'yadverse', 'synexis', 'fleet'];

/** Counts a stat up when it scrolls into view. Non-numeric values pass through. */
function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const calm = useReducedMotion();
  const parts = /^([\d.]+)(.*)$/.exec(value);
  const [shown, setShown] = useState(parts ? '0' : value);

  useEffect(() => {
    if (!parts || !inView) return;
    const end = parseFloat(parts[1]);
    const decimals = (parts[1].split('.')[1] ?? '').length;
    if (calm) {
      setShown(end.toFixed(decimals));
      return;
    }
    const DURATION = 1100;
    let raf = 0;
    let start = 0;
    const tick = (now) => {
      if (!start) start = now;
      const t = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown((end * eased).toFixed(decimals));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, calm, parts?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!parts) return <span ref={ref}>{value}</span>;
  return (
    <span ref={ref}>
      {shown}
      {parts[2]}
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function Stats() {
  return (
    <section className={s.statsBand} aria-label="At a glance">
      <div className={s.statsInner}>
        {STATS.map((st, i) => (
          <Reveal key={st.label} className={s.stat} delay={i * 0.07}>
            <strong>
              <CountUp value={st.value} />
            </strong>
            <span>{st.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Work({ onOpen }) {
  const cases = CASE_IDS.map((id) => NODES.find((n) => n.id === id)).filter(Boolean);

  return (
    <section className={s.section} id="work">
      <div className={s.wrap}>
        <Heading
          index="01 — Selected work"
          aside="click any card"
          title="Shipped to production, and kept running."
          lead="Government systems, a studio, a CRM built from nothing, and an international commercial client. Every one of these went live."
        />

        <div className={s.caseGrid}>
          {cases.map((n, i) => (
            <Reveal key={n.id} delay={i * 0.06}>
              <button className={s.caseCard} data-kind={n.kind} onClick={() => onOpen(n)}>
                <span className={s.caseTop}>
                  <span className={s.caseKicker}>{n.kicker}</span>
                  <span className={s.casePeriod}>{n.study.period}</span>
                </span>

                <h3 className={s.caseTitle}>{n.study.title}</h3>
                <p className={s.caseRole}>{n.study.role}</p>
                <p className={s.caseDesc}>{n.study.summary}</p>

                <span className={s.caseChips}>
                  {n.study.stack.slice(0, 4).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                  {n.study.stack.length > 4 && <span>+{n.study.stack.length - 4}</span>}
                </span>

                <span className={s.caseOpen}>
                  Read case study <i aria-hidden="true">→</i>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Services() {
  return (
    <section className={s.section} id="services">
      <div className={s.wrap}>
        <Heading
          index="02 — Services"
          aside="what you're buying"
          title="What I can build for you."
          lead="Fixed scope, weekly demos, and a production handover you actually own. No account managers — you talk to the person writing the code."
        />

        <div className={s.serviceGrid}>
          {SERVICES.map((sv, i) => (
            <Reveal key={sv.title} delay={(i % 3) * 0.06}>
              <article className={s.service}>
                <span className={s.serviceIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <path d={sv.glyph} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3>{sv.title}</h3>
                <p>{sv.desc}</p>
                <p className={s.serviceStack}>{sv.stack}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Stack() {
  const [active, setActive] = useState(SKILLS[0].group);
  const current = SKILLS.find((g) => g.group === active) ?? SKILLS[0];

  return (
    <section className={s.section} id="stack">
      <div className={s.wrap}>
        <Heading
          index="03 — Technical stack"
          title="The tools, honestly assessed."
          lead="Everything here has shipped in something real — not a tutorial."
        />

        <div className={s.stackBox}>
          <div className={s.stackTabs} role="tablist" aria-label="Skill groups">
            {SKILLS.map((g) => (
              <button
                key={g.group}
                role="tab"
                aria-selected={active === g.group}
                className={s.stackTab}
                data-on={active === g.group || undefined}
                onClick={() => setActive(g.group)}
              >
                {g.group}
                <i>{g.items.length}</i>
              </button>
            ))}
          </div>

          <div className={s.stackPanel} role="tabpanel">
            {current.items.map((item, i) => (
              <motion.span
                key={`${current.group}-${item}`}
                className={s.stackChip}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {item}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function About() {
  return (
    <section className={s.section} id="about">
      <div className={s.wrap}>
        <div className={s.aboutGrid}>
          <div>
            <Heading index="04 — About" title="Profile." />
            <Reveal as="p" className={s.aboutLead} delay={0.08}>
              {PROFILE.summary}
            </Reveal>
            <Reveal as="p" className={s.aboutBody} delay={0.14}>
              {PROFILE.summaryRest}
            </Reveal>

            <Reveal className={s.eduBlock} delay={0.2}>
              <h3 className={s.subhead}>Education</h3>
              {EDUCATION.map((e) => (
                <div key={e.degree} className={s.edu}>
                  <div className={s.eduHead}>
                    <strong>{e.degree}</strong>
                    <span className={s.eduPeriod}>{e.period}</span>
                  </div>
                  <p>
                    {e.detail} · {e.school}
                  </p>
                  <p className={s.eduPlace}>{e.place}</p>
                </div>
              ))}
            </Reveal>
          </div>

          <Reveal className={s.aboutSide} delay={0.12}>
            <figure className={s.portrait}>
              <img src="/profile.jpg" alt={`${PROFILE.name}, full-stack developer`} width="480" height="480" loading="lazy" />
              <figcaption>{PROFILE.location}</figcaption>
            </figure>

            <h3 className={s.subhead}>References</h3>
            <ul className={s.refs}>
              {REFERENCES.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>
                  <span>{r.title}</span>
                  {r.email && (
                    <a href={`mailto:${r.email}`} className={s.refLink}>
                      {r.email}
                    </a>
                  )}
                  {r.phone && <span className={s.refPhone}>{r.phone}</span>}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Contact() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context / denied) — the mailto link still works.
    }
  };

  return (
    <section className={s.contact} id="contact">
      <div className={s.wrap}>
        <Reveal as="p" className={s.contactKicker}>
          <i className={s.contactDot} aria-hidden="true" />
          {PROFILE.available}
        </Reveal>

        <Reveal as="h2" className={s.contactTitle} delay={0.06}>
          Have something that needs
          <br />
          building <em>properly</em>?
        </Reveal>

        <Reveal as="p" className={s.contactLead} delay={0.12}>
          Tell me the problem, not the spec. I’ll come back with scope, a timeline, and a fixed price — usually within a day.
        </Reveal>

        <Reveal className={s.contactActions} delay={0.18}>
          <a className={s.contactPrimary} href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
          <button className={s.contactGhost} onClick={copy} aria-live="polite">
            {copied ? 'Copied ✓' : 'Copy address'}
          </button>
          <a className={s.contactGhost} href={CONTACT.phoneHref}>
            {CONTACT.phone}
          </a>
        </Reveal>

        <Reveal className={s.contactLinks} delay={0.24}>
          {[
            { label: 'GitHub', value: CONTACT.github, href: CONTACT.githubHref },
            { label: 'Portfolio', value: CONTACT.site, href: CONTACT.siteHref },
            { label: 'Studio', value: CONTACT.studio, href: CONTACT.studioHref },
          ].map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
              <span>{l.label}</span>
              <strong>
                {l.value} <i aria-hidden="true">↗</i>
              </strong>
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.footInner}>
          <p>
            © {new Date().getFullYear()} {PROFILE.name} · Built in Bhaktapur, deployed everywhere.
          </p>
          <a href="#top">Back to the map ↑</a>
        </div>
      </div>
    </footer>
  );
}

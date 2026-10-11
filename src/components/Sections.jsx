import { useState } from 'react';
import { CONTACT, EDUCATION, EXPERIENCE, MORE_WORK, PROFILE, PROJECTS, REFERENCES, SKILLS } from '../data/cv';
import { Signal } from './Backdrop';
import Cover from './Cover';
import Reveal from './Reveal';
import Showcase from './Showcase';
import s from './sections.module.css';

function Heading({ eyebrow, title, lead, note, rot, noteAbove }) {
  return (
    <header className={s.heading}>
      {note && (
        <Signal className={`${s.headNote} ${noteAbove ? s.headNoteAbove : ''}`} rot={rot}>
          {note}
        </Signal>
      )}
      <Reveal as="p" className="eyebrow">
        {eyebrow}
      </Reveal>
      <Reveal as="h2" className="h2" delay={0.05}>
        {title}
      </Reveal>
      {lead && (
        <Reveal as="p" className="lead" delay={0.1}>
          {lead}
        </Reveal>
      )}
    </header>
  );
}

export function Work() {
  return (
    <section id="work" className={s.work}>
      <div className="wrap">
        <Heading
          eyebrow="Selected work"
          title="Real products, used by real teams."
          lead="Each of these is live or in use. Scroll through them the way their users do."
          note="still at uni, already in production"
          rot={-4}
        />
      </div>
      {PROJECTS.map((p, i) => (
        <Showcase key={p.id} project={p} index={i} />
      ))}
    </section>
  );
}

export function MoreWork() {
  return (
    <section className={`section ${s.more}`} aria-labelledby="more-title">
      <div className="wrap">
        <header className={s.moreHead}>
          <h2 id="more-title" className={s.h3}>
            More on GitHub
          </h2>
          <Signal className={s.inlineNote} rot={-2}>
            ship it, then make it better
          </Signal>
          <a className={s.textLink} href={CONTACT.githubHref} target="_blank" rel="noreferrer">
            {CONTACT.github} <span aria-hidden="true">↗</span>
          </a>
        </header>
        <div className={s.cards}>
          {MORE_WORK.map((w, i) => (
            <Reveal as="a" key={w.name} className={s.card} href={w.href} target="_blank" rel="noreferrer" delay={i * 0.05}>
              <Cover kind={w.cover} />
              <h3>{w.name}</h3>
              <p>{w.text}</p>
              <span className={s.cardStack}>{w.stack}</span>
              <span className={s.cardGo} aria-hidden="true">
                ↗
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Experience() {
  return (
    <section id="experience" className="section">
      <div className="wrap">
        <Heading eyebrow="Experience" title="Where I’ve been building." note="from Bhaktapur to anywhere" rot={3} />
        <ol className={s.timeline}>
          {EXPERIENCE.map((x) => (
            <Reveal as="li" key={x.org} className={s.job}>
              <p className={s.when}>{x.period}</p>
              <div>
                <h3 className={s.jobRole}>
                  {x.role},{' '}
                  {x.href ? (
                    <a href={x.href} target="_blank" rel="noreferrer">
                      {x.org}
                    </a>
                  ) : (
                    x.org
                  )}
                </h3>
                <p className={s.where}>{x.place}</p>
                <ul className={s.points}>
                  {x.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>
              {x.image && (
                <figure className={s.jobShot}>
                  <img src={x.image} alt={`${x.org}: ${x.imageLabel}`} loading="lazy" />
                  <figcaption className="sayTag">{x.imageLabel}</figcaption>
                </figure>
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Skills() {
  return (
    <section id="skills" className={s.band}>
      <div className="wrap">
        <header className={s.heading}>
          <Reveal as="p" className={`eyebrow ${s.onDeep}`}>
            Toolbox
          </Reveal>
          <Reveal as="h2" className="h2" delay={0.05}>
            What I reach for, and have shipped with.
          </Reveal>
        </header>
        <dl className={s.skills}>
          {SKILLS.map((g, i) => (
            <Reveal key={g.group} className={s.skill} delay={(i % 4) * 0.04}>
              <dt>{g.group}</dt>
              <dd>{g.items.join(', ')}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function About() {
  return (
    <section id="about" className="section">
      <div className={`wrap ${s.about}`}>
        <Reveal className={s.portrait}>
          <img src="/profile.jpg" alt="Sakrit Kafle" width="480" height="600" loading="lazy" />
          <span className={`sayTag ${s.portraitTag}`}>{PROFILE.location}</span>
        </Reveal>
        <div>
          <Heading
            eyebrow="About"
            title="Engineer first, designer by habit."
            note="build it, deploy it, keep it running"
            rot={-3}
            noteAbove
          />
          {PROFILE.about.map((p) => (
            <Reveal as="p" key={p.slice(0, 20)} className={s.aboutText}>
              {p}
            </Reveal>
          ))}

          <div className={s.facts}>
            <div>
              <h3 className={s.factTitle}>Education</h3>
              <ul>
                {EDUCATION.map((e) => (
                  <li key={e.degree}>
                    <strong>{e.degree}</strong>
                    <span>
                      {e.school}, {e.place}. {e.period}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={s.factTitle}>References</h3>
              <ul>
                {REFERENCES.map((r) => (
                  <li key={r.name}>
                    <strong>{r.name}</strong>
                    <span>
                      {r.title}
                      {r.contact && (
                        <>
                          , <a href={`mailto:${r.contact}`}>{r.contact}</a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${CONTACT.email}`;
    }
  };

  return (
    <section id="contact" className={`section ${s.contact}`}>
      <div className={`wrap ${s.contactWrap}`}>
        <Reveal as="p" className="eyebrow">
          Contact
        </Reveal>
        <Reveal as="h2" className={s.contactTitle} delay={0.05}>
          Have something worth building?
        </Reveal>
        <Signal className={s.headNote} rot={4}>
          5 holes, par 17. beat it?
        </Signal>
        <Reveal as="p" className="lead" delay={0.1}>
          Tell me what you are working on and where you are stuck. Email is the quickest way to reach me.
        </Reveal>

        <Reveal className={s.mail} delay={0.12}>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          <button className={s.copy} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </Reveal>

        <Reveal className={s.channels} delay={0.16}>
          <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          <a href={CONTACT.phoneHomeHref}>{CONTACT.phoneHome}</a>
          <a href={`mailto:${CONTACT.emailUni}`}>{CONTACT.emailUni}</a>
          <a href={CONTACT.githubHref} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={CONTACT.youtubeHref} target="_blank" rel="noreferrer">
            YouTube
          </a>
          <a href={CONTACT.studioHref} target="_blank" rel="noreferrer">
            YADverse
          </a>
          <a href={CONTACT.cvHref} download={CONTACT.cvFile}>
            Download CV
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={s.footer}>
      <div className={`wrap ${s.footerInner}`}>
        <span>© {new Date().getFullYear()} Sakrit Kafle</span>
        <a href="#top">Back to the first tee</a>
      </div>
    </footer>
  );
}

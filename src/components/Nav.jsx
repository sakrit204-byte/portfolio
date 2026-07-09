import { useEffect, useState } from 'react';
import { CONTACT } from '../data/cv';
import s from './nav.module.css';

const LINKS = [
  { href: '#work', label: 'Work' },
  { href: '#services', label: 'Services' },
  { href: '#stack', label: 'Stack' },
  { href: '#about', label: 'About' },
];

export default function Nav() {
  const [lifted, setLifted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The mobile sheet owns the scroll while it's open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className={s.bar} data-lifted={lifted || undefined}>
      <div className={s.inner}>
        <a href="#top" className={s.brand}>
          <span className={s.mark} aria-hidden="true" />
          <span className={s.brandText}>
            <strong>Sakrit Kafle</strong>
            <em>Full-Stack Developer</em>
          </span>
        </a>

        <nav className={s.links} aria-label="Sections">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={s.link}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className={s.right}>
          <span className={s.status}>
            <i className={s.pulse} aria-hidden="true" />
            Available
          </span>
          <a className={s.cta} href="#contact">
            Hire me
          </a>
          <button
            className={s.burger}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <span data-open={open || undefined} />
          </button>
        </div>
      </div>

      {open && (
        <div className={s.sheet}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#contact" onClick={() => setOpen(false)}>
            Contact
          </a>
          <a href={CONTACT.githubHref} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      )}
    </header>
  );
}

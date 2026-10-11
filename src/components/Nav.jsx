import { useEffect, useState } from 'react';
import { CONTACT } from '../data/cv';
import s from './nav.module.css';

const LINKS = [
  { href: '#work', label: 'Work' },
  { href: '#experience', label: 'Experience' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
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

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className={s.bar} data-lifted={lifted || undefined} data-open={open || undefined}>
      <div className={s.inner}>
        <a href="#top" className={s.brand} onClick={() => setOpen(false)}>
          Sakrit Kafle
        </a>

        <nav className={s.links} aria-label="Sections">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <a className={s.cv} href={CONTACT.cvHref} download={CONTACT.cvFile}>
          Download CV
        </a>

        <button
          className={s.burger}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <span />
        </button>
      </div>

      <div className={s.sheet} id="menu" hidden={!open}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <a href={CONTACT.cvHref} download={CONTACT.cvFile} onClick={() => setOpen(false)}>
          Download CV
        </a>
      </div>
    </header>
  );
}

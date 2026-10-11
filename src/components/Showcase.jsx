import { useEffect, useMemo, useRef, useState } from 'react';
import s from './showcase.module.css';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Consecutive steps that show the same screen share one layer, so a long
 *  page keeps scrolling across them instead of jumping back to the top. */
function groupSteps(steps) {
  const groups = [];
  steps.forEach((st, i) => {
    const prev = groups[groups.length - 1];
    if (prev && prev.web === st.web && prev.mobile === st.mobile) prev.to = i;
    else groups.push({ web: st.web, mobile: st.mobile, from: i, to: i });
  });
  return groups;
}

function Screen({ src, still, layerRef, on, alt }) {
  return (
    <div className={s.layer} data-on={on || undefined} data-still={still || undefined} ref={layerRef}>
      {src && <img src={src} alt={alt} loading="lazy" decoding="async" draggable="false" />}
    </div>
  );
}

/** A display, a phone, or both, holding one or more stacked screens. */
export function Device({ kind, layers, active, still, refs, name }) {
  const monitor = kind === 'monitor' || kind === 'pair';
  const phone = kind === 'phone' || kind === 'pair';
  return (
    <div className={s.device} data-kind={kind}>
      {monitor && (
        <div className={s.monitor}>
          <div className={s.bezel}>
            <div className={s.screen}>
              {layers.map((l, i) => (
                <Screen
                  key={i}
                  src={l.web}
                  still={still}
                  on={i === active}
                  alt={i === active ? `${name} on a desktop screen` : ''}
                  layerRef={(el) => refs && (refs.current[`w${i}`] = el)}
                />
              ))}
            </div>
            <span className={s.cam} aria-hidden="true" />
          </div>
          <div className={s.stand} aria-hidden="true">
            <i />
            <b />
          </div>
        </div>
      )}
      {phone && (
        <div className={s.phone}>
          <div className={s.phoneScreen}>
            {layers.map((l, i) => (
              <Screen
                key={i}
                src={l.mobile}
                on={i === active}
                alt={i === active ? `${name} on a phone` : ''}
                layerRef={(el) => refs && (refs.current[`m${i}`] = el)}
              />
            ))}
            <span className={s.island} aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}

function VideoDialog({ video, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (video && d && !d.open) d.showModal();
  }, [video]);
  if (!video) return null;
  return (
    <dialog ref={ref} className={s.dialog} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className={s.dialogFrame}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      <button className={s.dialogClose} onClick={() => ref.current.close()}>
        Close
      </button>
    </dialog>
  );
}

export default function Showcase({ project, index }) {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const blockRefs = useRef([]);
  const layerRefs = useRef({});
  const inlineRefs = useRef({});
  const [active, setActive] = useState(0);
  const [video, setVideo] = useState(null);

  const groups = useMemo(() => groupSteps(project.steps), [project.steps]);
  const groupOf = useMemo(
    () => project.steps.map((_, i) => groups.findIndex((g) => i >= g.from && i <= g.to)),
    [groups, project.steps],
  );

  useEffect(() => {
    let raf = 0;
    let current = -1;
    const update = () => {
      raf = 0;
      const section = sectionRef.current;
      if (!section) return;
      const vh = window.innerHeight;
      const sr = section.getBoundingClientRect();
      if (sr.bottom < -vh || sr.top > vh * 2) return;
      const mid = vh * 0.5;
      const rects = blockRefs.current.map((b) => b?.getBoundingClientRect());

      let act = 0;
      rects.forEach((r, i) => {
        if (r && r.top < mid) act = i;
      });
      if (act !== current) {
        current = act;
        setActive(act);
      }

      groups.forEach((g, gi) => {
        const a = rects[g.from];
        const b = rects[g.to];
        if (!a || !b) return;
        const p = clamp((mid - a.top) / Math.max(1, b.bottom - a.top), 0, 1).toFixed(4);
        layerRefs.current[`w${gi}`]?.style.setProperty('--p', p);
        layerRefs.current[`m${gi}`]?.style.setProperty('--p', p);
      });

      // inline devices (narrow screens): each scrolls as its block passes
      rects.forEach((r, i) => {
        if (!r) return;
        const p = clamp((vh * 0.9 - r.top) / (r.height + vh * 0.4), 0, 1).toFixed(4);
        inlineRefs.current[i]?.querySelectorAll(`.${s.layer}`).forEach((el) => el.style.setProperty('--p', p));
      });

      // the device settles from a slight tilt as the project arrives
      const enter = clamp((vh - sr.top) / (vh * 0.85), 0, 1);
      stageRef.current?.style.setProperty('--enter', enter.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [groups]);

  const goTo = (i) => {
    const b = blockRefs.current[i];
    if (!b) return;
    const r = b.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.5 + 40, behavior: 'smooth' });
  };

  return (
    <article className={s.project} id={project.id} ref={sectionRef} data-flip={index % 2 === 1 || undefined}>
      <header className={s.head}>
        <div>
          <h3 className={s.name}>{project.name}</h3>
          <p className={s.context}>
            {project.context} <span aria-hidden="true">/</span> {project.year}
          </p>
        </div>
        <p className={s.summary}>{project.summary}</p>
        <p className={s.stack}>{project.stack.join('  ·  ')}</p>
        {(project.links.length > 0 || project.video) && (
          <div className={s.links}>
            {project.video && (
              <button className="btn btnPrimary" onClick={() => setVideo({ ...project.video, title: `${project.name} demo` })}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
                </svg>
                {project.video.label}
                <span className={s.dim}>{project.video.length}</span>
              </button>
            )}
            {project.links.map((l) => (
              <a key={l.href} className={s.textLink} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        )}
      </header>

      <div className={s.body}>
        <div className={s.stickyCol}>
          <div className={s.stage} ref={stageRef}>
            <Device
              kind={project.device}
              layers={groups}
              active={groupOf[active]}
              still={project.still}
              refs={layerRefs}
              name={project.name}
            />
          </div>
          {project.steps.length > 1 && (
            <div className={s.tabs} role="tablist" aria-label={`${project.name} highlights`}>
              {project.steps.map((st, i) => (
                <button key={st.tab} role="tab" aria-selected={i === active} onClick={() => goTo(i)}>
                  {st.tab}
                </button>
              ))}
            </div>
          )}
        </div>

        <ol className={s.steps}>
          {project.steps.map((st, i) => (
            <li
              key={st.tab}
              className={s.step}
              data-on={i === active || undefined}
              ref={(el) => (blockRefs.current[i] = el)}
            >
              <div
                className={s.inline}
                ref={(el) => (inlineRefs.current[i] = el)}
                aria-hidden="true"
              >
                <Device
                  kind={project.device}
                  layers={[{ web: st.web, mobile: st.mobile }]}
                  active={0}
                  still={project.still}
                  name={project.name}
                />
              </div>
              <span className="sayTag">{st.tab}</span>
              <h4 className={s.stepTitle}>{st.title}</h4>
              <p className={s.stepText}>{st.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <VideoDialog video={video} onClose={() => setVideo(null)} />
    </article>
  );
}

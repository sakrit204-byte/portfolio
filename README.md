# Sakrit Kafle — Portfolio

An explorable portfolio. The hero is a real map you can walk around: each marker
is a project, and the case study opens in place. Below the map is a conventional
site — services, work, stack, contact — for visitors who'd rather just scroll.

**Live:** [sakritkafle.netlify.app](https://sakritkafle.netlify.app)

## The map

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | move |
| drag | pan the camera |
| `E` | inspect the nearest marker |
| click / tap a marker | open its case study |

Markers are *discovered* by walking near them (or opening them), tracked by the
counter in the corner. Off-screen markers are signposted by arrows at the edge,
and the minimap shows the whole world.

Every marker is also a real `<button>`, so the map is fully keyboard- and
screen-reader navigable. Motion is disabled under `prefers-reduced-motion`, and
the canvas loop pauses when the hero scrolls out of view.

## Architecture

- **`src/data/cv.js`** — single source of truth. Every section, marker and case
  study renders from this file; it mirrors the CV verbatim.
- **`src/components/World.jsx`** — the map. A canvas draws the paper grid, the
  hand-drawn ink routes and the player; markers are DOM buttons in a transformed
  layer above it, so labels stay crisp and accessible. Simulation state lives in
  a ref, not React state — the rAF loop never triggers a re-render.
- **`src/components/CaseStudy.jsx`** — the drawer, shared by the map and the
  work cards. Focus-trapped, Esc to close, scroll-locked.
- **`src/components/Sections.jsx`** — everything below the fold.

## Develop

```bash
npm install
npm run dev      # vite dev server
npm run build    # production build
npm run lint     # eslint
```

## Stack

React 19 · Vite 7 · Framer Motion · CSS Modules · Canvas 2D

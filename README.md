# Sakrit Kafle, portfolio

Personal site of Sakrit Kafle, full stack and AI engineer and cofounder of YADverse.

- **Hero:** a playable five hole golf course built with three.js (`src/three/course.js`, `src/components/Course.jsx`). Each hole opens a chapter of the CV.
- **Work:** projects told through sticky devices whose real screenshots scroll with the page (`src/components/Showcase.jsx`).
- **Content:** everything lives in `src/data/cv.js`.

## Scripts

```bash
npm install
npm run dev                      # local dev server
npm run build                    # production build into dist/
node scripts/build-cv.mjs        # regenerate public/sakrit-kafle-cv.pdf from cv.js
node scripts/capture-shots.mjs   # recapture device screenshots into public/shots/
```

The two scripts drive the locally installed Chrome through `puppeteer-core`
(set `CHROME_PATH` if Chrome lives elsewhere).

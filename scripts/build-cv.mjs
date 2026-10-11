/**
 * Builds public/sakrit-kafle-cv.pdf from src/data/cv.js, so the CV and the
 * site never disagree. Renders print-styled HTML with the local Chrome.
 *
 *   node scripts/build-cv.mjs
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const cv = await import(pathToFileURL(path.resolve('src/data/cv.js')).href);
const { PROFILE, CONTACT, EXPERIENCE, PROJECTS, MORE_WORK, SKILLS, EDUCATION, REFERENCES } = cv;

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (href, label) => `<a href="${href}">${esc(label)}</a>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=PT+Sans:wght@700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 15mm 16mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9.6pt; line-height: 1.45; color: #0b2a33; }
  a { color: inherit; text-decoration: none; }
  h1 { font-family: 'PT Sans', sans-serif; font-size: 25pt; line-height: 1; letter-spacing: -0.01em; }
  .role { margin-top: 4pt; font-size: 11pt; font-weight: 700; color: #007876; }
  .contact { margin-top: 7pt; display: flex; flex-wrap: wrap; gap: 2pt 12pt; font-size: 8.8pt; color: #405860; }
  h2 { margin: 14pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.2pt solid #0b2a33;
       font-size: 8.6pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
  .summary { color: #23414a; }
  .item { margin-top: 8pt; break-inside: avoid; }
  .item:first-of-type { margin-top: 0; }
  .row { display: flex; justify-content: space-between; gap: 12pt; align-items: baseline; }
  .title { font-weight: 800; font-size: 10pt; }
  .title span { font-weight: 600; color: #007876; }
  .when { flex: none; font-size: 8.6pt; font-weight: 700; color: #6f8287; }
  .sub { font-size: 8.8pt; color: #6f8287; }
  ul { margin-top: 3pt; padding-left: 11pt; }
  li { margin-top: 1.5pt; }
  li::marker { color: #007876; }
  p.text { margin-top: 2pt; color: #23414a; }
  .stack { margin-top: 2pt; font-size: 8.4pt; color: #6f8287; }
  .skills { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 18pt; }
  .skills b { font-weight: 800; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18pt; }
</style></head><body>
  <h1>${esc(PROFILE.name)}</h1>
  <p class="role">${esc(PROFILE.role)} · ${esc(PROFILE.studio)}</p>
  <p class="contact">
    <span>${link(CONTACT.phoneHref, CONTACT.phone)}</span>
    <span>${link(`mailto:${CONTACT.email}`, CONTACT.email)}</span>
    <span>${link(CONTACT.githubHref, CONTACT.github)}</span>
    <span>${link(CONTACT.youtubeHref, CONTACT.youtube)}</span>
    <span>${link(CONTACT.studioHref, CONTACT.studio)}</span>
    <span>${esc(PROFILE.location)}</span>
  </p>

  <h2>Profile</h2>
  <p class="summary">${esc(PROFILE.intro)} ${esc(PROFILE.about[1])}</p>

  <h2>Experience</h2>
  ${EXPERIENCE.map(
    (x) => `<div class="item">
      <div class="row"><p class="title">${esc(x.role)}, <span>${x.href ? link(x.href, x.org) : esc(x.org)}</span></p><p class="when">${esc(x.period)}</p></div>
      <p class="sub">${esc(x.place)}</p>
      <ul>${x.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>`,
  ).join('')}

  <h2>Selected projects</h2>
  ${PROJECTS.map((p) => {
    const url = p.links[0]?.href;
    return `<div class="item">
      <div class="row"><p class="title">${url ? link(url, p.name) : esc(p.name)} <span>· ${esc(p.context)}</span></p><p class="when">${esc(p.year)}</p></div>
      <p class="text">${esc(p.summary)}</p>
      <p class="stack">${p.stack.map(esc).join(' · ')}${p.video ? ` · Demo: ${link(`https://youtu.be/${p.video.id}`, `youtu.be/${p.video.id}`)}` : ''}</p>
    </div>`;
  }).join('')}

  <h2>More projects</h2>
  ${MORE_WORK.map(
    (w) => `<div class="item"><p class="title">${link(w.href, w.name)}</p><p class="text">${esc(w.text)}</p></div>`,
  ).join('')}

  <h2>Technical skills</h2>
  <div class="skills">${SKILLS.map((g) => `<p><b>${esc(g.group)}:</b> ${g.items.map(esc).join(', ')}</p>`).join('')}</div>

  <div class="two">
    <div>
      <h2>Education</h2>
      ${EDUCATION.map(
        (e) => `<div class="item"><p class="title">${esc(e.degree)}</p><p class="sub">${esc(e.school)}, ${esc(e.place)} · ${esc(e.period)}</p></div>`,
      ).join('')}
    </div>
    <div>
      <h2>References</h2>
      ${REFERENCES.map(
        (r) => `<div class="item"><p class="title">${esc(r.name)}</p><p class="sub">${esc(r.title)}${r.contact ? ` · ${esc(r.contact)}` : ''}</p></div>`,
      ).join('')}
    </div>
  </div>
</body></html>`;

if (/[\u2013\u2014]/.test(html)) throw new Error('CV contains an en or em dash');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
writeFileSync('public/sakrit-kafle-cv.pdf', pdf);
console.log('wrote public/sakrit-kafle-cv.pdf', `${Math.round(pdf.length / 1024)} KB`);

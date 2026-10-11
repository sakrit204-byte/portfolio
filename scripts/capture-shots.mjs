/**
 * Captures the full-page device screenshots used by the project showcases.
 *
 *   node scripts/capture-shots.mjs            # public sites + plantation login
 *   PT_EMAIL=.. PT_PASSWORD=.. node scripts/capture-shots.mjs plantation
 *
 * Desktop shots are 1440 wide, phone shots are 390 wide at 2x. Output goes to
 * public/shots/<project>/{web,mobile}-<name>.jpg. Uses the locally installed
 * Chrome through puppeteer-core.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve('public/shots');
const PT = process.env.PT_URL ?? 'http://localhost:3000';

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scroll through the page so lazy images and scroll reveals fire. */
async function primePage(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, 0);
  });
  await wait(900);
}

/** Blur personal data (names, phone numbers, emails) before a capture. */
async function maskPersonalData(page) {
  // inline style attributes survive a strict CSP where <style> tags do not
  await page.evaluate(() => {
    const sel = '[data-pii], td, .person, .user-name, .phone, a[href^="tel:"], a[href^="mailto:"]';
    document.querySelectorAll(sel).forEach((el) => (el.style.filter = 'blur(5px)'));
  });
}

async function shoot(browser, { url, file, device, full = true, maxHeight = 7200, before }) {
  const page = await browser.newPage();
  await page.setViewport(device);
  if (device.isMobile) await page.setUserAgent(PHONE_UA);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1200);
  if (before) await before(page);
  if (full) await primePage(page);
  const height = full
    ? Math.min(maxHeight, await page.evaluate(() => document.documentElement.scrollHeight))
    : device.height;
  const dest = path.join(OUT, file);
  mkdirSync(path.dirname(dest), { recursive: true });
  await page.screenshot({
    path: dest,
    type: 'jpeg',
    quality: 82,
    clip: { x: 0, y: 0, width: device.width, height },
    captureBeyondViewport: true,
  });
  console.log('saved', file, `${device.width}x${height}`);
  await page.close();
}

async function plantationLoggedIn(browser) {
  const { PT_EMAIL, PT_PASSWORD } = process.env;
  if (!PT_EMAIL || !PT_PASSWORD) {
    console.log('skip plantation app screens: set PT_EMAIL and PT_PASSWORD');
    return;
  }
  // one page, one login: the session cookie carries over between routes
  const page = await browser.newPage();
  await page.setViewport(DESKTOP);
  await page.goto(`${PT}/#/login`, { waitUntil: 'networkidle2' });
  await page.type('input[type=email], input[name=email], input[placeholder*="email" i]', PT_EMAIL);
  await page.type('input[type=password]', PT_PASSWORD);
  await page.keyboard.press('Enter');
  await wait(3500);

  const pages = [
    ['portal/dashboard', 'web-dashboard', DESKTOP],
    ['portal/analytics', 'web-analytics', DESKTOP],
    ['portal/monitoring', 'web-monitoring', DESKTOP],
    ['locations', 'mobile-locations', PHONE],
  ];
  for (const [route, name, device] of pages) {
    await page.setViewport(device);
    await page.setUserAgent(device.isMobile ? PHONE_UA : (await browser.userAgent()));
    await page.goto(`${PT}/#/${route}`, { waitUntil: 'networkidle2' });
    await wait(3500);
    await maskPersonalData(page);
    const height = Math.min(4200, await page.evaluate(() => document.documentElement.scrollHeight));
    const dest = path.join(OUT, `plantation/${name}.jpg`);
    mkdirSync(path.dirname(dest), { recursive: true });
    await page.screenshot({
      path: dest,
      type: 'jpeg',
      quality: 82,
      clip: { x: 0, y: 0, width: device.width, height },
      captureBeyondViewport: true,
    });
    console.log('saved', `plantation/${name}.jpg`, `${device.width}x${height}`);
  }
  await page.close();
}

const only = process.argv[2];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
try {
  if (!only || only === 'public') {
    await shoot(browser, { url: 'https://yourfleetelite.com.au/', file: 'yourfleetelite/web-home.jpg', device: DESKTOP });
    await shoot(browser, { url: 'https://yourfleetelite.com.au/', file: 'yourfleetelite/mobile-home.jpg', device: PHONE });
    await shoot(browser, { url: 'https://yadverse.tech/', file: 'yadverse/web-home.jpg', device: DESKTOP });
    await shoot(browser, { url: 'https://yadverse.tech/', file: 'yadverse/mobile-home.jpg', device: PHONE });
    await shoot(browser, { url: `${PT}/#/login`, file: 'plantation/web-login.jpg', device: DESKTOP, full: false });
    await shoot(browser, { url: `${PT}/#/login`, file: 'plantation/mobile-login.jpg', device: PHONE, full: false });
  }
  if (!only || only === 'plantation') await plantationLoggedIn(browser);
} finally {
  await browser.close();
}

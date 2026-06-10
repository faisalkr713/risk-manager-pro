import { createRequire } from 'module';
const require = createRequire('C:/Users/faisa/AppData/Roaming/npm/node_modules/playwright/');
const { chromium } = require('C:/Users/faisa/AppData/Roaming/npm/node_modules/playwright/');

const pages = [
  { url: 'http://localhost:5173/', name: 'dashboard' },
  { url: 'http://localhost:5173/', name: 'calculator', nav: 'Calculator' },
  { url: 'http://localhost:5173/', name: 'journal', nav: 'Journal' },
  { url: 'http://localhost:5173/', name: 'discipline', nav: 'Discipline' },
];

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1400, height: 900 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await p.screenshot({ path: 'C:/Users/faisa/Risk manager pro/ss_dashboard.png' });
  console.log('dashboard done');

  // Click through nav items
  const navItems = ['Calculator', 'Journal', 'Discipline', 'Statistics', 'Brokers'];
  for (const nav of navItems) {
    try {
      await p.click(`text=${nav}`, { timeout: 3000 });
      await p.waitForTimeout(800);
      await p.screenshot({ path: `C:/Users/faisa/Risk manager pro/ss_${nav.toLowerCase()}.png` });
      console.log(`${nav} done`);
    } catch(e) { console.log(`skip ${nav}: ${e.message}`); }
  }

  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

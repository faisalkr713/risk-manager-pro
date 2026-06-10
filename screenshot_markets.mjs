import { chromium } from 'playwright';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await p.click('text=Risk Calculator');
  await p.waitForTimeout(500);

  for (const market of ['Forex', 'Metals', 'Indices', 'Stocks', 'Crypto']) {
    await p.click(`button.pill:has-text("${market}")`);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `ss_market_${market.toLowerCase()}.png` });
    console.log(`${market} done`);
  }

  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

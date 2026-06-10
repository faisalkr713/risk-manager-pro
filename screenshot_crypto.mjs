import { chromium } from 'playwright';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });

  await p.click('text=Risk Calculator');
  await p.waitForTimeout(600);

  // Click Crypto pill
  await p.click('button.pill:has-text("Crypto")');
  await p.waitForTimeout(3500); // wait for BTCUSDT live price from Binance

  await p.screenshot({ path: 'ss_crypto_live.png' });

  const entryVal = await p.$eval('input.price-input', (el) => el.value).catch(() => '');
  console.log('Entry auto-filled:', entryVal);

  const entry = parseFloat(entryVal);
  if (entry > 0) {
    const sl = (entry * 0.99).toFixed(2);
    const inputs = await p.$$('input.price-input');
    if (inputs[1]) {
      await inputs[1].fill(sl);
      await p.waitForTimeout(1000);
    }
  }

  await p.screenshot({ path: 'ss_crypto_with_results.png' });
  console.log('done');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

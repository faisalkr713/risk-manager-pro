import { chromium } from 'playwright';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await p.screenshot({ path: 'ss_auth_login.png' });
  await p.click('button.auth-tab:nth-child(2)');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'ss_auth_signup.png' });
  await b.close();
  console.log('done');
})().catch(e => { console.error(e.message); process.exit(1); });

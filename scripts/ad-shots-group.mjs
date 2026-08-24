/**
 * Re-shoots the group-compare hero on Thursday, replacing the Friday frame.
 *
 * Same friend selection and framing as scripts/ad-shots.mjs: @rets, @alifuo_
 * and @gizzy (never @alyssia_08 — her 1 AM class drags the grid's range down
 * and opens every day on seven empty small-hours rows), anchored on the "You"
 * column label so the header row stays clear of the sticky day pills.
 */

async (page) => {

const OUT = 'C:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher/ad-screenshots/';
const BASE = 'http://localhost:5177';
const PICK = [0, 2, 5];

const CTX = {
  viewport: { width: 405, height: 865 },
  deviceScaleFactor: 2.66667,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
};

const HIDE_SCROLLBARS = `
  *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important }
  html { scrollbar-width: none !important }
`;

  const browser = page.context().browser();
  const state = await page.context().storageState();
  const notes = [];

  const c = await browser.newContext({ ...CTX, storageState: state });
  const p = await c.newPage();

  await p.goto(BASE + '/compare', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);

  const boxes = await p.locator('input[type="checkbox"]').all();
  for (const box of boxes) if (await box.isChecked()) await box.click().catch(() => {});
  await p.waitForTimeout(500);
  for (const i of PICK) await boxes[i]?.click().catch(() => {});
  await p.waitForTimeout(2800);
  await p.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});

  // Both Tuesday and Thursday show a "T" pill, so this relies on the
  // accessible name rather than the visible letter.
  await p.getByRole('button', { name: 'Thu', exact: true }).click();
  await p.waitForTimeout(1000);

  await p.evaluate(() => {
    const label = [...document.querySelectorAll('p')].find((el) => el.textContent.trim() === 'You');
    if (label) window.scrollTo(0, window.scrollY + label.getBoundingClientRect().top - 120);
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + '19-group-compare-thu.png', scale: 'device' });

  notes.push('comparing: ' + (await p.locator('main p').first().textContent().catch(() => '?')));
  notes.push('active day pill: ' + (await p.locator('button[aria-pressed="true"]').first().getAttribute('aria-label').catch(() => '?')));
  notes.push('hours in frame: ' + (await p.locator('p, div, span').evaluateAll((els) => {
    const hs = els.filter((e) => e.children.length === 0 && /^\d{1,2} (AM|PM)$/.test(e.textContent.trim()))
      .map((e) => e.textContent.trim());
    return hs.length ? `${hs[0]} .. ${hs[hs.length - 1]}` : 'none';
  })));
  notes.push('classes in frame: ' + JSON.stringify(await p.locator('main [class*="truncate"]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.textContent.trim()).filter(Boolean))].slice(0, 12))));

  await c.close();
  return { notes };
}

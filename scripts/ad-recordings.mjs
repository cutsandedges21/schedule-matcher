/**
 * Ad screen recordings — 1080x1920 (9:16) webm, phone layout.
 *
 * Run through the Playwright MCP's `browser_run_code_unsafe` with `filename`,
 * from a tab already signed in to the app; it borrows that page's browser and
 * storage state.
 *
 * ## Why the app runs inside a scaled iframe
 *
 * Video capture ignores `deviceScaleFactor`: a 405x720 phone viewport recorded
 * at `size: 1080x1920` comes out as a 405x720 image padded with grey, because
 * Playwright only ever scales frames *down* to fit. CSS `zoom` on the root is no
 * help either — media queries keep reading the real 1080px viewport, so the app
 * lays out for desktop.
 *
 * So the page is a 1080x1920 stage holding a 405x720 iframe under
 * `transform: scale(2.667)`. The iframe gets its own 405px layout viewport, so
 * `(min-width:1024px)` stays false and the phone layout renders; Chromium
 * re-rasterizes the scaled layer, so the result is sharp rather than upscaled.
 *
 * ## Why port 5178
 *
 * The working tree is mid-feature on the `pinned` column: the client selects it
 * but migration 0015 has not been applied, so every profile fetch 400s and the
 * dev server error-boundaries. dist/ predates that change and matches the live
 * schema, so `vite preview` on 5178 runs — and leaves 5177 free for editing.
 *
 * ## What it must not leave behind
 *
 * - Clip 1 never presses Save. `replace_schedule` would overwrite the real
 *   schedule on this account, which is the one thing ruled out.
 * - Clip 3 does write cosmetics, so the original card colour, banner and effect
 *   are read out of the radio groups first and put back afterwards, in a
 *   separate context so the restoring taps stay out of the video.
 */

async (page) => {

const ROOT = 'C:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher/ad-recordings/';
const SAMPLE = 'C:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher/IMG_0876.PNG';
const SIGNED_IN_ORIGIN = 'http://localhost:5177';
const BASE = 'http://localhost:5178';
const STAGE = BASE + '/__stage';

const PHONE = { width: 405, height: 720 };
const SCALE = 2.666667;

const VIEW = {
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
};

const STAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#F8FAFC;overflow:hidden;width:1080px;height:1920px}
  #f{width:${PHONE.width}px;height:${PHONE.height}px;border:0;display:block;
     transform:scale(${SCALE});transform-origin:0 0}
  /* The fingertip lives out here in the stage, not in the app, so it renders at
     native 1080p and its coordinates match locator.boundingBox() directly. */
  #cursor{position:fixed;left:0;top:0;width:90px;height:90px;margin:-45px 0 0 -45px;
    border-radius:9999px;background:rgba(15,23,42,.20);border:5px solid rgba(15,23,42,.42);
    pointer-events:none;z-index:2147483647;opacity:0;
    transition:transform .45s cubic-bezier(.22,.61,.36,1),opacity .25s;
    transform:translate(540px,1600px)}
</style></head><body>
  <iframe id="f" src="/"></iframe><div id="cursor"></div>
  <script>
    const dot = document.getElementById('cursor');
    window.__cursorTo = (x, y) => { dot.style.opacity = '1'; dot.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
    window.__cursorTap = () => {
      const at = dot.style.transform;
      dot.animate([{transform: at + ' scale(1)'},{transform: at + ' scale(.55)'},{transform: at + ' scale(1)'}],
        { duration: 300, easing: 'ease-out' });
    };
    window.__cursorHide = () => { dot.style.opacity = '0'; };
    window.__go = (path) => { document.getElementById('f').src = path; };
  </script>
</body></html>`;

const HIDE_SCROLLBARS = `
  *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important }
  html { scrollbar-width: none !important }
`;

async function newClip(browser, state, name) {
  const c = await browser.newContext({
    ...VIEW,
    storageState: state,
    recordVideo: { dir: ROOT + name, size: { width: 1080, height: 1920 } },
  });
  const p = await c.newPage();
  await p.route(STAGE, (route) => route.fulfill({ contentType: 'text/html', body: STAGE_HTML }));
  await p.goto(STAGE);
  return { c, p };
}

/** The app's own frame. Re-read after every `go`, since the document changes. */
function appFrame(p) {
  return p.frames().find((f) => f !== p.mainFrame());
}

const app = (p) => p.frameLocator('#f');

/** Points the iframe at a route and waits for the app to settle. */
async function go(p, path, { settle = 1800 } = {}) {
  await p.evaluate((to) => window.__go(to), path);
  await p.waitForTimeout(settle);
  await appFrame(p)?.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});
  await p.waitForTimeout(300);
}

/** Glides the fingertip onto a target, pulses it, then really clicks. */
async function tap(p, loc, { after = 900, before = 620 } = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const box = await loc.boundingBox();
  if (box) {
    await p.evaluate(([x, y]) => window.__cursorTo(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
    await p.waitForTimeout(before);
    await p.evaluate(() => window.__cursorTap());
    await p.waitForTimeout(200);
  }
  await loc.click();
  await p.waitForTimeout(after);
}

async function glide(p, y, { settle = 1200 } = {}) {
  await appFrame(p)?.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await p.waitForTimeout(settle);
}

/** Smooth-scrolls the row labelled `hour` to just under the day pills. */
async function glideToHour(p, hour, { settle = 1300 } = {}) {
  await appFrame(p)?.evaluate((label) => {
    const row = [...document.querySelectorAll('div, span')]
      .find((el) => el.children.length === 0 && el.textContent.trim() === label);
    if (row) window.scrollTo({ top: window.scrollY + row.getBoundingClientRect().top - 130, behavior: 'smooth' });
  }, hour);
  await p.waitForTimeout(settle);
}

const readCosmetics = (p) =>
  appFrame(p).evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[role="radiogroup"]')].map((group) => [
        group.getAttribute('aria-label'),
        group.querySelector('[aria-checked="true"]')?.getAttribute('aria-label') ?? null,
      ])
    )
  );

  const browser = page.context().browser();
  const out = {};
  const notes = [];

  // localStorage is per-origin, so the session under the dev server's origin has
  // to be copied across to the preview server's before anything is signed in.
  const raw = await page.context().storageState();
  const signedIn = raw.origins.find((o) => o.origin === SIGNED_IN_ORIGIN);
  if (!signedIn) throw new Error(`no stored session for ${SIGNED_IN_ORIGIN} — sign in on that tab first`);
  const state = { ...raw, origins: [...raw.origins, { origin: BASE, localStorage: signedIn.localStorage }] };

  // ===================================================================
  // Clip 1 — a screenshot becomes a schedule.
  // ===================================================================
  {
    const { c, p } = await newClip(browser, state, '01-read-my-schedule');
    const video = p.video();

    await go(p, '/', { settle: 2600 });
    await p.waitForTimeout(900);
    await tap(p, app(p).getByRole('link', { name: /Replace|Add/ }), { after: 1600 });
    await appFrame(p)?.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});

    // Playwright intercepts the file chooser, so no native dialog ever opens.
    const [chooser] = await Promise.all([
      p.waitForEvent('filechooser'),
      tap(p, app(p).getByRole('button', { name: 'Choose a screenshot' }), { after: 300 }),
    ]);
    await chooser.setFiles(SAMPLE);

    await app(p).getByRole('button', { name: 'Use full image' }).waitFor({ timeout: 30000 });
    await p.waitForTimeout(2400);
    await tap(p, app(p).getByRole('button', { name: 'Use full image' }), { after: 400 });

    // The progress screen runs on its own; just let it play.
    await app(p).getByRole('button', { name: /Save schedule/ }).waitFor({ timeout: 120000 });
    await appFrame(p)?.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});
    await p.waitForTimeout(1800);

    // The "you can fix anything we misread" beat, typed out rather than filled.
    let corrected = false;
    for (const input of await app(p).locator('input').all()) {
      if (((await input.getAttribute('type')) || 'text') !== 'text') continue;
      const value = await input.inputValue().catch(() => null);
      if (!value || !/\bpiscrete\b/i.test(value)) continue;
      await input.scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      const box = await input.boundingBox();
      if (box) {
        await p.evaluate(([x, y]) => window.__cursorTo(x, y), [box.x + 160, box.y + box.height / 2]);
        await p.waitForTimeout(600);
        await p.evaluate(() => window.__cursorTap());
      }
      await input.click();
      await input.selectText();
      await p.waitForTimeout(500);
      await input.type(value.replace(/\bpiscrete\b/gi, 'Discrete'), { delay: 60 });
      corrected = true;
      await p.waitForTimeout(1400);
      break;
    }
    if (!corrected) notes.push('clip 1: the reader got every class right this run, so the typing beat was skipped');

    await glide(p, 0, { settle: 1500 });
    await p.evaluate(() => window.__cursorHide());
    await p.waitForTimeout(1500);

    // Ends here on purpose. Nothing is saved, so the real schedule is untouched.
    await c.close();
    out['01-read-my-schedule'] = await video.path();
  }

  // ===================================================================
  // Clip 2 — when are we both free?
  // ===================================================================
  {
    const { c, p } = await newClip(browser, state, '02-find-free-time');
    const video = p.video();

    await go(p, '/friends', { settle: 2600 });
    await glide(p, 260);
    await tap(p, app(p).getByRole('link', { name: 'Compare' }).first(), { after: 2400 });
    await appFrame(p)?.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});

    await p.waitForTimeout(1700);          // read the "Both free" summary
    await glide(p, 330, { settle: 2100 }); // then the side-by-side grid

    await tap(p, app(p).getByRole('button', { name: 'Go back' }), { after: 2000 });
    await glide(p, 260, { settle: 900 });
    await tap(p, app(p).getByRole('link', { name: 'Compare several' }), { after: 2000 });

    const boxes = await app(p).locator('input[type="checkbox"]').all();
    for (const box of boxes.slice(0, 3)) await tap(p, box, { after: 850, before: 520 });

    await p.waitForTimeout(2400);
    await glide(p, 430, { settle: 2300 }); // "Everyone free" + "Classes together"

    await tap(p, app(p).getByRole('button', { name: 'Fri', exact: true }), { after: 900 });
    await glideToHour(p, '9 AM', { settle: 2500 });
    await p.evaluate(() => window.__cursorHide());
    await p.waitForTimeout(1700);

    await c.close();
    out['02-find-free-time'] = await video.path();
  }

  // ===================================================================
  // Clip 3 — make the card yours. Writes cosmetics; restored below.
  // ===================================================================
  let original = null;
  {
    const { c, p } = await newClip(browser, state, '03-customize-card');
    const video = p.video();

    await go(p, '/settings/customization', { settle: 2800 });
    original = await readCosmetics(p);

    const group = (label) => app(p).locator(`[role="radiogroup"][aria-label="${label}"]`);
    await p.waitForTimeout(1300);

    // Two hues, so the live card visibly re-tints under the finger.
    await tap(p, group('Card colour').getByRole('radio').nth(6), { after: 1200 });
    await tap(p, group('Card colour').getByRole('radio').nth(17), { after: 1500 });

    await glide(p, 380, { settle: 1300 });
    await tap(p, group('Banner').getByRole('radio').nth(11), { after: 1600 });

    await glide(p, 760, { settle: 1300 });
    await tap(p, group('Effect').getByRole('radio').nth(3), { after: 1600 });

    // Back up to the live preview so the clip ends on the finished card.
    await glide(p, 0, { settle: 1900 });
    await p.evaluate(() => window.__cursorHide());
    await p.waitForTimeout(1900);

    await c.close();
    out['03-customize-card'] = await video.path();
  }

  // Put the card back exactly as it was, off camera.
  {
    const c = await browser.newContext({ ...VIEW, storageState: state });
    const p = await c.newPage();
    await p.route(STAGE, (route) => route.fulfill({ contentType: 'text/html', body: STAGE_HTML }));
    await p.goto(STAGE);
    await go(p, '/settings/customization', { settle: 2600 });

    for (const [groupLabel, optionLabel] of Object.entries(original ?? {})) {
      if (!optionLabel) continue;
      const target = app(p).locator(`[role="radiogroup"][aria-label="${groupLabel}"]`)
        .getByRole('radio', { name: optionLabel, exact: true });
      if (await target.count()) {
        await target.first().click().catch(() => {});
        await p.waitForTimeout(750);
      }
    }
    await p.waitForTimeout(1500);
    await go(p, '/settings/customization', { settle: 2600 });
    notes.push(`cosmetics before: ${JSON.stringify(original)}`);
    notes.push(`cosmetics after restore: ${JSON.stringify(await readCosmetics(p))}`);
    await c.close();
  }

  return { out, notes };
}

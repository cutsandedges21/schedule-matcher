/**
 * Ad screenshot capture — 1080x2307, phone layout.
 *
 * Sized for the iPhone screen on freemockup.video rather than for a bare 9:16
 * frame. That model's `Screen` mesh is 1.81238 x 3.87117 world units — a ratio
 * of 2.136, or 9:19.22 — and the app maps an upload straight onto its UVs with
 * no cover/contain, so anything else is stretched rather than cropped. 405 CSS
 * px at a 2.667 device pixel ratio gives 1080 wide; 865 tall lands on 2307.
 *
 * Not a standalone script. Run it through the Playwright MCP's
 * `browser_run_code_unsafe` with `filename`, from a browser tab already signed
 * in to the app: it borrows that page's browser and storage state.
 *
 * Sign-in is Google OAuth only, which is why the session is borrowed rather
 * than established here.
 *
 * The upload flow runs end to end but deliberately never presses Save — the
 * account it runs against has a real schedule on it, and `replace_schedule`
 * would overwrite it.
 */

async (page) => {

const OUT = 'C:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher/ad-screenshots/';
const BASE = 'http://localhost:5177';
const SAMPLE = 'C:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher/IMG_0876.PNG';

const CTX = {
  viewport: { width: 405, height: 865 },
  deviceScaleFactor: 2.66667,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
};

/** Scrollbars are a desktop artefact — a phone screenshot must not have one. */
const HIDE_SCROLLBARS = `
  *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important }
  html { scrollbar-width: none !important }
`;

async function shot(p, name, { settle = 900 } = {}) {
  await p.addStyleTag({ content: HIDE_SCROLLBARS }).catch(() => {});
  await p.waitForTimeout(settle);
  await p.screenshot({ path: OUT + name + '.png', scale: 'device' });
  return name;
}

async function open(p, path, { settle = 1400 } = {}) {
  await p.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(settle);
}

/**
 * Puts the group grid's "You" column label just clear of the sticky day pills.
 *
 * Anchoring on an hour row instead pushes the whole column-name header up
 * behind those pills, and four unlabelled columns don't tell an ad viewer that
 * these are four different people. GroupGrid renders each label as a <p>
 * (GroupGrid.tsx:156).
 */
async function frameFromYouLabel(p) {
  await p.evaluate(() => {
    const label = [...document.querySelectorAll('p')].find((el) => el.textContent.trim() === 'You');
    if (label) window.scrollTo(0, window.scrollY + label.getBoundingClientRect().top - 120);
  });
}

  const browser = page.context().browser();
  const state = await page.context().storageState();
  const done = [];
  const notes = [];

  // ---- Signed out: the login/hero screen. Its own context, no session. ----
  {
    const c = await browser.newContext(CTX);
    const p = await c.newPage();
    await open(p, '/login');
    done.push(await shot(p, '01-login'));
    await c.close();
  }

  const c = await browser.newContext({ ...CTX, storageState: state });
  const p = await c.newPage();

  // ---- The reader: pick -> crop -> read -> review. ----
  await open(p, '/upload');
  done.push(await shot(p, '02-upload-start'));

  await p.setInputFiles('input[type="file"]', SAMPLE);
  await p.waitForSelector('text=Use full image');
  done.push(await shot(p, '03-crop'));

  // Full image rather than the default inset crop: the inset clips the Monday
  // and Friday columns, and a demo of the reader should read everything.
  await p.getByRole('button', { name: 'Use full image' }).click();

  // "Getting the reader ready…" is the first and least interesting label — wait
  // for a phase that names what it is doing, but don't hang if extraction wins.
  await p
    .waitForFunction(() => !/Getting the reader ready/.test(document.body.innerText), null, { timeout: 20000 })
    .catch(() => notes.push('reader never moved past the first progress label'));
  if (await p.locator('[aria-busy="true"]').count()) {
    done.push(await shot(p, '04-reading', { settle: 200 }));
  } else {
    notes.push('extraction finished before the progress screen could be captured');
  }

  // ReviewForm renders a plain <div>, so there is no <form> to wait on.
  try {
    await p.getByRole('button', { name: /Save schedule/ }).waitFor({ timeout: 120000 });
    await p.waitForTimeout(1200);

    // The OCR reads "Discrete" as "piscrete" often enough to land in frame, and
    // an ad should not lead with a typo. Correcting it in the field is what a
    // student does at this step anyway. The name input carries no `type`
    // attribute, so this walks every input rather than `input[type=text]`.
    for (const input of await p.locator('input').all()) {
      if (((await input.getAttribute('type')) || 'text') !== 'text') continue;
      const before = await input.inputValue().catch(() => null);
      if (before == null) continue;
      const after = before.replace(/\bpiscrete\b/gi, 'Discrete');
      if (after !== before) await input.fill(after);
    }

    await p.evaluate(() => window.scrollTo(0, 0));
    done.push(await shot(p, '05-review', { settle: 800 }));
    await p.evaluate(() => window.scrollTo(0, 520));
    done.push(await shot(p, '06-review-scrolled', { settle: 700 }));
  } catch (caught) {
    notes.push('review form never appeared: ' + caught.message);
  }

  // Leaving without saving, on purpose. See the header.
  await open(p, '/');

  // ---- My schedule, a day at a time. ----
  done.push(await shot(p, '07-schedule-mon'));
  for (const [day, name] of [['Tue', '08-schedule-tue'], ['Thu', '09-schedule-thu']]) {
    await p.getByRole('button', { name: day, exact: true }).click().catch(() => {});
    done.push(await shot(p, name, { settle: 700 }));
  }

  // ---- Friends. ----
  await open(p, '/friends');
  done.push(await shot(p, '10-friends'));
  await p.evaluate(() => window.scrollTo(0, 260));
  done.push(await shot(p, '11-friends-list', { settle: 600 }));

  // ---- One-to-one compare: the summary, then the overlap grid. ----
  await open(p, '/compare/rets');
  done.push(await shot(p, '12-compare-summary'));
  await p.evaluate(() => window.scrollTo(0, 330));
  done.push(await shot(p, '13-compare-grid', { settle: 700 }));

  // ---- Group compare: pick three, then the shared free time. ----
  //
  // Deliberately @rets, @alifuo_ and @gizzy rather than the first three in the
  // list. The grid sizes its range across every selected person's whole week,
  // and @alyssia_08 has a 1 AM class — including her opens every day on seven
  // empty small-hours rows. She is the only friend who does that.
  await open(p, '/compare');
  const boxes = await p.locator('input[type="checkbox"]').all();
  for (const box of boxes) if (await box.isChecked()) await box.click().catch(() => {});
  await p.waitForTimeout(500);
  for (const i of [0, 2, 5]) await boxes[i]?.click().catch(() => {});
  await p.waitForTimeout(2800);
  done.push(await shot(p, '14-group-compare'));
  for (const [day, name] of [['Wed', '15-group-compare-wed'], ['Fri', '19-group-compare-fri']]) {
    await p.getByRole('button', { name: day, exact: true }).click().catch(() => {});
    await p.waitForTimeout(800);
    await frameFromYouLabel(p);
    done.push(await shot(p, name, { settle: 700 }));
  }

  // ---- Customization: card colour, banner, effect. ----
  await open(p, '/settings/customization');
  done.push(await shot(p, '16-customization'));
  await p.evaluate(() => window.scrollTo(0, 380));
  done.push(await shot(p, '17-customization-swatches', { settle: 700 }));

  // ---- A friend's schedule, on a day they have more than one class. ----
  await open(p, '/u/rets');
  await p.getByRole('button', { name: 'Thu', exact: true }).click().catch(() => {});
  done.push(await shot(p, '18-friend-schedule', { settle: 800 }));

  await c.close();
  return { done, notes };
}

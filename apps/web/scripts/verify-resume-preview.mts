import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import puppeteer, { type Page } from 'puppeteer';

const origin = 'https://gbaolt.localhost';
const evidence = path.resolve(
  '../../.scratch/resume-pdf-performance/verification'
);
await fs.mkdir(evidence, { recursive: true });
const browser = await puppeteer.launch({
  headless: true,
  acceptInsecureCerts: true,
});
const results: unknown[] = [];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ready(page: Page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '.react-pdf__Page canvas'
      );
      return (
        canvas?.getClientRects().length &&
        canvas.width &&
        canvas.height &&
        !document.querySelector(
          '[data-slot="resume-viewer"] [role="status"]'
        ) &&
        document.querySelector('.textLayer span')
      );
    },
    { timeout: 30000 }
  );
}

async function mobile(width = 390, dpr = 3) {
  const page = await browser.newPage();
  await page.setViewport({
    width,
    height: 844,
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
  });
  return page;
}

try {
  console.log('Checking mobile raster budgets');
  for (const width of [320, 390, 440]) {
    for (const dpr of [1, 2, 3]) {
      const page = await mobile(width, dpr);
      await page.goto(`${origin}/resume`, { waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.waitForFunction(
        () => document.querySelectorAll('.textLayer span').length > 150
      );
      const metrics = await page.evaluate(() => {
        const viewport = document.querySelector<HTMLElement>(
          '[data-slot="resume-viewer-viewport"]'
        )!;
        const pages = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-slot="resume-viewer-page"]'
          )
        );
        return {
          pages: pages.map((page) => ({
            width: page.getBoundingClientRect().width,
            top: page.getBoundingClientRect().top,
            dpr: Number(page.dataset.devicePixelRatio),
          })),
          canvases: Array.from(
            document.querySelectorAll<HTMLCanvasElement>(
              '.react-pdf__Page canvas'
            )
          ).map((canvas) => ({ width: canvas.width, height: canvas.height })),
          viewportBottom: viewport.getBoundingClientRect().bottom,
          links: document.querySelectorAll('.annotationLayer a[aria-label]')
            .length,
        };
      });
      assert.equal(metrics.pages.length, 2);
      assert(metrics.pages.every((page) => page.dpr <= Math.min(dpr, 2)));
      assert(
        metrics.canvases.every(
          (canvas) =>
            canvas.width <= (metrics.pages[0].width + 16) * Math.min(dpr, 2)
        )
      );
      assert(metrics.links > 0);
      if (metrics.pages[1].top > metrics.viewportBottom)
        assert.equal(metrics.canvases.length, 1);
      results.push({ width, dpr, ...metrics });
      await page.close();
    }
  }

  console.log('Checking scrolling, selection, and zoom');
  const page = await mobile();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${origin}/resume`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForFunction(
    () => document.querySelectorAll('.textLayer span').length > 150
  );
  const geometry = await page.evaluate(() => {
    const pages = Array.from(
      document.querySelectorAll('[data-slot="resume-viewer-page"]')
    );
    const first = pages[0].querySelector('.textLayer span')!;
    const last = pages[1].querySelector('.textLayer span')!;
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return {
      text: selection.toString(),
      height: pages[0].getBoundingClientRect().height,
      secondTop:
        pages[1].getBoundingClientRect().top -
        pages[0].getBoundingClientRect().top,
    };
  });
  await page.$eval('[data-slot="resume-viewer-viewport"]', (viewport) => {
    viewport.scrollTop = viewport.scrollHeight;
  });
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLCanvasElement>(
        '[data-page-number="2"] .react-pdf__Page canvas'
      )?.width
  );
  assert.equal(
    await page.evaluate(() => window.getSelection()?.toString()),
    geometry.text
  );
  await page.$eval('[data-slot="resume-viewer-viewport"]', (viewport) => {
    viewport.scrollTop = 0;
  });
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll('.react-pdf__Page canvas').length
    ),
    2
  );
  const after = await page.evaluate(() => {
    const pages = Array.from(
      document.querySelectorAll('[data-slot="resume-viewer-page"]')
    );
    return {
      height: pages[0].getBoundingClientRect().height,
      secondTop:
        pages[1].getBoundingClientRect().top -
        pages[0].getBoundingClientRect().top,
    };
  });
  assert.deepEqual(after, {
    height: geometry.height,
    secondTop: geometry.secondTop,
  });

  await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(
      '[data-slot="resume-viewer-page"]'
    )!;
    const canvas = frame.querySelector('.react-pdf__Page canvas');
    const snapshots: { width: number; alpha: number }[] = [];
    Object.assign(window, { resumeCanvas: canvas, resumeSnapshots: snapshots });
    const observer = new MutationObserver(() => {
      const overlay = frame.querySelector<HTMLCanvasElement>(':scope > canvas');
      if (
        overlay &&
        overlay.width > 0 &&
        !overlay.classList.contains('invisible')
      ) {
        snapshots.push({
          width: overlay.width,
          alpha: overlay.getContext('2d')!.getImageData(0, 0, 1, 1).data[3],
        });
      }
    });
    observer.observe(frame, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    Object.assign(window, { resumeSnapshotObserver: observer });
  });
  for (let index = 0; index < 8; index++)
    await page.click('button[aria-label="Zoom in"]');
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector<HTMLElement>('[data-slot="resume-viewer-page"]')
          ?.dataset.rasterWidth
      ) >= 990
  );
  await pause(500);
  const retained = await page.evaluate(() => {
    const state = window as typeof window & {
      resumeCanvas: Element;
      resumeSnapshots: { width: number; alpha: number }[];
      resumeSnapshotObserver: MutationObserver;
    };
    state.resumeSnapshotObserver.disconnect();
    return {
      sameCanvas:
        state.resumeCanvas ===
        document.querySelector('.react-pdf__Page canvas'),
      snapshots: state.resumeSnapshots,
    };
  });
  assert(retained.sameCanvas);
  assert(
    retained.snapshots.some(
      (snapshot) => snapshot.width >= 672 && snapshot.alpha === 255
    )
  );
  assert(
    await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLCanvasElement>('.react-pdf__Page canvas')
      ).every((canvas) => canvas.width * canvas.height <= 8_000_000)
    )
  );
  assert(
    await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLCanvasElement>(
          '[data-slot="resume-viewer-page"] > canvas'
        )
      ).every((canvas) => canvas.width === 0 && canvas.height === 0)
    )
  );
  await page.click('button[aria-label="Fit width"]');

  await page.setViewport({
    width: 740,
    height: 390,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await pause(500);
  await ready(page);
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await pause(500);
  await ready(page);
  await pause(500);
  await page.focus('[data-slot="resume-viewer-viewport"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('=');
  await page.keyboard.up('Control');
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector<HTMLElement>('[data-slot="resume-viewer-page"]')
          ?.dataset.displayedWidth
      ) > 332
  );
  await page.click('button[aria-label="Fit width"]');

  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }, theme);
    await page.screenshot({
      path: path.join(evidence, `resume-${theme}.png`),
      fullPage: true,
    });
  }
  const fonts = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="preload"][as="font"]'
      )
    ).map((link) => link.href)
  );
  assert.equal(fonts.length, 4);
  assert(
    fonts.every((font) => !/Pixel_(Circle|Grid|Line|Triangle)/.test(font))
  );
  const servedPdf = await page.evaluate(async () =>
    Array.from(new Uint8Array(await (await fetch('/resume.pdf')).arrayBuffer()))
  );
  const localPdf = await fs.readFile('public/resume.pdf');
  const hash = (bytes: Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(new Uint8Array(servedPdf)), hash(localPdf));
  await page.click('[data-slot="mobile-nav-link"][href="/blog"]');
  await page.waitForFunction(() => location.pathname === '/blog');
  await page.click('[data-slot="mobile-nav-link"][href="/resume"]');
  await page.waitForFunction(() => location.pathname === '/resume');
  await ready(page);
  await pause(500);
  assert(!(await page.$('[data-slot="resume-viewer"] [role="alert"]')));
  assert.equal(errors.length, 0, errors.join('\n'));
  results.push({
    scrolling: true,
    crossPageSelection: true,
    stableGeometry: true,
    zoom300: true,
    keyboard: true,
    themes: true,
    fonts,
    pdfHash: hash(localPdf),
  });
  await page.close();

  for (const failure of ['http', 'corrupt', 'worker']) {
    console.log(`Checking ${failure} recovery`);
    const recovery = await mobile();
    await recovery.setCacheEnabled(false);
    await recovery.setRequestInterception(true);
    let attempts = 0;
    let workerUnavailable = failure === 'worker';
    const routes: string[] = [];
    recovery.on('request', (request) => {
      if (/pdf\.worker/.test(request.url()) && workerUnavailable) {
        void request.respond({ status: 503, body: 'temporarily unavailable' });
        return;
      }
      if (request.headers()['next-router-prefetch'] === '1')
        routes.push(new URL(request.url()).pathname);
      if (
        new URL(request.url()).pathname === '/resume.pdf' &&
        ++attempts === 1 &&
        failure !== 'worker'
      ) {
        void request.respond({
          status: failure === 'http' ? 503 : 200,
          contentType: 'application/pdf',
          body: 'invalid-pdf',
        });
      } else void request.continue();
    });
    await recovery.goto(`${origin}/resume`, { waitUntil: 'domcontentloaded' });
    await recovery.waitForSelector(
      '[data-slot="resume-viewer"] [role="alert"]'
    );
    await recovery.waitForFunction(
      () =>
        !document.querySelector('[data-slot="resume-viewer"] [role="status"]')
    );
    await recovery.waitForFunction(
      () =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('/blog?_rsc=')),
      { timeout: 10000 }
    );
    assert(routes.includes('/blog'));
    assert(await recovery.$('[role="alert"] a[download]'));
    workerUnavailable = false;
    await recovery.click('[data-slot="resume-viewer"] [role="alert"] button');
    await ready(recovery);
    assert.equal(attempts, 2);
    results.push({ failure, recovered: true, attempts, prefetchResumed: true });
    await recovery.close();
  }

  console.log('Checking early transfer');
  const overlap = await mobile();
  await overlap.setCacheEnabled(false);
  await overlap.setRequestInterception(true);
  let pdfRequests = 0;
  const resourceStarts: { name: string; time: number }[] = [];
  overlap.on('request', (request) => {
    const url = request.url();
    if (new URL(url).pathname === '/resume.pdf') {
      pdfRequests++;
      resourceStarts.push({ name: 'pdf', time: Date.now() });
    }
    if (/pdf\.worker/.test(url)) {
      resourceStarts.push({ name: 'worker', time: Date.now() });
      void pause(1000).then(() => request.continue());
    } else void request.continue();
  });
  await overlap.goto(`${origin}/resume`, { waitUntil: 'domcontentloaded' });
  await ready(overlap);
  assert.equal(pdfRequests, 1);
  assert(
    resourceStarts.find((r) => r.name === 'pdf')!.time <
      resourceStarts.find((r) => r.name === 'worker')!.time
  );
  results.push({
    earlyTransfer: true,
    pdfRequests,
    delayedWorker: true,
    resourceStarts,
  });
  await overlap.close();

  for (const destination of ['/', '/blog', '/create']) {
    console.log(`Checking pending navigation to ${destination}`);
    const navigation = await mobile();
    await navigation.setRequestInterception(true);
    const pendingPdf = Promise.withResolvers<void>();
    const unrelated: string[] = [];
    let downloading = false;
    navigation.on('request', (request) => {
      if (request.headers()['next-router-prefetch'] === '1')
        unrelated.push(new URL(request.url()).pathname);
      if (new URL(request.url()).pathname === '/resume.pdf') {
        downloading = true;
        void pendingPdf.promise.then(() => request.continue()).catch(() => {});
      } else void request.continue();
    });
    await navigation.goto(`${origin}/resume`, {
      waitUntil: 'domcontentloaded',
    });
    await navigation.waitForSelector('[data-slot="mobile-nav-link"]');
    for (let wait = 0; wait < 100 && !downloading; wait++) await pause(50);
    assert(downloading, 'The fallback must start the PDF request');
    await pause(300);
    assert.equal(unrelated.length, 0);
    const selector = `[data-slot="mobile-nav-link"][href="${destination}"]`;
    await navigation.focus(selector);
    const start = Date.now();
    await navigation.click(selector);
    await navigation.waitForFunction(
      (destination) => location.pathname === destination,
      {},
      destination
    );
    const navigationMs = Date.now() - start;
    pendingPdf.resolve();
    await navigation.waitForFunction(
      () =>
        !document.querySelector('[data-slot="resume-viewer"]')?.getClientRects()
          .length
    );
    results.push({
      destination,
      navigationMs,
      startupNavigation: true,
      automaticPrefetchDeferred: true,
    });
    await navigation.close();
  }

  console.log('Checking native viewing and breakpoint changes');
  const nativeContext = await browser.createBrowserContext();
  const native = await nativeContext.newPage();
  await native.setViewport({ width: 1280, height: 900 });
  const nativeRequests: string[] = [];
  native.on('request', (request) => nativeRequests.push(request.url()));
  await native.goto(`${origin}/resume`, { waitUntil: 'domcontentloaded' });
  await native.waitForSelector('[data-slot="resume-viewer-native"]');
  await pause(500);
  assert(!nativeRequests.some((url) => /pdf\.worker/.test(url)));
  await native.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
  });
  await ready(native);
  await native.setViewport({ width: 1280, height: 900 });
  await native.waitForSelector('[data-slot="resume-viewer-native"]');
  await native.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
  });
  await ready(native);
  results.push({ native: true, workerAbsent: true, breakpointReentry: true });
  await nativeContext.close();
  const fallbackContext = await browser.createBrowserContext();
  const fallback = await fallbackContext.newPage();
  await fallback.setViewport({ width: 1280, height: 900 });
  await fallback.evaluateOnNewDocument(() =>
    Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => false })
  );
  await fallback.goto(`${origin}/resume`, { waitUntil: 'domcontentloaded' });
  await ready(fallback);
  assert(!(await fallback.$('[data-slot="resume-viewer-native"]')));
  results.push({
    unsupportedNativeFallback: true,
    rotation: true,
    retainedZoomPixels: retained,
  });
  await fallbackContext.close();
  await fs.writeFile(
    path.join(evidence, 'results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(
    JSON.stringify({ passed: true, cases: results.length, evidence })
  );
} finally {
  await Promise.race([browser.close(), pause(3000)]);
  browser.process()?.kill();
}

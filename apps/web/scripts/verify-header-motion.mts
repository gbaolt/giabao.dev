import assert from 'node:assert/strict';

import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  acceptInsecureCerts: true,
});

try {
  const page = await browser.newPage();
  await page.goto('https://gbaolt.localhost/blog', {
    waitUntil: 'networkidle2',
  });

  const snapshot = () =>
    page.$eval('header[aria-label="Site header"]', (header) => {
      const rect = header.getBoundingClientRect();
      return {
        left: rect.left,
        width: rect.width,
        top: rect.top,
        frames: Array.from(header.querySelectorAll(':scope > span'), (el) => {
          const bounds = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            left: bounds.left,
            width: bounds.width,
            opacity: style.opacity,
            display: style.display,
            duration: style.transitionDuration,
          };
        }),
        groups: Array.from(
          header.querySelector('nav')?.children ?? [],
          (el) => {
            const bounds = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const matrix = new DOMMatrixReadOnly(style.transform);
            return {
              left: bounds.left,
              width: bounds.width,
              scaleX: matrix.a,
              scaleY: matrix.d,
              duration: style.transitionDuration,
            };
          }
        ),
      };
    });

  const scroll = async (y: number, scrolled: boolean) => {
    await page.evaluate((value) => window.scrollTo(0, value), y);
    await page.waitForFunction(
      (expected) =>
        document
          .querySelector('header[aria-label="Site header"]')
          ?.getAttribute('data-scrolled') === String(expected),
      {},
      scrolled
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    return snapshot();
  };

  for (const width of [390, 767, 768, 896, 1280]) {
    await page.setViewport({ width, height: 900 });
    const top = await scroll(0, false);
    assert.equal(top.groups.length, 2);

    for (const [y, active] of [
      [11, true],
      [7, true],
      [5, false],
      [11, true],
    ] as const) {
      const state = await scroll(y, active);
      const inset = width >= 768 && active ? 8 : 0;
      assert.equal(state.width, top.width, 'Scroll must not resize the header');
      assert.equal(state.top, inset);
      assert.equal(state.frames[0].opacity, inset ? '0' : '1');
      if (width >= 768) {
        assert.equal(state.frames[1].opacity, active ? '1' : '0');
        assert.equal(state.frames[1].left, state.left + 8);
        assert.equal(state.frames[1].width, state.width - 16);
      } else {
        assert.equal(state.frames[1].display, 'none');
      }
      state.groups.forEach((group, i) => {
        assert.equal(group.width, top.groups[i].width);
        assert.equal(group.scaleX, 1);
        assert.equal(group.scaleY, 1);
        assert.equal(
          group.left,
          top.groups[i].left + (i === 0 ? inset : -inset)
        );
      });
    }
  }

  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  for (const width of [390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    await scroll(0, false);
    const state = await scroll(11, true);
    assert.equal(state.top, 0, 'Reduced motion must omit vertical travel');
    assert(state.groups.every((group) => group.duration === '0s'));
    assert(state.frames.every((frame) => frame.duration === '0.15s'));
  }

  console.log('Header geometry, scroll hysteresis and reduced motion passed.');
} finally {
  await browser.close();
}

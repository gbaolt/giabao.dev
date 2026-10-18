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

  await page.setViewport({ width: 1280, height: 900 });
  for (const duration of [200, 500]) {
    await scroll(0, false);
    const override = await page.addStyleTag({
      content: `.site-header, .site-header-flat, .site-header-floating, .site-header > nav > * { transition-duration: ${duration}ms !important; }`,
    });
    const frameMotion = await page.$eval(
      '.site-header-floating',
      async (frame) => {
        const animation = await new Promise<Animation | undefined>(
          (resolve) => {
            const capture = (event: Event) => {
              if (
                !(event instanceof TransitionEvent) ||
                event.propertyName !== 'transform'
              )
                return;
              frame.removeEventListener('transitionrun', capture);
              clearTimeout(timeout);
              const animation = frame
                .getAnimations()
                .find(
                  (item) =>
                    item instanceof CSSTransition &&
                    item.transitionProperty === 'transform'
                );
              animation?.pause();
              resolve(animation);
            };
            const timeout = setTimeout(() => {
              frame.removeEventListener('transitionrun', capture);
              resolve(undefined);
            }, 5000);
            frame.addEventListener('transitionrun', capture);
            window.scrollTo(0, 11);
          }
        );
        if (!animation) return null;
        const duration = Number(animation.effect?.getTiming().duration);
        animation.currentTime = duration / 2;
        const width = frame.getBoundingClientRect().width;
        animation.finish();
        return {
          duration,
          width,
          finalWidth: frame.getBoundingClientRect().width,
        };
      }
    );
    assert(
      frameMotion,
      'The visible header frame must have its own transform transition'
    );
    assert.equal(frameMotion.duration, duration);
    assert(frameMotion.width > frameMotion.finalWidth);
    assert(frameMotion.width < frameMotion.finalWidth + 16);
    await override.evaluate((style) => style.remove());
    await override.dispose();
  }

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
        assert(
          Math.abs(state.frames[1].left - state.left - (active ? 8 : 0)) < 0.1
        );
        assert(
          Math.abs(state.frames[1].width - state.width + (active ? 16 : 0)) <
            0.1
        );
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

  await page.goto('https://gbaolt.localhost/', { waitUntil: 'networkidle2' });
  // Keep the content at its max width so CSS zoom only exercises border rounding.
  await page.setViewport({ width: 1920, height: 900 });
  for (const zoom of [1, 1.25, 1.5, 2]) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = String(value);
      window.scrollTo(0, 0);
    }, zoom);
    const alignment = await page.$eval(
      '[aria-label="Portfolio"]',
      (content) => {
        const frame = document.querySelector('.site-header-flat');
        if (!frame) throw new Error('The flat header frame is missing');
        const contentBounds = content.getBoundingClientRect();
        const frameBounds = frame.getBoundingClientRect();
        return {
          left: frameBounds.left - contentBounds.left,
          right: frameBounds.right - contentBounds.right,
        };
      }
    );
    assert(
      Math.abs(alignment.left) < 0.05,
      `Left border misaligned at ${zoom}x zoom`
    );
    assert(
      Math.abs(alignment.right) < 0.05,
      `Right border misaligned at ${zoom}x zoom`
    );
  }

  console.log(
    'Header geometry, scroll hysteresis, reduced motion and zoom alignment passed.'
  );
} finally {
  await browser.close();
}

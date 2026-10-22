import assert from 'node:assert/strict';

import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  acceptInsecureCerts: true,
});

try {
  for (const width of [1366, 390]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.setViewport({ width, height: 940 });
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: theme },
      ]);
      const response = await page.goto('https://gbaolt.localhost', {
        waitUntil: 'networkidle2',
      });
      assert.equal(response?.status(), 200);
      await page.waitForSelector('#about [role="gridcell"]');
      const selector = '#about [role="gridcell"]';
      const cells = await page.$$eval(selector, (elements) =>
        elements.map((cell) => ({
          date: cell.getAttribute('data-date'),
          row: Number(
            cell.closest('[role="row"]')?.getAttribute('aria-rowindex')
          ),
          col: Number(cell.getAttribute('aria-colindex')),
        }))
      );
      assert(cells.length >= 365, 'Exercise a full year of contributions');

      async function checkFocus(date: string | null) {
        await page.waitForFunction(
          (date) =>
            document.activeElement?.getAttribute('data-date') === date &&
            document.querySelectorAll('#about [role="gridcell"][tabindex="0"]')
              .length === 1 &&
            document.activeElement?.getAttribute('tabindex') === '0',
          {},
          date
        );
      }

      const first = [...cells].sort((a, b) =>
        (a.date ?? '').localeCompare(b.date ?? '')
      )[0];
      const last = [...cells].sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '')
      )[0];
      assert(first && last);
      await page.$eval(`${selector}[tabindex="0"]`, (cell) => {
        if (cell instanceof SVGElement) cell.focus();
      });
      await checkFocus(first.date);
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      assert.equal(
        await page.$eval(selector, (cell) => cell === document.activeElement),
        false
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute('role')),
        null
      );
      await page.keyboard.press('Tab');
      await checkFocus(first.date);

      const interior = cells.find((cell) => cell.row === 4 && cell.col === 3);
      assert(interior);
      await page.$eval(`${selector}[data-date="${interior.date}"]`, (cell) => {
        if (cell instanceof SVGElement) cell.focus();
      });
      for (const [key, row, col] of [
        ['ArrowDown', 5, 3],
        ['ArrowUp', 4, 3],
        ['ArrowRight', 4, 4],
        ['ArrowLeft', 4, 3],
      ] as const) {
        const target = cells.find(
          (cell) => cell.row === row && cell.col === col
        );
        assert(target);
        await page.keyboard.press(key);
        await checkFocus(target.date);
      }
      const row = cells.filter((cell) => cell.row === interior.row);
      for (const [key, target] of [
        ['Home', row[0]],
        ['End', row.at(-1)],
      ] as const) {
        assert(target);
        await page.keyboard.press(key);
        await checkFocus(target.date);
      }
      await page.keyboard.down('Control');
      await page.keyboard.press('Home');
      await page.keyboard.up('Control');
      await checkFocus(first.date);
      await page.keyboard.press('ArrowLeft');
      await checkFocus(first.date);
      await page.keyboard.down('Control');
      await page.keyboard.press('End');
      await page.keyboard.up('Control');
      await checkFocus(last.date);
      for (const key of ['ArrowRight', 'ArrowDown'] as const) {
        await page.keyboard.press(key);
        await checkFocus(last.date);
      }
      await page.waitForFunction(() => {
        const label = document.activeElement?.getAttribute('aria-label');
        return (
          document.querySelector('[data-slot="tooltip-content"]')
            ?.textContent ===
          label?.replace(/^([01]) contributions/, '$1 contribution')
        );
      });
      assert.equal(
        await page.$$eval(
          '[data-slot="tooltip-content"]',
          (elements) => elements.length
        ),
        1
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => !document.querySelector('[data-slot="tooltip-content"]')
      );
      await page.keyboard.press('Tab');
      await page.waitForFunction(
        () =>
          document.activeElement?.tagName === 'A' &&
          document.activeElement.textContent === 'GitHub'
      );
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      await checkFocus(last.date);
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({ width, theme, cells: cells.length, pass: true })
      );
      await page.close();
    }
  }
} finally {
  await browser.close();
}

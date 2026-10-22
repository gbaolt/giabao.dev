import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  acceptInsecureCerts: true,
});

try {
  for (const width of [1366, 390]) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width, height: 900 });
    await page.setJavaScriptEnabled(false);
    const response = await page.goto('https://gbaolt.localhost', {
      waitUntil: 'networkidle2',
    });
    assert.equal(response?.status(), 200);
    await page.waitForSelector('h1', { visible: true });
    const shell = await page.evaluate(() => ({
      title: document.querySelector('h1')?.textContent,
      hidden: !!document
        .querySelector('[aria-label="Portfolio"]')
        ?.closest('[hidden]'),
      about: document.querySelector('#about')?.textContent,
    }));
    assert.equal(shell.title, 'Gia Bảo');
    assert.equal(shell.hidden, false, 'Portfolio must paint without React reveal');
    assert(shell.about?.includes('Software Engineer'));
    console.log(JSON.stringify({ width, staticPortfolioVisible: true }));
    await page.close();
  }
} finally {
  await browser.close();
}

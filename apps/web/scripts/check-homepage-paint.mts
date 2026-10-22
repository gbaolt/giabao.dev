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
    const shell = await page.evaluate(() => {
      const socialPanel = [...document.querySelectorAll('h2')].find(
        (heading) => heading.textContent === 'Social Links'
      )?.parentElement;
      return {
        title: document.querySelector('h1')?.textContent,
        hidden: !!document
          .querySelector('[aria-label="Portfolio"]')
          ?.closest('[hidden]'),
        about: document.querySelector('#about')?.textContent,
        socialIcons: [...(socialPanel?.querySelectorAll('img') ?? [])].map(
          (image) => ({
            loading: image.loading,
            loaded: image.naturalWidth > 0,
          })
        ),
      };
    });
    assert.equal(shell.title, 'Gia Bảo');
    assert.equal(
      shell.hidden,
      false,
      'Portfolio must paint without React reveal'
    );
    assert(shell.about?.includes('Software Engineer'));
    assert.equal(shell.socialIcons.length, 6);
    assert(
      shell.socialIcons.every((icon) => icon.loading === 'eager' && icon.loaded)
    );
    console.log(JSON.stringify({ width, staticPortfolioVisible: true }));
    await page.close();
  }

  for (const interaction of ['keyboard', 'pointer']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCacheEnabled(false);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('https://gbaolt.localhost', { waitUntil: 'networkidle2' });
    const selector = '[aria-label="Flip sentences"]';
    const initialTitle = await page.$eval(
      selector,
      (element) => element.textContent
    );
    await new Promise((resolve) => setTimeout(resolve, 4000));
    assert.equal(
      await page.$eval(selector, (element) => element.textContent),
      initialTitle
    );
    assert.equal(await page.$(`${selector} .shimmer`), null);
    if (interaction === 'keyboard') {
      await page.keyboard.press('Tab');
    } else {
      await page.mouse.click(5, 400);
    }
    await page.waitForFunction(
      (selector, initialTitle) => {
        const title = document.querySelector(selector)?.textContent;
        return !!title && title !== initialTitle;
      },
      { timeout: 7000 },
      selector,
      initialTitle
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({ interaction, titleRotatesAfterInteraction: true })
    );
    await page.close();
  }
} finally {
  await browser.close();
}

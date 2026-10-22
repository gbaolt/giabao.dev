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
} finally {
  await browser.close();
}

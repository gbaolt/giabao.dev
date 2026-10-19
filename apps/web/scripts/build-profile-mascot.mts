import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const outputDirectory = new URL('../../../.gbaolt/mascots/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

for (const type of ['directions', 'reactions']) {
  const source = fileURLToPath(new URL(`${type}.png`, outputDirectory));
  const output = fileURLToPath(new URL(`gbaolt-${type}.webp`, outputDirectory));
  const losslessSource = await sharp(source)
    .webp({ lossless: true, effort: 0 })
    .toBuffer();
  const result = await sharp(losslessSource)
    .resize(576, 576, { fastShrinkOnLoad: true })
    .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(output);

  assert.equal(result.width, 576);
  assert.equal(result.height, 576);
  assert.ok(result.size < 500_000, `${type} atlas exceeds 500 KB`);
  console.log(`${type}: ${result.size} bytes`);
}

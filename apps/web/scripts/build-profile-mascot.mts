import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const outputDirectory = new URL('../../../.gbaolt/mascots/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

for (const kind of ['directions', 'reactions']) {
  const source = fileURLToPath(new URL(`${kind}.png`, outputDirectory));
  const output = fileURLToPath(
    new URL(`gia-bao-${kind}.webp`, outputDirectory)
  );
  const result = await sharp(source)
    .resize(576, 576, { kernel: 'nearest' })
    .webp({ nearLossless: true, quality: 90, effort: 6 })
    .toFile(output);

  assert.equal(result.width, 576);
  assert.equal(result.height, 576);
  assert.ok(result.size < 500_000, `${kind} atlas exceeds 500 KB`);
  console.log(`${kind}: ${result.size} bytes`);
}

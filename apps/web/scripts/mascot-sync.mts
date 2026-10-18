import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getR2ClientFromEnv, syncDirToR2 } from './lib/r2.mts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mascotsDir = path.resolve(scriptDir, '../../../.gbaolt/mascots');

async function main() {
  const keys = await syncDirToR2({
    client: getR2ClientFromEnv(),
    dir: mascotsDir,
    prefix: 'mascots',
    extensions: ['.webp'],
  });

  const requiredKeys = [
    'mascots/gbaolt-directions.webp',
    'mascots/gbaolt-reactions.webp',
  ];

  const missingKeys = requiredKeys.filter((key) => !keys.includes(key));

  if (missingKeys.length > 0) {
    console.log(`Missing required mascot files: ${missingKeys.join(', ')}`);
    return;
  }

  for (const key of keys) {
    console.log(`Uploaded: ${key}`);
  }

  console.log('Mascot sync complete.');
}

main().catch((error) => {
  console.error('Error syncing mascots:', error);
  process.exit(1);
});

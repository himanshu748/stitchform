import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
await mkdir('public/tesseract/core', { recursive: true });
await mkdir('public/tesseract/lang', { recursive: true });
const pkg = JSON.parse(await readFile('node_modules/tesseract.js-core/package.json', 'utf8'));
if (pkg.version !== '7.0.0') throw new Error('Review core version before copying');
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/tesseract/worker.min.js');
await copyFile('node_modules/tesseract.js/LICENSE.md', 'public/tesseract/LICENSE.txt');
await copyFile('node_modules/tesseract.js-core/LICENSE', 'public/tesseract/core/LICENSE.txt');
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (file.endsWith('.wasm.js') || file.endsWith('.wasm')) await copyFile(`node_modules/tesseract.js-core/${file}`, `public/tesseract/core/${file}`);
}
for (const lang of ['eng', 'hin']) {
  const path = `public/tesseract/lang/${lang}.traineddata.gz`;
  if (existsSync(path)) continue;
  const response = await fetch(`https://tessdata.projectnaptha.com/4.0.0/${lang}.traineddata.gz`);
  if (!response.ok) throw new Error(`Language download failed: ${response.status}`);
  await writeFile(path, new Uint8Array(await response.arrayBuffer()));
}

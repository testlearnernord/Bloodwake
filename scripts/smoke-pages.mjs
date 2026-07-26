/* global process, console */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const indexPath = join(dist, 'index.html');

const fail = (message) => {
  console.error(`smoke:pages failed: ${message}`);
  process.exit(1);
};

if (!existsSync(indexPath)) {
  fail('dist/index.html does not exist.');
}

const html = readFileSync(indexPath, 'utf8');

if (html.includes('/src/main.ts')) {
  fail('dist/index.html still references /src/main.ts.');
}

if (!html.includes('/Bloodwake/')) {
  fail('dist/index.html does not include /Bloodwake/ base path references.');
}

const assetsDir = join(dist, 'assets');
if (!existsSync(assetsDir)) {
  fail('dist/assets directory is missing.');
}

const assets = readdirSync(assetsDir);
if (!assets.some((file) => file.endsWith('.js'))) {
  fail('No production JavaScript assets found in dist/assets.');
}
if (!assets.some((file) => file.endsWith('.css'))) {
  fail('No production CSS assets found in dist/assets.');
}

console.log('smoke:pages passed');

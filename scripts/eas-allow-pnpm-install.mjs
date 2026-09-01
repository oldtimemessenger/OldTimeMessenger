import fs from 'node:fs';
import path from 'node:path';

const candidates = [
  process.cwd(),
  path.resolve(process.cwd(), '..'),
  path.resolve(process.cwd(), '../..'),
  path.resolve(process.cwd(), '../../..'),
];

const patched = new Set();

for (const dir of candidates) {
  const npmrc = path.join(dir, '.npmrc');
  const workspace = path.join(dir, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspace) && !fs.existsSync(npmrc)) {
    continue;
  }
  let text = fs.existsSync(npmrc) ? fs.readFileSync(npmrc, 'utf8') : '';
  if (!/(^|\n)frozen-lockfile\s*=/.test(text)) {
    if (text.length > 0 && !text.endsWith('\n')) {
      text += '\n';
    }
    text += 'frozen-lockfile=false\n';
    fs.writeFileSync(npmrc, text);
    patched.add(npmrc);
  }
}

console.log(
  patched.size
    ? `EAS pnpm: wrote frozen-lockfile=false to ${[...patched].join(', ')}`
    : 'EAS pnpm: frozen-lockfile already configured',
);

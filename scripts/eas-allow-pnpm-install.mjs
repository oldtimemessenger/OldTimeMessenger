import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

function wrapPnpm(bin) {
  if (!bin || !fs.existsSync(bin) || bin.endsWith('.real')) {
    return false;
  }
  try {
    fs.accessSync(path.dirname(bin), fs.constants.W_OK);
  } catch {
    return false;
  }
  const real = `${bin}.real`;
  if (!fs.existsSync(real)) {
    fs.copyFileSync(bin, real);
  }
  fs.writeFileSync(
    bin,
    `#!/bin/bash
args=()
for a in "$@"; do
  case "$a" in
    --frozen-lockfile|--frozen-lockfile=true) ;;
    *) args+=("$a") ;;
  esac
done
exec "${real}" "\${args[@]}" --frozen-lockfile=false
`,
  );
  fs.chmodSync(bin, 0o755);
  return true;
}

const wrapped = new Set();
try {
  const which = execFileSync('bash', ['-lc', 'which -a pnpm || true'], {
    encoding: 'utf8',
  });
  for (const bin of which.split('\n').map((s) => s.trim()).filter(Boolean)) {
    if (wrapPnpm(bin)) {
      wrapped.add(bin);
    }
  }
} catch {
  // ignore
}

console.log(
  patched.size
    ? `EAS pnpm: wrote frozen-lockfile=false to ${[...patched].join(', ')}`
    : 'EAS pnpm: frozen-lockfile already configured',
);
console.log(
  wrapped.size
    ? `EAS pnpm: wrapped binaries ${[...wrapped].join(', ')}`
    : 'EAS pnpm: no writable pnpm binary to wrap',
);

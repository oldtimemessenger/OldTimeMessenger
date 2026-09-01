import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OVERRIDE_BLOCK = `overrides:
  brace-expansion: 5.0.9
  fast-uri: 3.1.5
  js-yaml: 4.3.1
  postcss: 8.5.18
  uuid: 11.1.1
  '@esbuild-kit/esm-loader': npm:tsx@^4.21.0
  esbuild: 0.27.3
`;

const candidates = [
  process.cwd(),
  path.resolve(process.cwd(), '..'),
  path.resolve(process.cwd(), '../..'),
  path.resolve(process.cwd(), '../../..'),
];

function findWorkspaceRoot() {
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
  }
  return process.cwd();
}

const root = findWorkspaceRoot();
const npmrc = path.join(root, '.npmrc');
let npmrcText = fs.existsSync(npmrc) ? fs.readFileSync(npmrc, 'utf8') : '';
if (!/(^|\n)frozen-lockfile\s*=/.test(npmrcText)) {
  if (npmrcText.length > 0 && !npmrcText.endsWith('\n')) {
    npmrcText += '\n';
  }
  npmrcText += 'frozen-lockfile=false\n';
  fs.writeFileSync(npmrc, npmrcText);
  console.log(`EAS pnpm: wrote frozen-lockfile=false to ${npmrc}`);
}

const lockfile = path.join(root, 'pnpm-lock.yaml');
if (fs.existsSync(lockfile)) {
  const original = fs.readFileSync(lockfile, 'utf8');
  const updated = original.replace(
    /^overrides:\n(?:[ \t].*\n)*/m,
    OVERRIDE_BLOCK,
  );
  if (updated !== original) {
    fs.writeFileSync(lockfile, updated);
    console.log(`EAS pnpm: rewrote overrides in ${lockfile}`);
  } else {
    console.log('EAS pnpm: lockfile overrides already match');
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
  wrapped.size
    ? `EAS pnpm: wrapped binaries ${[...wrapped].join(', ')}`
    : 'EAS pnpm: no writable pnpm binary to wrap',
);
